import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrantNotifier} from '../server/discord/grant-notification.js';

const guild='100000000000000001',user='100000000000000002',actor='100000000000000003',channel='1565731918107115690';
const interaction={guild_id:guild,member:{user:{id:actor}}};
const grant={entry:{guild,user,actor,kind:'grant',delta:500,reason:'活動獎勵'}};
test('grant notification destination comes only from the configured bot and allowed game channels',async()=>{
  let calls=0;const bot={guild,channel,send:async(payload,key)=>{calls++;assert.equal(key,`grant:${guild}:original-form`);assert.deepEqual(payload.allowed_mentions,{parse:[],users:[user]});return {kind:'sent'};}};
  for(const notifier of [createGrantNotifier(null,[channel]),createGrantNotifier(bot,[]),createGrantNotifier({...bot,guild:user},[channel])]){
    assert.equal((await notifier(interaction,grant,'original-form')).kind,'unavailable');
  }
  assert.equal(calls,0);
  const notify=createGrantNotifier(bot,[channel]);
  for(const entry of [{...grant.entry,kind:'reversal'},{...grant.entry,guild:user},{...grant.entry,actor:user},{...grant.entry,user:'@everyone'}])assert.equal((await notify(interaction,{entry},'original-form')).kind,'unavailable');
  assert.equal((await notify(interaction,{...grant,duplicate:true},'original-form')).kind,'unavailable');assert.equal(calls,0);
  assert.equal((await notify({...interaction,channel_id:user},grant,'original-form')).kind,'sent');assert.equal(calls,1);
});
