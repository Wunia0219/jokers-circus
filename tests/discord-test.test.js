import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaytestService,discordTestPlayer,PLAYTEST_IDENTITY,slotTestState} from '../cloud/yakyuken-playtest-core.js';
import {assertDiscordTestApp,LIVE_APP,TEST_GUILD,TEST_CHANNEL} from '../cloud/discord-test-auth.js';
import {activityPath,slotEntryPath,slotLobbyPath} from '../src/platform/game-navigation.js';
import {TestWalletClient} from '../src/games/yakyuken/test-wallet-client.js';
import {connectDiscordTestActivity,testReauthorization} from '../src/platform/discord-test-activity.js';

const id=n=>'discord-test-request-'+String(n).padStart(8,'0');
function fixture(){
  let state=null,time=10000;const values=new Map();
  const repository={read:async()=>structuredClone(state),mutate:async(_,fn)=>{state=fn(structuredClone(state));return state;}};
  const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:async fn=>fn(storage)};
  const player=discordTestPlayer(TEST_GUILD,'100000000000000011');
  const create=()=>new PlaytestService({player,repository,storage,clock:()=>time,entropy:{getRandomValues:v=>{v[0]=0;}}});
  return {create,player,get state(){return state;},set time(v){time=v;}};
}
test('Discord test config refuses the shared live App, different guilds and different channels',()=>{
  const env={APP_ENV:'test',FIRESTORE_PROJECT_ID:PLAYTEST_IDENTITY.projectId,FIRESTORE_NAMESPACE:PLAYTEST_IDENTITY.namespace,DISCORD_TEST_ENABLED:'true',DISCORD_CLIENT_ID:'100000000000000003',DISCORD_TEST_GUILD_ID:TEST_GUILD,DISCORD_TEST_CHANNEL_ID:TEST_CHANNEL};
  assert.doesNotThrow(()=>assertDiscordTestApp(env));
  for(const bad of [{DISCORD_CLIENT_ID:LIVE_APP},{DISCORD_TEST_CHANNEL_ID:'100000000000000004'},{DISCORD_TEST_GUILD_ID:'100000000000000005'},{DISCORD_TEST_ENABLED:'false'},{APP_ENV:'production'}])assert.throws(()=>assertDiscordTestApp({...env,...bad}));
});
test('Discord navigation preserves launch context in both directions and excludes session/player impersonation parameters',()=>{
  const url=new URL('https://100000000000000003.discordsays.com/?frame_id=frame&instance_id=instance&platform=mobile&guild_id='+TEST_GUILD+'&channel_id='+TEST_CHANNEL+'&location_id=location&discord_shim=1&mobile_app_version=300.0&referrer_id=referrer&testPlayer=qa-a&token=secret&discord_proxy_ticket=private-ticket');
  const slot=slotEntryPath(url,true),lobby=slotLobbyPath(new URL(slot,url),true);
  assert.ok(slot.startsWith('/slot/?'));assert.ok(lobby.startsWith('/yakyuken-preview.html?'));assert.equal(new URL(slot,url).searchParams.get('channel_id'),TEST_CHANNEL);
  for(const value of [slot,lobby,activityPath(url,'/')]){const params=new URL(value,url).searchParams;assert.equal(params.get('frame_id'),'frame');assert.equal(params.get('discord_shim'),'1');assert.equal(params.get('location_id'),'location');assert.equal(params.get('mobile_app_version'),'300.0');assert.equal(params.get('referrer_id'),'referrer');assert.ok(!value.includes('secret'));assert.ok(!value.includes('testPlayer'));assert.ok(!params.has('discord_proxy_ticket'));}
  assert.equal(slotEntryPath(url,false),'/?lobby=preview');
});
test('one Discord wallet funds both games, shares daily claims and retains server slot results across restart',async()=>{
  const f=fixture(),s=f.create(),entry=await s.execute('begin',{requestId:id(1),characterId:'dealer'});assert.equal(entry.wallet.balance,9000);
  const claim=await s.execute('checkin',{requestId:id(2)});assert.equal(claim.wallet.balance,9500);
  const secondClaim=await s.execute('checkin',{requestId:id(3)});assert.equal(secondClaim.wallet.balance,9500);
  const spin=await s.execute('spin',{requestId:id(4),bet:100});assert.equal(spin.wallet.balance,9500+spin.round.net);assert.equal(spin.round.before,9500);
  assert.equal(slotTestState(spin.wallet,10000).spinCooldownMs,2000);assert.equal(slotTestState(spin.wallet,12000).spinCooldownMs,0);
  const replay=await f.create().execute('spin',{requestId:id(4),bet:100});assert.deepEqual(replay.round,spin.round);assert.equal(replay.wallet.balance,spin.wallet.balance);
  await s.execute('hand',{requestId:id(5),matchId:entry.matchId,move:'rock'});const won=await s.execute('hand',{requestId:id(6),matchId:entry.matchId,move:'rock'});
  assert.equal(won.wallet.balance,spin.wallet.balance+2500);assert.equal(won.wallet.records[0].net,1500);assert.equal(won.wallet.slotHistory.length,1);
  assert.equal(slotTestState(won.wallet).history[0].id,id(4));
});
test('test slot preserves the two-second cooldown and rejects client results or changed bets on old IDs',async()=>{
  const f=fixture(),s=f.create();await s.execute('spin',{requestId:id(10),bet:20});f.time=10500;
  await assert.rejects(()=>s.execute('spin',{requestId:id(11),bet:20}),e=>e.status===429&&e.code==='SPIN_COOLDOWN'&&e.retryAfterMs===1500);
  await assert.rejects(()=>s.execute('spin',{requestId:id(10),bet:100}),/其他操作/);
  await assert.rejects(()=>s.execute('spin',{requestId:id(12),bet:20,stops:[0,0,0,0,0]}),/欄位/);
  f.time=12000;await s.execute('spin',{requestId:id(13),bet:20});assert.equal(f.state.slotHistory.length,2);
});
test('Discord wallet client sends verified sessions without a player selector and renews the same pending request once',async()=>{
  const f=fixture(),s=f.create(),session={environment:'test',discordTest:true,guildId:TEST_GUILD,userId:'100000000000000011',token:'old-token'},calls=[];let renewals=0;
  const client=new TestWalletClient({session,storage:null,reauthorize:async()=>{renewals++;return {...session,token:'renewed-token'};},fetchImpl:async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body),auth:options.headers.Authorization});
    if(options.headers.Authorization==='Bearer old-token')return Response.json({error:'expired'},{status:401});
    return Response.json(await s.execute('begin',JSON.parse(options.body)));
  }});
  const data=await client.begin('dealer');assert.equal(data.wallet.balance,9000);assert.equal(renewals,1);assert.equal(calls.length,2);assert.equal(calls[0].body.requestId,calls[1].body.requestId);assert.ok(!calls[0].url.includes('player='));assert.equal(calls[1].auth,'Bearer renewed-token');
});

