import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {WalletStore} from '../server/wallet/wallet.js';
import {FirestoreWalletStore} from '../server/firestore/wallet.js';
import {firestoreImportPlan,importFirestore} from '../server/firestore/import.js';
import {snapshotForCloud,decodeCloudArchive,restoreCloudSnapshot} from '../server/recovery/cloud-handoff.js';
import {setTimeout as delay} from 'node:timers/promises';
import {roundFromStops} from '../src/game/index.js';
import {QUOTA_LIMITS} from '../cloud/quota.js';
import {APP_VERSION} from '../src/version.js';
import {auditSnapshot} from '../cloud/snapshot.js';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8787');

test('real workerd supplies mobile audio byte ranges even when its static asset binding returns full files',async t=>{
 const bytes=new Uint8Array([0x49,0x44,0x33,1,2,3]);
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:process.env.TEST_CLOUD_BUNDLE||'test-results/cloud-bundle/worker.js',compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],serviceBindings:{ASSETS:async request=>{
   if(new URL(request.url).pathname.endsWith('.mp3')){assert.equal(request.headers.has('range'),false);return new MFResponse(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':'audio/mpeg','Content-Length':'6'}});}
   return new MFResponse('ordinary asset');
 }},outboundService:()=>{throw new Error('Audio test must not access external services');}}));
 t.after(()=>mf.dispose());
 const response=await mf.dispatchFetch('http://localhost/assets/music.mp3',{headers:{Range:'bytes=0-1'}});
 assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-1/6');assert.equal(response.headers.get('content-length'),'2');
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[0x49,0x44]);
 const head=await fetch(new URL('/assets/music.mp3',await mf.ready),{method:'HEAD'});
 assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'6');assert.equal(await head.text(),'');
 assert.equal(await (await mf.dispatchFetch('http://localhost/assets/main.js')).text(),'ordinary asset');
});

