import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYTEST_IDENTITY,assertPlaytestIdentity,PlaytestService} from '../cloud/yakyuken-playtest-core.js';
import {PlayerArchive} from '../src/games/yakyuken/player-archive.js';
import {TestWalletClient} from '../src/games/yakyuken/test-wallet-client.js';
import {playtestGateway} from '../scripts/game/yakyuken-test-gateway.js';

function fixture(){
  const docs=new Map(),values=new Map();let reads=0,writes=0,weight=0,unknown=false;
  const repository={async read(player){reads++;return structuredClone(docs.get(player));},async mutate(player,change){reads++;const state=change(structuredClone(docs.get(player)));writes++;docs.set(player,structuredClone(state));if(unknown){unknown=false;throw new Error('Commit response lost');}return state;}};
  const storage={get:async key=>structuredClone(values.get(key)),put:async(key,value)=>values.set(key,structuredClone(value)),delete:async key=>values.delete(key),transaction:async fn=>fn(storage)};
  const service=(player='qa-a')=>new PlaytestService({repository,storage,player,entropy:{getRandomValues:v=>{v[0]=weight;}}});
  return {service,docs,storage,get reads(){return reads;},get writes(){return writes;},set outcome(value){weight={win:0,loss:4000,draw:8000}[value];},loseCommit(){unknown=true;}};
}
let seq=0;const id=()=>`request-test-${String(++seq).padStart(10,'0')}`;
const begin=s=>s.execute('begin',{characterId:'dealer',requestId:id()});
const hand=(s,matchId,requestId=id(),move='rock')=>s.execute('hand',{matchId,move,requestId});

test('test cloud guard rejects production identities and unknown test namespaces',()=>{
  const env={APP_ENV:'test',FIRESTORE_PROJECT_ID:PLAYTEST_IDENTITY.projectId,FIRESTORE_NAMESPACE:PLAYTEST_IDENTITY.namespace};assert.doesNotThrow(()=>assertPlaytestIdentity(env));
  for(const bad of [{APP_ENV:'production'},{FIRESTORE_PROJECT_ID:'jokers-circus-production'},{FIRESTORE_NAMESPACE:'jokers-circus-v2-20261024-test'}])assert.throws(()=>assertPlaytestIdentity({...env,...bad}));
});
test('local gateway only accepts the dedicated test Worker and a private token',()=>{
  const token='a'.repeat(64);assert.equal(typeof playtestGateway({origin:'https://jokers-circus-yakyuken-test.example.workers.dev',token}),'function');
  for(const origin of ['https://jokers-circus.example.workers.dev','https://jokers-circus-production.example.workers.dev','http://jokers-circus-yakyuken-test.example.workers.dev','https://jokers-circus-yakyuken-test.example.workers.dev/other'])assert.throws(()=>playtestGateway({origin,token}));
});
test('test wallet charges once, awards server-side once, preserves net and records without draw counters',async()=>{
  const f=fixture(),s=f.service(),requestId=id(),entry=await s.execute('begin',{characterId:'dealer',requestId});
  assert.equal(entry.wallet.balance,9000);assert.equal((await s.execute('begin',{characterId:'dealer',requestId})).wallet.balance,9000);
  const first=await hand(s,entry.matchId),lastId=id(),last=await hand(s,entry.matchId,lastId);
  assert.equal(first.wallet.balance,9000);assert.equal(last.wallet.balance,11500);assert.equal(last.wallet.records[0].net,1500);
  assert.equal((await hand(s,entry.matchId,lastId)).wallet.balance,11500);
  assert.equal(last.wallet.records.length,1);assert.equal(last.wallet.records[0].wins,2);assert.equal(last.wallet.unlocks.dealer,2);
  assert.ok(!JSON.stringify(f.docs.get('qa-a')).match(/"(draws|rounds)":/));
  await assert.rejects(()=>hand(s,entry.matchId),/已結束/);
});
test('draws do not read or write Firestore and exact retries preserve the original hand',async()=>{
  const f=fixture(),s=f.service(),entry=await begin(s);f.outcome='draw';const [reads,writes]=[f.reads,f.writes],requestId=id();
  const draw=await hand(s,entry.matchId,requestId);assert.equal(draw.duel.outcome,'draw');assert.equal(f.reads,reads);assert.equal(f.writes,writes);
  f.outcome='win';assert.equal((await hand(s,entry.matchId,requestId)).duel.outcome,'draw');assert.equal(f.writes,writes);
  assert.equal(draw.wallet.records[0].wins,0);assert.equal(draw.wallet.records[0].losses,0);
  await assert.rejects(()=>hand(s,entry.matchId,requestId,'paper'),/其他操作/);
});
test('unknown commits recover the original debit and prize across service restart',async()=>{
  const f=fixture(),requestId=id();f.loseCommit();await assert.rejects(()=>f.service().execute('begin',{characterId:'dealer',requestId}),/lost/);
  const s=f.service(),entry=await s.execute('begin',{characterId:'dealer',requestId});assert.equal(entry.wallet.balance,9000);
  await hand(s,entry.matchId);f.loseCommit();const winId=id();await assert.rejects(()=>hand(s,entry.matchId,winId),/lost/);
  const recovered=await hand(f.service(),entry.matchId,winId);assert.equal(recovered.wallet.balance,11500);assert.equal(recovered.wallet.records.length,1);
});
test('insufficient funds, client supplied payouts and disabled characters cannot mutate test balances',async()=>{
  const f=fixture(),s=f.service('qa-low');await assert.rejects(()=>begin(s),/戲籌不足/);assert.equal(f.writes,0);
  await assert.rejects(()=>s.execute('begin',{characterId:'dealer',requestId:id(),reward:2500}),/欄位/);
  await assert.rejects(()=>s.execute('begin',{characterId:'guest-1',requestId:id()}),/尚未開放/);assert.equal(f.writes,0);
});

