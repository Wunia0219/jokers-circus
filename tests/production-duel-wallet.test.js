import assert from 'node:assert/strict';
import test from 'node:test';
import {ProductionDuelWallet} from '../src/games/yakyuken/production-wallet.js';

const session={guildId:'100000000000000001',userId:'100000000000000002',environment:'production'};
const matchId='match-id-0000000001';
const wallet={player:'d_'+session.guildId+'_'+session.userId,environment:session.environment,cloud:true,
  revision:3,balance:9000,activeId:matchId,unlocks:{dealer:0},records:[{id:matchId,status:'playing'}]};
const receipt={wallet,nextHand:{matchId,index:1}};
const makeStorage=()=>{
  const values=new Map();
  return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
};

test('a lost production hand keeps its move, index and request ID through reload',async()=>{
  const storage=makeStorage(),requests=[];
  const fetchImpl=async(path,options)=>{
    if(options.method==='GET')return Response.json(receipt);
    requests.push(JSON.parse(options.body));
    if(requests.length===1)throw new Error('isolated response loss');
    return Response.json(receipt);
  };
  const first=new ProductionDuelWallet(session,fetchImpl,storage);
  await assert.rejects(first.hand(matchId,'rock',0),/回報碼 D-/);
  assert.equal(first.supportCode,'D-'+requests[0].requestId);
  const reopened=new ProductionDuelWallet(session,fetchImpl,storage);
  await reopened.refresh();
  assert.deepEqual(requests,[requests[0],requests[0]]);
  assert.deepEqual(reopened.nextHand,{matchId,index:1});
  assert.equal(reopened.supportCode,null);
});

test('a production hand conflict refreshes progress without sending a new hand',async()=>{
  const calls=[];
  const fetchImpl=async(path,options)=>{
    calls.push(options.method);
    return options.method==='POST'?Response.json({error:'出牌進度已更新',code:'DUEL_HAND'},{status:409}):Response.json(receipt);
  };
  const client=new ProductionDuelWallet(session,fetchImpl,makeStorage());
  await assert.rejects(client.hand(matchId,'paper',0),{code:'DUEL_HAND'});
  await client.refresh();
  assert.deepEqual(calls,['POST','GET']);
  assert.equal(client.nextHand.index,1);
  assert.equal(client.supportCode,null);
});