for(const casino of [false,true])test(`real workerd persists quotas/sessions, Discord API and recovery (${casino?'casino bot':'legacy webhook'})`,async t=>{
 const root=resolve('test-results/cloud-runtime');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'case-')),guild='100000000000000001',user='100000000000000002',client='100000000000000003',namespace='runtime-'+randomUUID()+'-test';
 const source=join(dir,'source.sqlite'),local=new WalletStore({filename:source,environment:'test',guildIds:[guild],clock:()=>Date.now()-86400000,spinDelay:0});local.checkin(guild,user);local.spin(guild,user,20,'runtime-original-spin-0001');local.close();
 const settings={projectId:'demo-jokers-circus',environment:'test',namespace,schemaVersion:2,emulator:process.env.FIRESTORE_EMULATOR_HOST,quota:{filename:join(dir,'sdk-quota.sqlite'),projectId:'demo-jokers-circus'}};
 const sdk=new FirestoreWalletStore(settings,{guildIds:[guild]});t.after(()=>sdk.close());const plan=firestoreImportPlan(source,'test',{version:2});await importFirestore(sdk,plan);
 const rsa=generateKeyPairSync('rsa',{modulusLength:2048}),ed=generateKeyPairSync('ed25519'),key=randomBytes(32).toString('hex'),admin=randomBytes(32).toString('hex'),replies=[],announcements=[];let metadataReads=0;
 const operatorToken=randomBytes(32).toString('hex'),operatorHeaders={Authorization:'Bearer '+operatorToken};
 const config={modules:true,scriptPath:process.env.TEST_CLOUD_BUNDLE||'test-results/cloud-bundle/worker.js',compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{CIRCUS_PROJECT:{className:'CircusProject',useSQLite:true}},resourcePersistencePath:join(dir,'durable'),bindings:{CLOUD_PLAN:'free',APP_ENV:'test',FIRESTORE_PROJECT_ID:settings.projectId,FIRESTORE_NAMESPACE:namespace,DISCORD_CLIENT_ID:client,DISCORD_CLIENT_SECRET:'isolated-fixture-secret',DISCORD_HIGHLIGHTS_WEBHOOK_URL:'https://discord.com/api/webhooks/100000000000000005/isolated-fake-webhook',DISCORD_PUBLIC_KEY:ed.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'),ALLOWED_GUILD_IDS:guild,CLOUD_ADMIN_TOKEN:admin,CLOUD_ENCRYPTION_KEY:key,GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:settings.projectId,client_email:'fixture@example.invalid',private_key:rsa.privateKey.export({format:'pem',type:'pkcs8'})})},outboundService:async request=>{
   const u=new URL(request.url);if(u.hostname==='oauth2.googleapis.com')return MFResponse.json({access_token:'emulator-only',expires_in:3600});
   if(u.hostname==='firestore.googleapis.com'||u.hostname==='firestore.asia-east1.rep.googleapis.com'){assert.ok(u.pathname.includes('/projects/demo-jokers-circus/'));const body=await request.text();if(JSON.parse(body).documents?.some(name=>name.endsWith('/meta/state')))metadataReads++;const r=await fetch('http://127.0.0.1:8787'+u.pathname+u.search,{method:request.method,headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body});return new MFResponse(await r.text(),{status:r.status,headers:{'Content-Type':'application/json'}});}
   if(request.url==='https://discord.com/api/oauth2/token')return MFResponse.json({access_token:'fixture-oauth-secret',scope:'identify guilds.members.read',expires_in:3600});
   if(u.pathname==='/api/v10/users/@me')return MFResponse.json(request.headers.get('authorization')?.startsWith('Bot ')?{id:client,bot:true}:{id:user,username:'isolated-runtime-test'});
   if(u.pathname==='/api/v10/channels/100000000000000006')return MFResponse.json({id:'100000000000000006',guild_id:guild,type:0});
   if(u.pathname==='/api/v10/channels/100000000000000006/messages'){
     if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
       const form=await request.formData(),file=form.get('files[0]');
       const payload=JSON.parse(form.get('payload_json'));
       assert.match(file.name,/^(?:casino-receipt|(?:big|super|mega)-win)\.png$/);assert.equal(file.type,'image/png');
       assert.equal(Buffer.from(await file.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
       assert.equal(payload.embeds[0].image.url,'attachment://'+file.name);
       assert.match(payload.attachments[0].description,file.name==='casino-receipt.png'
         ? /^這次獲得 [+−]?[\d,]+ 戲籌 · 總遊玩 [\d,]+ 局$/ : /^(?:BIG|SUPER|MEGA) WIN · [\d,.]+×，單局獎金倍率$/);
       announcements.push(payload);
     }else announcements.push(await request.json());
     return MFResponse.json({id:'100000000000000007',channel_id:'100000000000000006'});
   }
   if(u.pathname===`/api/v10/users/@me/guilds/${guild}/member`)return MFResponse.json({user:{id:user,bot:false},pending:false});
   if(u.pathname==='/api/webhooks/100000000000000005/isolated-fake-webhook'){if(request.method==='GET')return MFResponse.json({type:1,guild_id:guild,channel_id:'100000000000000006'});announcements.push(await request.json());return MFResponse.json({id:'100000000000000007'});}
   if(u.pathname.endsWith('/messages/@original')&&request.method==='PATCH'){replies.push(await request.json());return MFResponse.json({});}
   throw new Error('Unapproved external request in test');
 }};
 if(casino){
  Object.assign(config.bindings,{CLOUD_PLAN:'paid',DISCORD_HIGHLIGHTS_WEBHOOK_URL:'',DISCORD_CASINO_ENABLED:'true',DISCORD_CASINO_CHANNEL_ID:'100000000000000006',DISCORD_COMMAND_CHANNEL_IDS:'100000000000000006',DISCORD_BOT_TOKEN:'isolated-bot-token-not-real-0000000000',ARCADE_RELEASE_ENABLED:'true',ARCADE_CG_PREVIEW_ALL:'true',ARCADE_OPERATOR_IDS:user,ARCADE_CONSOLE_TOKEN:operatorToken});
  const directory=join(dir,'assets');
  mkdirSync(join(directory,'arcade','feature','assets'),{recursive:true});
  for(const path of ['index.html','arcade/lobby.html','arcade/feature/play.html','arcade/feature/cover.webp','arcade/feature/assets/character.webp'])
    writeFileSync(join(directory,path),'/'+path);
  config.assets={directory,binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true},
    assetConfig:{html_handling:'none',not_found_handling:'none'}};
 }else Object.assign(config.bindings,{ARCADE_CONSOLE_TOKEN:operatorToken,DISCORD_COMMAND_PROFILE:'test-simple'});
 const adminRole='100000000000000009';
 config.bindings[casino?'CHIP_ADMIN_ROLE_IDS':'ADMIN_ROLE_IDS']=` ${adminRole} `;
 config.bindings.FIRESTORE_ENDPOINT='https://firestore.asia-east1.rep.googleapis.com';
 const monitorToken=randomBytes(32).toString('hex');config.bindings.CLOUD_MONITOR_TOKEN=monitorToken;
 let mf=new Miniflare(convertV4MiniflareOptions(config));t.after(()=>mf.dispose());const call=async(path,{body,token,adminAuth=false,headers={},method}={})=>{const r=await mf.dispatchFetch('http://localhost'+path,{method:method||(body?'POST':'GET'),headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(adminAuth?{Authorization:'Bearer '+admin}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();return {status:r.status,data};};
 assert.equal((await call('/api/wallet')).status,503);assert.equal((await call('/__ops/status')).status,403);
 const operatorPage=await mf.dispatchFetch('http://localhost/operator');
 assert.equal(operatorPage.status,200);
 assert.equal((await call('/__operator/status')).status,401);
 {
   assert.equal(operatorPage.headers.get('cache-control'),'no-store');
   assert.match(operatorPage.headers.get('content-security-policy'),/frame-ancestors 'none'/);
   const markup=await operatorPage.text();
   assert.match(markup,/營運後台/);
   assert.ok(!markup.includes(operatorToken));
   assert.doesNotMatch(markup,/野球拳|\/arcade\/feature\//);
   assert.equal((await call('/__operator/status',{adminAuth:true})).status,401);
   assert.equal((await call('/__operator/status',{headers:{...operatorHeaders,Origin:'https://untrusted.invalid'}})).status,403);
   assert.equal((await call('/__ops/pause',{headers:operatorHeaders,body:{}})).status,403);
   assert.equal((await call('/__operator/status',{headers:operatorHeaders})).data.ready,false);
 }
 assert.equal((await call('/healthz')).data.version,APP_VERSION);
 const monitorHeaders={Authorization:'Bearer '+monitorToken};
 const beforeSeed=await call('/__ops/status',{headers:monitorHeaders});assert.equal(beforeSeed.status,200);assert.equal(beforeSeed.data.mode,'unseeded');assert.equal(beforeSeed.data.operations.ok,false);
 for(const path of ['/__ops/seed','/__ops/pause','/__ops/activate','/__ops/backup','/__ops/archive','/__ops/export','/__ops/verify','/__ops/status','/__ops/quota-limits','/__ops/quota-policy','/__ops/settlement-policy'])assert.equal((await call(path,{body:{},headers:monitorHeaders})).status,403,path+' is not authorized by a monitor token');
 const snapshot=snapshotForCloud(source,'test',{upstreamImportFingerprint:plan.fingerprint}),quota={projectId:settings.projectId,exportedAt:Date.now(),scopes:Object.fromEntries(Object.entries(QUOTA_LIMITS).map(([k,v])=>[k,{limits:{...v},growth:300,usage:[{slot:Math.floor(Date.now()/60000)*60000,reads:37,writes:k==='maintenance'?0:13,egressBytes:3}],documents:[]}]))};
 if(casino)quota.scopes.global.usage[0].writes=20000;
 const seeded=await call('/__ops/seed',{adminAuth:true,body:{projectId:settings.projectId,namespace,writersStopped:true,snapshot,quota}});assert.equal(seeded.status,200,JSON.stringify(seeded));assert.equal((await call('/__ops/seed',{adminAuth:true,body:{}})).status,409);
 const aggregate=await call('/__ops/status',{headers:monitorHeaders});assert.equal(aggregate.data.version,APP_VERSION);assert.deepEqual(Object.keys(aggregate.data.quota.scopes).sort(),['highlights','maintenance']);assert.equal(aggregate.data.quota.used.reads,37,'private status does not consume Firestore quota');
 assert.equal((await call('/__ops/quota-limits',{body:{reads:50000,writes:20000}})).status,403);
 assert.equal((await call('/__ops/quota-limits',{adminAuth:true,body:{reads:50000,writes:20001}})).status,409);
 const raised=await call('/__ops/quota-limits',{adminAuth:true,body:{reads:50000,writes:20000}});
 assert.equal(raised.status,200);assert.equal(raised.data.limits.writes,20000);assert.deepEqual(raised.data.used,aggregate.data.quota.used);
 if(casino){
  assert.equal((await call('/__ops/quota-policy',{body:{mode:'notify-only',allowPaidUsage:true}})).status,403);
  assert.equal((await call('/__ops/quota-policy',{adminAuth:true,body:{mode:'notify-only'}})).status,409);
  const policy=await call('/__ops/quota-policy',{adminAuth:true,body:{mode:'notify-only',allowPaidUsage:true}});
  assert.equal(policy.status,200);assert.equal(policy.data.enforcement,'notify-only');assert.equal(policy.data.used.writes,20000);assert.equal(policy.data.blocked,false);
 }
 if(casino)assert.equal((await call('/__ops/activate',{adminAuth:true,body:{writersStopped:true,freePlanVerified:true}})).status,409,'Free-only confirmation cannot activate a Paid deployment');
 const activation={writersStopped:true,planVerified:true,plan:config.bindings.CLOUD_PLAN};
 assert.equal((await call('/__ops/activate',{adminAuth:true,body:activation})).status,200);assert.equal((await call('/readyz')).status,200);
 assert.equal((await call('/__ops/status',{headers:monitorHeaders})).data.cloudPlan,config.bindings.CLOUD_PLAN);
 if(casino){
  assert.equal((await call('/__ops/settlement-policy',{body:{compactSettlements:true}})).status,403);
  assert.equal((await call('/__ops/settlement-policy',{adminAuth:true,body:{}})).status,409);
  const policy=await call('/__ops/settlement-policy',{adminAuth:true,body:{compactSettlements:true}});assert.equal(policy.status,200,JSON.stringify(policy));assert.equal(policy.data.compactSettlements,true);
 }
 const login=await call('/api/token',{body:{code:'fixture-code',guildId:guild}});assert.equal(login.status,200,JSON.stringify(login));const token=login.data.session.token;assert.equal((await call('/api/wallet',{token,headers:{origin:'https://untrusted.invalid'}})).status,403);assert.equal((await call('/api/wallet')).status,401);
 assert.equal((await call('/api/wallet',{token})).data.state.balance,snapshot.tables.wallets[0].balance);
 if(casino){
   assert.deepEqual((await call('/api/arcade')).data,{slot:'open',revision:0});
   assert.equal((await call('/api/feature/state',{token})).status,404);
   assert.equal((await call('/api/feature/begin',{token,body:{characterId:'dealer',requestId:randomUUID()}})).status,404);
   for(const path of ['/arcade/feature/play.html','/arcade/%66eature/cover.webp','/arcade/feature/assets/character.webp']){
     const hidden=await mf.dispatchFetch('http://localhost'+path);assert.equal(hidden.status,404,path);
   }
   const lobby=await mf.dispatchFetch('http://localhost/?frame_id=fixture');
   assert.equal(await lobby.text(),'/arcade/lobby.html');
   assert.match(lobby.headers.get('content-security-policy'),/frame-src 'self'/);
   assert.equal(await (await mf.dispatchFetch('http://localhost/arcade/slot')).text(),'/index.html');
 }else{
   const web=(action,body)=>call('/__operator/'+action,{headers:operatorHeaders,body});
   assert.deepEqual((await web('status')).data.entry,{slot:'open',revision:0});
   assert.equal((await call('/api/arcade')).status,404);
   assert.equal((await web('entry',{game:'feature',mode:'open',revision:0})).status,400);
   assert.equal((await web('report',{guild,player:user,code:'D-runtime-original-spin-0001'})).status,400);
   assert.equal((await web('entry',{game:'slot',mode:'maintenance',revision:0})).data.entry.slot,'maintenance');
   assert.deepEqual((await call('/game-entry.json?controls=1')).data,{mode:'maintenance',previewUserIds:[]});
   assert.equal((await call('/game-entry.json')).data.mode,'open','old tabs rely on the settlement gate');
   assert.equal((await call('/api/spin',{token,body:{bet:20,requestId:'closed-new-spin-request-0001'}})).data.code,'SLOT_MAINTENANCE');
   assert.equal((await call('/api/spin',{token,body:{bet:20,requestId:'runtime-original-spin-0001'}})).data.duplicate,true);
   assert.equal((await web('entry',{game:'slot',mode:'open',revision:1})).data.entry.slot,'open');
 }
 const visitId=randomUUID();
 let arcadeReplies=0;
 const beginDuel={characterId:'dealer',requestId:randomUUID()},winningHand={matchId:beginDuel.requestId,move:'rock',handIndex:1,requestId:randomUUID()};
 if(casino){
   assert.equal(login.data.session.casinoNotifications,true);
   assert.equal((await call('/api/casino-visit',{token,body:{action:'enter',instanceId:visitId}})).data.active,true);
   const before=(await call('/__ops/status',{headers:monitorHeaders})).data.quota.used.reads;
   assert.equal((await call('/api/casino-visit',{token,body:{action:'heartbeat',instanceId:visitId}})).data.active,true);
   assert.equal((await call('/__ops/status',{headers:monitorHeaders})).data.quota.used.reads,before,'visit heartbeats do not read Firestore');
 }
 const retry=await call('/api/spin',{token,body:{bet:20,requestId:'runtime-original-spin-0001'}});assert.equal(retry.data.duplicate,true);assert.deepEqual(retry.data.round,JSON.parse(snapshot.tables.rounds[0].data));
 const checkin=await call('/api/checkin',{token,body:{}});assert.equal(checkin.status,200);assert.equal((await call('/api/checkin',{token,body:{}})).data.duplicate,true);
 const spin=await call('/api/spin',{token,body:{bet:20,requestId:'runtime-new-spin-request-0002'},headers:{'x-wallet-view':'compact-v1'}});assert.equal(spin.status,200,JSON.stringify(spin));
 if(casino)assert.equal(spin.data.round.recordCode,'P000001');
 if(casino){const current=(await call('/__ops/status',{headers:monitorHeaders})).data;assert.ok(current.quota.used.writes>20000);assert.equal(current.quota.enforcement,'notify-only');assert.equal(current.quota.scopes.highlights.enforcement,'notify-only');assert.deepEqual(current.operations.alerts.filter(alert=>alert.code.startsWith('QUOTA_')),[],'paid usage is still recorded beyond the free allowance without threshold alerts');}
 const statusWithoutMeasurements=await call('/__ops/status?database=info',{adminAuth:true});assert.equal(statusWithoutMeasurements.status,200);assert.equal('spinTiming' in statusWithoutMeasurements.data,false);assert.equal('database' in statusWithoutMeasurements.data,false);
 if(casino){
   for(let i=0;i<150&&!announcements.some(p=>p.content?.includes('**入場**'));i++)await delay(100);
   assert.ok(announcements.some(p=>p.content?.includes('**入場**')),'initial maintenance has run before the cold-restart recovery case');
 }
 sdk.highlightsGuild=guild;sdk.spinDelay=0;const examples=JSON.parse(readFileSync('docs/data/math-report.json','utf8')).examples;
 const forcedTier=casino?'big':'mega';
 const forced=await sdk.transact(guild,user,{kind:'spin',requestId:randomUUID(),fingerprint:'20',bet:20,outcome:roundFromStops(20,examples[forcedTier].stops),roundId:randomUUID()},{compact:true,profileName:'isolated announcement fixture'});
 await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config));const after=await call('/api/wallet',{token});assert.equal(after.status,200,JSON.stringify(after));assert.equal(after.data.state.balance,forced.state.balance);assert.equal((await call('/api/spin',{token,body:{bet:20,requestId:'runtime-new-spin-request-0002'}})).data.duplicate,true);
 assert.equal((await call('/__ops/status',{headers:monitorHeaders})).data.quota.limits.writes,20000,'explicit limits persist across workerd restart');
 assert.equal((await call('/api/interactions',{body:{type:1}})).status,401);
 const interaction={type:2,id:'100000000000000004',application_id:client,guild_id:guild,channel_id:'100000000000000006',token:'fixture-interaction-token',member:{user:{id:user,bot:false},permissions:'0'},data:{name:'戲籌'}},raw=JSON.stringify(interaction),timestamp=String(Math.floor(Date.now()/1000)),signature=sign(null,Buffer.from(timestamp+raw),ed.privateKey).toString('hex');
 const r=await mf.dispatchFetch('http://localhost/api/interactions',{method:'POST',headers:{'x-signature-timestamp':timestamp,'x-signature-ed25519':signature,'Content-Type':'application/json'},body:raw});assert.deepEqual(await r.json(),{type:5,data:{flags:64}});
 if(!casino){
  const signed=async payload=>{const body=JSON.stringify(payload);return (await mf.dispatchFetch('http://localhost/api/interactions',{method:'POST',headers:{'x-signature-timestamp':timestamp,'x-signature-ed25519':sign(null,Buffer.from(timestamp+body),ed.privateKey).toString('hex'),'Content-Type':'application/json'},body})).json();};
  const member={...interaction.member,roles:[adminRole]};
  const component=custom_id=>({...interaction,type:3,member,data:{custom_id}});
  const panel=await signed(component(`jct|home|${guild}|${user}`));
  const buttons=panel.data.components.flatMap(row=>row.components);
  assert.ok(buttons.length&&buttons.every(button=>button.custom_id?.startsWith('jct|')));
  assert.ok(!buttons.some(button=>/遊戲營運|查詢玩家回報/.test(button.label)));
  const stale=await signed(component(`jc|gf|${guild}|${user}`));
  assert.equal(stale.type,4);assert.equal(stale.data.embeds[0].title,'請重新開啟面板');
  const fresh=await signed(component(`jct|gf|${guild}|${user}`));
  assert.equal(fresh.type,9);assert.equal(fresh.data.components.length,3,'test grant form has no public notification option');
  for(let i=0;i<100&&!replies.length;i++)await delay(30);
  assert.match(replies[0].embeds[0].description,new RegExp(forced.state.balance.toLocaleString('en-US')+' 戲籌'),'Discord reads the same balance as the game');
 }
 if(casino){
  const formId=String((BigInt(Date.now())-1420070400000n)<<22n),grant={...interaction,type:5,id:formId,member:{...interaction.member,roles:[adminRole]},data:{custom_id:`jc|gs|${guild}|${user}|${formId}`,components:[
   {type:18,component:{type:5,custom_id:'member',values:[user],resolved:{members:{[user]:{}},users:{[user]:{id:user,bot:false}}}}},
   {type:18,component:{type:4,custom_id:'amount',value:'500'}},{type:18,component:{type:4,custom_id:'reason',value:'活動獎勵'}},{type:18,component:{type:3,custom_id:'notify',values:['yes']}},
  ]}};
  const sendGrant=async()=>{const body=JSON.stringify(grant),ts=String(Math.floor(Date.now()/1000));return (await mf.dispatchFetch('http://localhost/api/interactions',{method:'POST',headers:{'x-signature-timestamp':ts,'x-signature-ed25519':sign(null,Buffer.from(ts+body),ed.privateKey).toString('hex'),'Content-Type':'application/json'},body})).json();};
  assert.deepEqual(await sendGrant(),{type:5,data:{flags:64}});
  for(let i=0;i<150&&!replies.some(p=>p.embeds?.[0]?.title==='戲籌已發放');i++)await delay(100);
  const delivered=replies.find(p=>p.embeds?.[0]?.title==='戲籌已發放');assert.ok(delivered);assert.match(delivered.embeds[0].description,/已在遊玩文字頻道發送通知/);assert.deepEqual(delivered.allowed_mentions,{parse:[]});
  const notices=()=>announcements.filter(p=>p.embeds?.[0]?.title==='戲籌已發放');assert.equal(notices().length,1);assert.match(notices()[0].content,/500 戲籌/);assert.deepEqual(notices()[0].allowed_mentions,{parse:[],users:[user]});
  const launchButton=notices()[0].components.at(-1).components[0];
  assert.equal(launchButton.label,'開啟遊戲');
  const launchRaw=JSON.stringify({...interaction,type:3,data:{component_type:2,custom_id:launchButton.custom_id}});
  const launchTimestamp=String(Math.floor(Date.now()/1000));
  const launchSignature=sign(null,Buffer.from(launchTimestamp+launchRaw),ed.privateKey).toString('hex');
  const launchReply=await mf.dispatchFetch('http://localhost/api/interactions',{method:'POST',
    headers:{'x-signature-timestamp':launchTimestamp,'x-signature-ed25519':launchSignature,'Content-Type':'application/json'},body:launchRaw});
  assert.deepEqual(await launchReply.json(),{type:12});
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config));
  assert.deepEqual(await sendGrant(),{type:5,data:{flags:64}});
  for(let i=0;i<150&&!replies.some(p=>p.embeds?.[0]?.title==='這筆已經發放過');i++)await delay(100);
  assert.ok(replies.some(p=>p.embeds?.[0]?.title==='這筆已經發放過'));assert.equal(notices().length,1);
  const signed=async interaction=>{
   const body=JSON.stringify(interaction),ts=String(Math.floor(Date.now()/1000));
   return (await mf.dispatchFetch('http://localhost/api/interactions',{method:'POST',headers:{'x-signature-timestamp':ts,'x-signature-ed25519':sign(null,Buffer.from(ts+body),ed.privateKey).toString('hex'),'Content-Type':'application/json'},body})).json();
  };
  const component=custom_id=>({...interaction,type:3,id:String((BigInt(Date.now())-1420070400000n)<<22n),
    message:{flags:64},member:{...interaction.member,roles:[adminRole]},data:{custom_id}});
  const panelPrefix=`jc|`,panelSuffix=`|${guild}|${user}`;
  const click=(action,args='')=>signed(component(panelPrefix+action+panelSuffix+args));
  const change=async(game,mode,revision)=>{
    const confirm=await click('ap',`|${game}|${mode}|${revision}`);
    const id=confirm.data.components[0].components[0].custom_id;
    const before=replies.length;
    assert.deepEqual(await signed(component(id)),{type:6});
    for(let i=0;i<100&&replies.length===before;i++)await delay(30);
    assert.equal(replies.length,before+1);
    assert.equal(replies.at(-1).embeds[0].title,'遊戲營運');
    arcadeReplies++;
  };
  await change('f','o',0);
  const stale=await click('ap','|f|o|0');
  assert.equal(stale.data.embeds[0].title,'營運狀態已更新');
  assert.equal((await call('/api/feature/state')).status,401);
  const cgPreview=await call('/api/feature/state',{token});
  assert.equal(cgPreview.data.previewAllCG,true);
  assert.deepEqual(cgPreview.data.wallet.unlocks,{});
  assert.deepEqual((await sdk.duelState(guild,user)).wallet.unlocks,{});
  assert.equal(await (await mf.dispatchFetch('http://localhost/arcade/feature/cover.webp')).text(),'/arcade/feature/cover.webp');
  const original=await sdk.duelAction(guild,user,'begin',beginDuel,{allowNew:()=>true,makePlan:()=>['win','win']});
  const replay=await call('/api/feature/begin',{token,body:beginDuel});
  assert.equal(replay.data.duplicate,true);assert.deepEqual(replay.data.entry,original.entry);assert.equal(replay.data.entry.delta,-1000);
  assert.deepEqual(replay.data.nextHand,{matchId:beginDuel.requestId,index:0});
  assert.equal(replay.data.plan,undefined);
  assert.equal((await call('/api/wallet',{token})).data.state.balance,replay.data.wallet.balance);
  const watching=call('/api/arcade?after=1');
  await change('m','m',1);
  const notified=await watching;
  assert.equal(notified.status,200);assert.equal(notified.data.revision,2);
  assert.equal(notified.data.feature.mode,'maintenance');assert.equal(notified.data.slot,'open');
  await change('s','m',2);
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config));
  const persisted=(await call('/api/arcade')).data;
  assert.equal(persisted.feature.mode,'maintenance');assert.equal(persisted.slot,'maintenance');
  assert.equal((await call('/api/spin',{token,body:{bet:20,requestId:randomUUID()}})).data.code,'SLOT_MAINTENANCE');
  assert.equal((await call('/api/spin',{token,body:{bet:20,requestId:'runtime-new-spin-request-0002'}})).data.duplicate,true);
  const first={...winningHand,handIndex:0,requestId:randomUUID()};
  assert.equal((await call('/api/feature/hand',{token,body:first})).data.code,'DUEL_MAINTENANCE');
  assert.equal((await call('/api/feature/leave',{token,body:{matchId:beginDuel.requestId,requestId:randomUUID()}})).data.code,'DUEL_MAINTENANCE');
  assert.equal((await call('/api/feature/begin',{token,body:{...beginDuel,requestId:randomUUID()}})).data.code,'DUEL_MAINTENANCE');
  assert.equal((await call('/api/feature/begin',{token,body:beginDuel})).data.duplicate,true);
  const web=(action,body)=>call('/__operator/'+action,{headers:operatorHeaders,body});
  assert.equal((await web('entry',{game:'feature',mode:'hidden',revision:3})).data.entry.featureMaintenance,'maintenance');
  assert.equal((await call('/api/arcade')).data.feature,undefined);
  assert.equal((await call('/api/feature/hand',{token,body:first})).status,404);
  assert.equal((await web('entry',{game:'feature',mode:'open',revision:4})).data.entry.featureMaintenance,'maintenance');
  assert.equal((await web('entry',{game:'featureMaintenance',mode:'open',revision:5})).data.entry.slot,'maintenance');
  assert.equal((await call('/api/feature/hand',{token,body:first})).data.entry.delta,0);
  assert.equal((await call('/api/feature/hand',{token,body:{...first,requestId:randomUUID()}})).data.code,'DUEL_HAND');
  const paid=await call('/api/feature/hand',{token,body:winningHand});
  assert.equal(paid.data.entry.delta,2500);
  assert.deepEqual((await call('/api/feature/hand',{token,body:winningHand})).data.entry,paid.data.entry);
  assert.equal((await call('/api/wallet',{token})).data.state.balance,paid.data.wallet.balance);
  assert.equal((await call('/api/feature/checkin',{token,body:{day:new Date(Date.now()+8*3600000).toISOString().slice(0,10)}})).data.duplicate,true);
  const query=component(panelPrefix+'ws'+panelSuffix);
  const before=replies.length;
  assert.deepEqual(await signed({...query,type:5,data:{...query.data,components:[
    {type:18,component:{type:5,custom_id:'member',values:[user],resolved:{members:{[user]:{}},users:{[user]:{id:user,bot:false}}}}},
    {type:18,component:{type:4,custom_id:'code',value:'D-'+winningHand.requestId}},
  ]}}),{type:5,data:{flags:64}});
  for(let i=0;i<100&&replies.length===before;i++)await delay(30);
  assert.match(replies.at(-1).embeds[0].description,/已確認/);
  arcadeReplies++;
  const status=await web('status');
  assert.deepEqual(status.data.guilds,[guild]);
  const revision=status.data.entry.revision;
  assert.equal((await web('entry',{game:'slot',mode:'open',revision:revision-1})).status,409);
  assert.equal((await web('entry',{game:'slot',mode:'open',revision})).data.entry.slot,'open');
  assert.equal((await web('entry',{game:'slot',mode:'maintenance',revision:revision+1})).data.entry.slot,'maintenance');
  const spinReport={guild,player:user,code:'S-runtime-original-spin-0001'};
  const wager=await web('report',spinReport);
  assert.equal(wager.data.status,'committed');
  assert.equal(wager.data.payout,retry.data.round.payout);
  assert.equal((await web('report',{...spinReport,player:client})).data.status,'unconfirmed');
  assert.equal((await web('report',{...spinReport,guild:client})).status,400);
  const duelReport=await web('report',{guild,player:user,code:'D-'+winningHand.requestId});
  assert.equal(duelReport.data.delta,2500);
  assert.equal((await call('/api/wallet',{token})).data.state.balance,paid.data.wallet.balance,'lookup never changes the wallet');
 }
 const resetId='100000000000000008',resetInteraction={...interaction,id:resetId,member:{...interaction.member,permissions:'0',roles:[adminRole]},data:{name:'戲籌管理',options:[{name:'重設戲籌',options:[{name:'確認',value:true}]}]}};
 const resetRaw=JSON.stringify(resetInteraction),resetSignature=sign(null,Buffer.from(timestamp+resetRaw),ed.privateKey).toString('hex');
 const resetReply=await mf.dispatchFetch('http://localhost/api/interactions',{method:'POST',headers:{'x-signature-timestamp':timestamp,'x-signature-ed25519':resetSignature,'Content-Type':'application/json'},body:resetRaw});assert.deepEqual(await resetReply.json(),{type:5,data:{flags:64}});
 assert.equal((await call('/__ops/pause',{adminAuth:true,body:{}})).status,200);assert.equal(replies.length,(casino?4:2)+arcadeReplies);assert.equal(replies.at(-1).embeds[0].title,'戲籌已重設');assert.match(replies.at(-1).embeds[0].fields[0].value,new RegExp((forced.state.balance+(casino?2000:0)).toLocaleString('en-US')+' → 10,000'));assert.equal((await call('/api/checkin',{token,body:{}})).status,503);
 for(let i=0;i<20;i++){const b=await call('/__ops/backup',{adminAuth:true,body:{}});assert.equal(b.status,200,JSON.stringify(b));if(i===0)await sdk.grant(guild,user,user,7,'concurrent readTime fixture',randomUUID());if(b.data.complete)break;if(i===19)assert.fail('Backup did not finish');}
 assert.equal((await call('/__ops/export',{adminAuth:true,body:{}})).status,409,'backup readTime excludes later progress, so export is refused');
 for(let i=0;i<20;i++){const b=await call('/__ops/backup',{adminAuth:true,body:{}});assert.equal(b.status,200);if(b.data.complete)break;if(i===19)assert.fail('Latest backup did not finish');}
 assert.equal((await call('/__ops/activate',{adminAuth:true,body:activation})).status,200);
 const hasWin=()=>announcements.some(p=>casino?p.embeds?.[0]?.image?.url==='attachment://big-win.png':p.embeds?.[0]?.title?.includes('MEGA WIN'));
 for(let i=0;i<150&&!hasWin();i++)await delay(100);
 assert.ok(hasWin(),'durable alarm recovers outbox without enqueue hint');
 if(casino){
   const big=announcements.find(p=>p.embeds?.[0]?.image?.url==='attachment://big-win.png');
   assert.match(big.attachments[0].description,/^BIG WIN · [\d,.]+×，單局獎金倍率$/);
   assert.equal(big.components[0].components[0].style,1);
   const previousBackup=(await call('/__ops/status',{headers:monitorHeaders})).data.backup.at;
   const started=await call('/__operator/backup',{headers:operatorHeaders,body:{}});
   assert.equal(started.status,200);assert.equal(started.data.backup.running,true);
   const metadataBeforeContinuation=metadataReads;
   await call('/api/casino-visit',{token,body:{action:'leave',instanceId:visitId}});
   for(let i=0;i<150&&!announcements.some(p=>p.content?.includes('離開賭場'));i++)await delay(100);
   assert.equal(announcements.filter(p=>p.content?.includes('**入場**')).length,1);
   const exits=announcements.filter(p=>p.content?.includes('離開賭場'));assert.equal(exits.length,1);assert.equal(exits[0].embeds[0].title,'離場結算');
   assert.ok(announcements.every(p=>p.enforce_nonce===true&&!('flags' in p)));
   for(const announcement of announcements){assert.ok(announcement.content.includes(`<@${user}>`));assert.deepEqual(announcement.allowed_mentions,{parse:[],users:[user]});}
   const deadline=Date.now()+90000;let completed;
   do{completed=(await call('/__ops/status',{headers:monitorHeaders})).data.backup;if(completed.at>previousBackup)break;await delay(250);}while(Date.now()<deadline);
   assert.ok(completed.at>previousBackup,'short casino alarms must continue an active backup without waiting ten minutes');
   assert.ok(metadataReads-metadataBeforeContinuation<=1,'backup checkpoints must not repeat metadata housekeeping on every alarm');
   const checked=await call('/__operator/verify-backup',{headers:operatorHeaders,body:{}});
   assert.deepEqual(checked.data,{verified:true,at:completed.at});
 }
 assert.equal((await call('/__ops/pause',{adminAuth:true,body:{}})).status,200);
 for(let i=0;i<20;i++){const b=await call('/__ops/backup',{adminAuth:true,body:{}});assert.equal(b.status,200);if(i===0){await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config));}if(b.data.complete)break;if(i===19)assert.fail('Resumed backup did not finish');}
 const verification=await call('/__ops/verify',{adminAuth:true,body:{}});assert.equal(verification.status,200,JSON.stringify(verification));assert.equal(verification.data.readOnly,true);
 const archive=await call('/__ops/archive',{adminAuth:true,body:{}});assert.equal(archive.status,200);assert.equal(archive.data.released,false);assert.equal(decodeCloudArchive(archive.data.archive,key,'test').tables.rounds.length,3);
 const manifestPage=await call('/__ops/archive-manifest',{adminAuth:true,body:{}});assert.equal(manifestPage.status,200);const m=manifestPage.data.archive.manifest,download=[];
 for(let start=0;start<m.parts;start+=2){const page=await call('/__ops/archive-page',{adminAuth:true,body:{generation:m.generation,start,limit:2}});assert.equal(page.status,200);assert.equal(page.data.sha256,m.sha256);download.push(...page.data.chunks);}
 assert.deepEqual(decodeCloudArchive({manifest:m,chunks:download},key,'test'),decodeCloudArchive(archive.data.archive,key,'test'));
 assert.equal((await call('/__ops/archive-page',{adminAuth:true,body:{generation:m.generation,start:-1,limit:2}})).status,409);
 const released=await call('/__ops/export' ,{adminAuth:true,body:{}});assert.equal(released.status,200,JSON.stringify(released));assert.equal(released.data.released,true);assert.deepEqual((await call('/__ops/export',{adminAuth:true,body:{}})).data,released.data);assert.equal((await call('/__ops/activate',{adminAuth:true,body:{writersStopped:true,freePlanVerified:true}})).status,409);
 const restored=decodeCloudArchive(released.data.archive,key,'test');assert.equal(restored.tables.rounds.length,3);assert.equal(restored.tables.ledger.length,snapshot.tables.ledger.length+(casino?9:5));assert.equal(restored.tables.highlight_events.find(e=>e.round_id===forced.round.id).status,'sent');assert.equal(restored.tables.highlight_boards[0].message_id,'100000000000000007');assert.equal(restoreCloudSnapshot(restored,join(dir,'cloud-restored.sqlite'),'test').ok,true);
 const rollbackSettings={...settings,namespace:'rollback-'+randomUUID()+'-test'},rollback=new FirestoreWalletStore(rollbackSettings,{guildIds:[guild]});t.after(()=>rollback.close());await importFirestore(rollback,firestoreImportPlan(join(dir,'cloud-restored.sqlite'),'test',{version:2}));assert.equal((await rollback.state(guild,user)).balance,10007);assert.equal((await rollback.spin(guild,user,20,'runtime-new-spin-request-0002')).duplicate,true);
 assert.equal((await rollback.resetWallets(guild,user,resetId)).duplicate,true);assert.equal((await rollback.state(guild,user)).balance,10007);
 if(casino){
  const damaged=structuredClone(restored);
  delete damaged.tables.wallets[0].duelDigest;
  assert.throws(()=>auditSnapshot(damaged,'test'),/Challenge wallet mismatch/);
  const replay=await rollback.duelAction(guild,user,'hand',winningHand);
  assert.equal(replay.duplicate,true);assert.equal(replay.entry.delta,2500);
  assert.equal(replay.wallet.unlocks.dealer,2);assert.equal(replay.wallet.balance,10007);
  const archivePath=join(dir,'drill-archive.json'),keyPath=join(dir,'drill-key.txt'),out=join(dir,'drill');
  writeFileSync(archivePath,JSON.stringify(archive.data),{mode:0o600});
  writeFileSync(keyPath,key,{mode:0o600});
  execFileSync(process.execPath,['scripts/admin/wallet-recovery.js','drill','--archive',archivePath,'--key-file',keyPath,'--environment','test','--out',out],{windowsHide:true});
  const drill=JSON.parse(readFileSync(join(out,'local-drill','report.json'),'utf8'));
  assert.ok(drill.ok&&drill.sourceUnchanged&&drill.allSevenTablesUnchanged);
  assert.equal(drill.challengeReceiptsVerified,restored.tables.operations.filter(op=>op.key.startsWith('duel:')).length);
  assert.ok(drill.challengeReceiptsVerified>0);
 }
 assert.ok(released.data.quota.scopes.global.usage.reduce((n,x)=>n+x.reads,0)>37);writeFileSync('test-results/cloud-runtime-report.json',JSON.stringify({emulatorOnly:true,realWorkerd:true,persistentSessions:true,originalQuotaCarried:true,cloudBackupRestored:true,newProgressSurvivesRollback:true,privateCommandReply:true,alarmRecoversOutbox:true,backupResumesAfterRestart:true,consistentReadTime:true,staleExportRefused:true,actualCloudDeployment:false},null,2));
});
