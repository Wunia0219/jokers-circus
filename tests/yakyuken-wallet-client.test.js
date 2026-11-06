import test from 'node:test';
import assert from 'node:assert/strict';
import {TestWalletClient} from '../src/games/yakyuken/test-wallet-client.js';

const wallet=revision=>({environment:'test',cloud:true,player:'qa-a',revision,balance:9000,records:[],unlocks:{}});
const storage=()=>{
  const values=new Map();
  return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
};

test('refresh and repeated actions share the pending mutation until its response arrives',async()=>{
  const calls=[];
  const client=new TestWalletClient({storage:storage(),fetchImpl:(path,options)=>new Promise(resolve=>calls.push({path,options,resolve}))});
  const first=client.begin('dealer'),refresh=client.refresh(),repeat=client.begin('dealer');
  assert.equal(calls.length,1,'refresh must not independently resend an in-flight mutation');
  await assert.rejects(client.checkin(),/上一個/);
  calls[0].resolve(Response.json({wallet:wallet(1)}));
  await Promise.all([first,repeat]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,2);
  assert.ok(calls[1].path.includes('/state'));
  assert.equal(client.pending,null);
  calls[1].resolve(Response.json({wallet:wallet(1)}));
  await refresh;
});

test('restored pending mutations also share the lock with new actions and refreshes',async()=>{
  const disk=storage(),calls=[];
  const client=new TestWalletClient({storage:disk,fetchImpl:(path,options)=>new Promise(resolve=>calls.push({path,options,resolve}))});
  client.pending={action:'begin',body:{characterId:'dealer',requestId:'restored-request-0001'}};client.persist();
  const refresh=client.refresh(),repeat=client.begin('dealer');
  assert.equal(calls.length,1);
  calls[0].resolve(Response.json({wallet:wallet(1)}));
  await repeat;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,2);
  calls[1].resolve(Response.json({wallet:wallet(1)}));await refresh;
  assert.equal(disk.getItem(client.key),undefined);
});

test('late state responses cannot replace a newer settlement',async()=>{
  let release;
  const client=new TestWalletClient({storage:storage(),fetchImpl:async(path)=>path.endsWith('state?player=qa-a')
    ?new Promise(resolve=>release=resolve):Response.json({wallet:wallet(2)})});
  const refresh=client.refresh();await client.begin('dealer');
  release(Response.json({wallet:wallet(1)}));await refresh;
  assert.equal(client.wallet.revision,2);
});

test('blocked session storage does not prevent opening the test wallet',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
  try{
    const client=new TestWalletClient({fetchImpl:async()=>Response.json({wallet:wallet(1)})});
    await client.begin('dealer');assert.equal(client.wallet.balance,9000);assert.equal(client.pending,null);
  }finally{
    if(descriptor)Object.defineProperty(globalThis,'sessionStorage',descriptor);else delete globalThis.sessionStorage;
  }
});

test('failed refresh retains the original operation for retry; definitive rejection unlocks it',async()=>{
  const sent=[];let mode='offline';
  const client=new TestWalletClient({storage:storage(),fetchImpl:async(_path,options)=>{
    sent.push(JSON.parse(options.body));
    if(mode==='offline')throw new Error('offline');
    return mode==='conflict'?Response.json({error:'conflict'},{status:409}):Response.json({wallet:wallet(2)});
  }});
  await assert.rejects(client.begin('dealer'),/重試/);
  await assert.rejects(client.refresh(),/重試/);
  assert.equal(sent[0].requestId,sent[1].requestId);assert.ok(client.pending);assert.equal(client.inFlight,null);
  mode='conflict';await assert.rejects(client.begin('dealer'),/conflict/);
  assert.equal(client.pending,null);assert.equal(client.inFlight,null);
  mode='ok';await client.checkin();assert.notEqual(sent.at(-1).requestId,sent[0].requestId);
});

test('prefetched outcomes map every player move without IO and persist the original hand index through a lost response',async()=>{
  const disk=storage(),calls=[];let fail=true;
  const active={id:'prepared-match-0001',characterId:'dealer',status:'playing',wins:0,losses:0};
  const state={...wallet(1),activeId:active.id,records:[active]};
  const client=new TestWalletClient({storage:disk,fetchImpl:async(path,options)=>{
    if(!options.body)return Response.json({wallet:state,nextHand:{matchId:active.id,index:0,outcome:'win'}});
    calls.push(JSON.parse(options.body));if(fail)throw new Error('offline');
    return Response.json({wallet:{...state,revision:2},nextHand:{matchId:active.id,index:1,outcome:'loss'}});
  }});
  await client.refresh();
  for(const move of ['rock','paper','scissors'])assert.equal(client.previewHand(active.id,move).duel.outcome,'win');
  assert.equal(calls.length,0);assert.equal(client.previewHand('other-match-0001','rock'),null);
  await assert.rejects(client.hand(active.id,'paper',0),/重試/);fail=false;
  const restored=new TestWalletClient({storage:disk,fetchImpl:client.fetchImpl});await restored.hand(active.id,'paper',0);
  assert.deepEqual(calls[0],calls[1]);assert.equal(calls[1].handIndex,0);assert.equal(restored.nextHand.index,1);
});

test('equal-revision delayed draw receipts cannot roll a prepared hand backwards',async()=>{
  const activeId='prepared-match-0001',state={...wallet(1),activeId,records:[{id:activeId,status:'playing'}]};let index=2;
  const client=new TestWalletClient({storage:null,fetchImpl:async()=>Response.json({wallet:state,nextHand:{matchId:activeId,index,outcome:'draw'}})});
  await client.refresh();index=1;await client.refresh();assert.equal(client.nextHand.index,2);
  index=3;await client.refresh();assert.equal(client.nextHand.index,3);
});