test('request and match identifiers require strings before any storage or randomness',async()=>{
  const f=fixture(),s=f.service();
  for(const requestId of [[id()],1234567890123456,{toString:()=>id()}]){
    await assert.rejects(()=>s.execute('begin',{characterId:'dealer',requestId}),error=>error.status===400);
  }
  for(const action of ['hand','leave'])for(const matchId of [undefined,null,[],[id()],1234567890123456]){
    await assert.rejects(()=>s.execute(action,{requestId:id(),matchId,...(action==='hand'?{move:'rock'}:{})}),error=>error.status===400);
  }
  assert.equal(f.reads,0);assert.equal(f.writes,0);
});
test('resuming an active match does not debit twice; leaving and losing retain the fee',async()=>{
  const f=fixture(),s=f.service(),entry=await begin(s);assert.equal((await begin(s)).matchId,entry.matchId);assert.equal(f.writes,1);
  await s.execute('leave',{matchId:entry.matchId,requestId:id()});const next=await begin(s);assert.equal(next.wallet.balance,8000);assert.notEqual(next.matchId,entry.matchId);
  f.outcome='loss';await hand(s,next.matchId);const lost=await hand(s,next.matchId);assert.equal(lost.wallet.balance,8000);assert.equal(lost.wallet.records[0].status,'lost');assert.equal(lost.wallet.records[0].net,-1000);
});
test('daily claims award once across new request IDs and survive restart',async()=>{
  const f=fixture(),s=f.service('qa-zero');const a=await s.execute('checkin',{requestId:id()}),b=await s.execute('checkin',{requestId:id()});
  assert.equal(a.wallet.balance,500);assert.equal(b.wallet.balance,500);assert.equal((await f.service('qa-zero').stateView()).wallet.balance,500);assert.equal(f.writes,1);
});
test('local archive skips all storage reads and writes on a draw and strips legacy counts',()=>{
  const values=new Map();let reads=0,writes=0;
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>{reads++;return values.get(key)||null;},setItem:(key,value)=>{writes++;values.set(key,value);}};
  const archive=new PlayerArchive({storage,id:()=> 'legacy-match-0001'}),matchId=archive.begin('dealer');const before=[reads,writes];
  archive.update(matchId,{last:{outcome:'draw'}});assert.deepEqual([reads,writes],before);
  const key=archive.prefix+'match:'+matchId,legacy=JSON.parse(values.get(key));values.set(key,JSON.stringify({...legacy,draws:99,rounds:99}));
  assert.equal(Object.hasOwn(archive.getRecord(matchId),'draws'),false);archive.leave(matchId);assert.ok(!values.get(key).includes('draws'));
});
test('test client retains one request through a lost response and scopes pending data to the test player',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};let calls=0;const ids=[];
  const f=fixture(),service=f.service(),fetchImpl=async(path,options)=>{const body=JSON.parse(options.body);ids.push(body.requestId);const data=await service.execute('begin',body);if(++calls===1)throw new Error('lost');return Response.json(data);};
  const a=new TestWalletClient({storage,fetchImpl});await assert.rejects(()=>a.begin('dealer'),/重試/);assert.ok(a.pending);
  const restored=new TestWalletClient({storage,fetchImpl}),response=await restored.begin('dealer');assert.equal(response.wallet.balance,9000);assert.equal(ids[0],ids[1]);assert.equal(values.size,0);
  assert.equal(new TestWalletClient({player:'qa-b',storage,fetchImpl}).pending,undefined);
});
