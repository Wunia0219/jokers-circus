import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrantNotifier,GrantNotifications} from '../server/discord/grant-notification.js';
import {CasinoBot} from '../server/discord/casino-bot.js';

const guild='100000000000000001',user='100000000000000002',actor='100000000000000003',channel='1565731918107115690';
const interaction={guild_id:guild,member:{user:{id:actor}}};
const grant={entry:{id:1,guild,user,actor,kind:'grant',delta:500,reason:'活動獎勵'}};
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

const messageId='100000000000000004',applicationId='100000000000000005';
const reversal={entry:{id:2,guild,user,actor,kind:'reversal',delta:-500,reference:'1'}};
function fixture(){const values=new Map(),calls=[];const state={get:k=>structuredClone(values.get(k)),set:(k,v)=>values.set(k,structuredClone(v))};
  const bot={guild,channel,applicationId,send:async()=>{calls.push('send');return {kind:'sent',messageId};},removeMessage:async id=>{assert.equal(id,messageId);calls.push('delete');return {kind:'deleted'};}};
  return {bot,values,calls,create:()=>new GrantNotifications({bot,commandChannelIds:[channel],state})};}
test('committed reversal deletes its saved message across a restart and duplicate reversal is idempotent',async()=>{
  const f=fixture();await f.create().notify(interaction,grant,'request');assert.equal((await f.create().remove(interaction,reversal)).kind,'deleted');assert.equal((await f.create().remove(interaction,{...reversal,duplicate:true})).kind,'deleted');assert.deepEqual(f.calls,['send','delete']);
});
test('failed deletion can be retried without another financial operation; unrevoked and foreign grants cannot be deleted',async()=>{
  const f=fixture(),notices=f.create();await notices.notify(interaction,grant,'request');assert.equal((await notices.retry(interaction,1)).kind,'unavailable');
  for(const entry of [{...reversal.entry,kind:'grant'},{...reversal.entry,guild:user},{...reversal.entry,actor:user},{...reversal.entry,user:actor}])assert.equal((await notices.remove(interaction,{entry})).kind,'unavailable');
  f.bot.removeMessage=async()=>({kind:'retry'});assert.equal((await notices.remove(interaction,reversal)).kind,'retry');
  f.bot.removeMessage=async id=>{assert.equal(id,messageId);return {kind:'deleted'};};assert.equal((await f.create().retry(interaction,1)).kind,'deleted');assert.deepEqual(f.calls,['send']);
});
test('reversal waits for an in-flight notification; reversal before notification prevents the late ping',async()=>{
  const f=fixture(),notices=f.create();let release;f.bot.send=async()=>{await new Promise(resolve=>release=resolve);return {kind:'sent',messageId};};
  const sending=notices.notify(interaction,grant,'request');await new Promise(resolve=>setImmediate(resolve));const removing=notices.remove(interaction,reversal);release();await sending;assert.equal((await removing).kind,'deleted');
  const other=fixture();assert.equal((await other.create().remove(interaction,reversal)).kind,'legacy');assert.equal((await other.create().notify(interaction,grant,'request')).kind,'cancelled');assert.deepEqual(other.calls,[]);
});
test('unknown delivery or an old notice is never guessed; changed bot destinations cannot delete',async()=>{
  const f=fixture();f.bot.send=async()=>({kind:'uncertain'});await f.create().notify(interaction,grant,'request');assert.equal((await f.create().remove(interaction,reversal)).kind,'uncertain');assert.deepEqual(f.calls,[]);
  const other=fixture();await other.create().notify(interaction,grant,'request');other.bot.applicationId=user;assert.equal((await other.create().remove(interaction,reversal)).kind,'unavailable');assert.deepEqual(other.calls,['send']);
});
test('REST deletion verifies identity and treats 404 as success; rate limits remain retryable',async()=>{
  let status=204,calls=[],now=1000;
  const bot=new CasinoBot({guild,channel,applicationId,token:'private-fixture',clock:()=>now,fetchImpl:async(url,options)=>{calls.push([url,options.method]);
    if(url.endsWith('/users/@me'))return Response.json({id:applicationId,bot:true});if(url.endsWith('/channels/'+channel))return Response.json({id:channel,guild_id:guild,type:0});return status===429?Response.json({retry_after:2},{status}):new Response(null,{status});}});
  assert.equal((await bot.removeMessage(messageId)).kind,'deleted');assert.equal(calls.at(-1)[1],'DELETE');status=404;assert.equal((await bot.removeMessage(messageId)).kind,'deleted');status=429;assert.equal((await bot.removeMessage(messageId)).kind,'retry');const before=calls.length;await bot.removeMessage(messageId);assert.equal(calls.length,before);now+=2001;status=204;assert.equal((await bot.removeMessage(messageId)).kind,'deleted');
});