test('same activity restores a server-verified short-lived session across documents without another SDK handshake',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const location=new URL('https://100000000000000003.discordsays.com/?frame_id=frame&instance_id=instance&platform=desktop&guild_id='+TEST_GUILD+'&channel_id='+TEST_CHANNEL);
  const session={token:'opaque-test-session',environment:'test',discordTest:true,userId:'100000000000000011',guildId:TEST_GUILD,walletEpoch:'discord-test-v1',expiresAt:'2099-01-01T00:00:00Z'};
  let connects=0,status=200,user=session.userId;
  const options={location,storage,clientId:'100000000000000003',connect:async()=>{connects++;return {mode:'discord',sdk:{channelId:TEST_CHANNEL},session,access_token:'must-not-be-saved'};},fetchImpl:async(path,request)=>{assert.equal(path,'/api/session');assert.equal(request.headers.Authorization,'Bearer '+session.token);return Response.json({guild:TEST_GUILD,user,player:`d_${TEST_GUILD}_${user}`,name:'伺服器驗證的玩家'},{status});}};
  await connectDiscordTestActivity(options);assert.equal(connects,1);assert.ok(![...values.values()].join('').includes('must-not-be-saved'));
  const restored=await connectDiscordTestActivity({...options,location:new URL('/slot/'+location.search,location)});assert.equal(connects,1);assert.equal(restored.sdk,null);assert.equal(restored.user.id,session.userId);assert.equal(restored.user.username,'伺服器驗證的玩家');
  await assert.rejects(testReauthorization(restored),/關閉活動後重新啟動/);
  user='100000000000000012';await assert.rejects(()=>connectDiscordTestActivity(options),/身分不符/);assert.equal(values.size,0);
  user=session.userId;await connectDiscordTestActivity(options);status=401;await assert.rejects(()=>connectDiscordTestActivity(options),/登入已過期/);assert.equal(values.size,0);
  status=200;await connectDiscordTestActivity(options);const another=new URL(location);another.searchParams.set('frame_id','another-frame');await connectDiscordTestActivity({...options,location:another});assert.equal(values.size,2,'sessions cannot be reused across Discord frames');
});
