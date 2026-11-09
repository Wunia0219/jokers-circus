import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYTEST_IDENTITY,assertPlaytestIdentity,PlaytestService} from '../cloud/yakyuken-playtest-core.js';
import {PlayerArchive} from '../src/games/yakyuken/player-archive.js';
import {TestWalletClient} from '../src/games/yakyuken/test-wallet-client.js';
import {playtestGateway} from '../scripts/game/yakyuken-test-gateway.js';

function fixture(){
  const docs=new Map(),values=new Map(),weights=[];let reads=0,writes=0,weight=0,unknown=false,randomCalls=0,failReceipt=false,lostReceipt=false;
  const repository={async read(player){reads++;return structuredClone(docs.get(player));},async mutate(player,change){reads++;const current=structuredClone(docs.get(player)),state=change(current);if(state!==current){writes++;docs.set(player,structuredClone(state));if(unknown){unknown=false;throw new Error('Commit response lost');}}return state;}};
  const io=map=>({get:async key=>structuredClone(map.get(key)),put:async(key,value)=>map.set(key,structuredClone(value)),delete:async key=>map.delete(key)});
  const storage={...io(values),transaction:async fn=>{const staged=new Map(values),result=await fn(io(staged));if(failReceipt){failReceipt=false;throw new Error('Receipt transaction lost');}values.clear();for(const [k,v]of staged)values.set(k,v);if(lostReceipt){lostReceipt=false;throw new Error('Receipt response lost');}return result;}};
  const service=(player='qa-a')=>new PlaytestService({repository,storage,player,entropy:{getRandomValues:v=>{randomCalls++;v[0]=weights.length?weights.shift():weight;}}});
  return {service,docs,storage,get reads(){return reads;},get writes(){return writes;},get randomCalls(){return randomCalls;},plan:outcomes=>weights.push(...outcomes.map(value=>({win:0,loss:4000,draw:8000}[value]))),set outcome(value){weight={win:0,loss:4000,draw:8000}[value];},loseCommit(){unknown=true;},loseReceipt(){failReceipt=true;},loseReceiptResponse(){lostReceipt=true;}};
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
test('paid entry locks the entire sequence privately and each response exposes only the next hand',async()=>{
  const f=fixture();f.plan(['draw','loss','win','draw','win']);const s=f.service(),entry=await begin(s),randomCalls=f.randomCalls;
  assert.deepEqual(f.docs.get('qa-a').duelPlan.outcomes,['draw','loss','win','draw','win']);
  assert.deepEqual(entry.nextHand,{matchId:entry.matchId,index:0,outcome:'draw'});
  assert.ok(!JSON.stringify(entry).includes('duelPlan'));assert.ok(!JSON.stringify(entry).includes('outcomes'));
  f.outcome='loss';let response=entry;
  for(const [index,outcome]of ['draw','loss','win','draw','win'].entries()){
    assert.equal(response.nextHand.index,index);assert.equal(response.nextHand.outcome,outcome);
    response=await s.execute('hand',{matchId:entry.matchId,requestId:id(),move:['rock','paper','scissors'][index%3],handIndex:index});
    assert.equal(response.duel.outcome,outcome);assert.equal(f.randomCalls,randomCalls,'playing never draws again');
  }
  assert.equal(response.wallet.balance,11500);assert.equal(response.nextHand,null);assert.ok(!f.docs.get('qa-a').duelPlan);
});
for(const [characterId,requiredWins,reward] of [['guest-1',3,5000],['guest-2',5,10000]]){
  test(`${characterId} unlocks each pose and pays exactly once after ${requiredWins} wins`,async()=>{
    const f=fixture();f.plan(Array(requiredWins).fill('win'));const s=f.service();
    const {matchId,wallet}=await s.execute('begin',{characterId,requestId:id()});
    assert.equal(wallet.unlocks[characterId],0);
    for(let wins=1;wins<=requiredWins;wins++){
      const requestId=id(),result=await hand(s,matchId,requestId),record=result.wallet.records[0];
      const payout=wins===requiredWins?reward:0;
      assert.deepEqual([record.wins,result.wallet.unlocks[characterId],record.reward,result.wallet.balance],
        [wins,wins,payout,9000+payout]);
      if(payout)assert.deepEqual(await hand(f.service(),matchId,requestId),result);
    }
  });
}
test('draw cursor and receipt commit together; reloads, stale tickets and old receipts cannot consume another hand',async()=>{
  const f=fixture();f.plan(['draw','draw','win','win']);let s=f.service();const entry=await begin(s),requestId=id();
  const body={matchId:entry.matchId,move:'rock',handIndex:0,requestId};f.loseReceipt();
  await assert.rejects(s.execute('hand',body),/Receipt/);
  assert.equal((await s.stateView()).nextHand.index,0);const writes=f.writes,reads=f.reads;
  const first=await s.execute('hand',body);assert.equal(first.nextHand.index,1);s=f.service();
  assert.deepEqual((await s.stateView()).nextHand,first.nextHand);
  const before=[f.reads,f.writes];assert.deepEqual(await s.execute('hand',body),first);
  await assert.rejects(s.execute('hand',{...body,requestId:id()}),e=>e.status===409);
  await assert.rejects(s.execute('hand',{...body,handIndex:2,requestId:id()}),e=>e.status===409);
  assert.deepEqual([f.reads,f.writes],before);assert.equal(f.writes,writes);assert.ok(f.reads>=reads);
  const second=await s.execute('hand',{...body,handIndex:1,requestId:id()});assert.equal(second.nextHand.index,2);
  assert.equal((await s.stateView()).nextHand.index,2);
});
test('unknown entry/prize and failed durable receipts preserve the locked plan, cursor and exactly one award',async()=>{
  const f=fixture();f.plan(['draw','win','win']);const requestId=id();f.loseCommit();
  await assert.rejects(f.service().execute('begin',{requestId,characterId:'dealer'}),/lost/);f.outcome='loss';
  let s=f.service();const entry=await s.execute('begin',{requestId,characterId:'dealer'});
  assert.equal(entry.nextHand.outcome,'draw');const randomCalls=f.randomCalls;
  await hand(s,entry.matchId);await hand(s,entry.matchId);const prizeId=id();f.loseReceipt();
  await assert.rejects(hand(s,entry.matchId,prizeId),/Receipt/);assert.equal(f.docs.get('qa-a').balance,11500);
  const writes=f.writes;s=f.service();const won=await hand(s,entry.matchId,prizeId);
  assert.equal(won.wallet.balance,11500);assert.equal(won.nextHand,null);assert.equal(f.randomCalls,randomCalls);
  assert.equal(f.writes,writes,'recovery reads the committed receipt without applying the prize again');
});
test('a committed draw with a lost durable response replays its receipt without advancing or reading Firestore',async()=>{
  const f=fixture();f.plan(['draw','win','win']);const s=f.service(),entry=await begin(s);
  const body={requestId:id(),matchId:entry.matchId,handIndex:0,move:'scissors'},before=[f.reads,f.writes,f.randomCalls];
  f.loseReceiptResponse();await assert.rejects(s.execute('hand',body),/Receipt response/);
  const replay=await f.service().execute('hand',body);assert.equal(replay.duel.outcome,'draw');assert.equal(replay.nextHand.index,1);
  assert.deepEqual([f.reads,f.writes,f.randomCalls],before);
});
test('legacy paid matches finish in place and malformed/new client outcome fields cannot replace a plan',async()=>{
  const f=fixture();const entry=await begin(f.service()),stored=f.docs.get('qa-a');delete stored.duelPlan;await f.storage.delete('hand-cursor');
  f.outcome='loss';const s=f.service();assert.equal((await s.stateView()).nextHand,null);
  assert.equal((await hand(s,entry.matchId)).duel.outcome,'loss');assert.equal((await hand(s,entry.matchId)).wallet.balance,9000);
  const before=f.writes;
  for(const handIndex of [-1,1.5,'0',null,[],Number.MAX_SAFE_INTEGER+1])await assert.rejects(s.execute('hand',{matchId:entry.matchId,move:'rock',requestId:id(),handIndex}),e=>e.status===400);
  await assert.rejects(s.execute('begin',{characterId:'dealer',requestId:id(),plan:['win','win']}),e=>e.status===400);
  assert.equal(f.writes,before);
});
test('draws do not read or write Firestore and exact retries preserve the original hand',async()=>{
  const f=fixture(),s=f.service();f.plan(['draw','win','win']);const entry=await begin(s),[reads,writes]=[f.reads,f.writes],requestId=id();
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
  await assert.rejects(()=>s.execute('begin',{characterId:'guest-3',requestId:id()}),/尚未開放/);assert.equal(f.writes,0);
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
  await s.execute('leave',{matchId:entry.matchId,requestId:id()});f.outcome='loss';const next=await begin(s);assert.equal(next.wallet.balance,8000);assert.notEqual(next.matchId,entry.matchId);
  await hand(s,next.matchId);const lost=await hand(s,next.matchId);assert.equal(lost.wallet.balance,8000);assert.equal(lost.wallet.records[0].status,'lost');assert.equal(lost.wallet.records[0].net,-1000);
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
