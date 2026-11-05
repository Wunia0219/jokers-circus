import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {build} from 'esbuild';
import {readFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {PLAYTEST_IDENTITY} from '../cloud/yakyuken-playtest-core.js';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8787');

test('dedicated workerd test wallet persists Firestore fees/prizes, isolates players and rejects unauthorized access',async t=>{
  const root=resolve('test-results/yakyuken-playtest-runtime');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'case-')),scriptPath=join(dir,'worker.js');
  await build({entryPoints:['cloud/yakyuken-playtest-worker.js'],outfile:scriptPath,bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-entropy',setup(b){b.onLoad({filter:/yakyuken-playtest-core\.js$/},args=>{
    const source=readFileSync(args.path,'utf8');assert.ok(source.includes('entropy=globalThis.crypto'));
    return {contents:source.replace('entropy=globalThis.crypto','entropy={getRandomValues:v=>{v[0]=[0,8000,0][globalThis.__playtestHandIndex=(globalThis.__playtestHandIndex??-1)+1]??0;}}'),loader:'js'};
  });}}]});
  const rsa=generateKeyPairSync('rsa',{modulusLength:2048}),token='a'.repeat(64);let firestoreCalls=0;
  const config={modules:true,scriptPath,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{YAKYUKEN_TEST:{className:'YakyukenTestPlayer',useSQLite:true}},resourcePersistencePath:join(dir,'durable'),bindings:{APP_ENV:'test',FIRESTORE_PROJECT_ID:PLAYTEST_IDENTITY.projectId,FIRESTORE_NAMESPACE:PLAYTEST_IDENTITY.namespace,PLAYTEST_TOKEN:token,GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:PLAYTEST_IDENTITY.projectId,client_email:'fixture@example.invalid',private_key:rsa.privateKey.export({format:'pem',type:'pkcs8'})})},outboundService:async request=>{
    const url=new URL(request.url);
    if(url.hostname==='oauth2.googleapis.com')return MFResponse.json({access_token:'emulator-only',expires_in:3600});
    assert.equal(url.hostname,'firestore.googleapis.com','all outbound traffic is confined to the emulator');
    assert.ok(url.pathname.includes('/projects/'+PLAYTEST_IDENTITY.projectId+'/'));firestoreCalls++;
    const toDemo=value=>value.replaceAll('projects/'+PLAYTEST_IDENTITY.projectId+'/','projects/demo-jokers-circus/');
    const response=await fetch('http://127.0.0.1:8787'+toDemo(url.pathname),{method:request.method,headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:toDemo(await request.text())});
    return new MFResponse((await response.text()).replaceAll('projects/demo-jokers-circus/','projects/'+PLAYTEST_IDENTITY.projectId+'/'),{status:response.status,headers:{'Content-Type':'application/json'}});
  }};
  let mf=new Miniflare(convertV4MiniflareOptions(config));t.after(()=>mf.dispose());
  const call=async(action,body,player='qa-a',auth=token)=>{
    const response=await mf.dispatchFetch('https://localhost/api/playtest/'+action+'?player='+player,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};
  };
  assert.equal((await call('state',null,'qa-a','bad-token')).status,401);
  assert.equal((await call('state',null,'real-discord-user')).status,400);
  const entryBody={requestId:'runtime-entry-00000001',characterId:'dealer'},entry=await call('begin',entryBody);assert.equal(entry.status,200);assert.equal(entry.data.wallet.balance,9000);
  const matchId=entry.data.matchId,hand=(n,move='rock')=>call('hand',{requestId:'runtime-hand-0000000'+n,matchId,move});
  assert.equal((await hand(1)).data.wallet.records[0].wins,1);
  const beforeDraw=firestoreCalls,draw=await hand(2);assert.equal(draw.data.duel.outcome,'draw');assert.equal(firestoreCalls,beforeDraw,'real workerd performs zero Firestore calls for a draw');
  assert.equal((await hand(2)).data.duel.outcome,'draw');assert.equal(firestoreCalls,beforeDraw);
  const won=await hand(3);assert.equal(won.data.wallet.balance,11500);assert.equal(won.data.wallet.records[0].net,1500);
  assert.equal((await call('state',null,'qa-b')).data.wallet.balance,10000);
  assert.equal((await call('state',null,'qa-b')).data.wallet.records.length,0);
  assert.equal((await hand(1,'paper')).status,409);
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config));
  const replay=await hand(3);assert.equal(replay.status,200);assert.equal(replay.data.wallet.balance,11500);
  assert.equal((await call('begin',entryBody)).data.wallet.balance,9000,'a repeated historical request returns its original receipt');
  const current=await call('state');assert.equal(current.data.wallet.balance,11500);assert.equal(current.data.wallet.records.length,1);assert.equal(current.data.wallet.records[0].wins,2);
  const doc=await fetch('http://127.0.0.1:8787/v1/projects/demo-jokers-circus/databases/(default)/documents/circus_wallet_v1/'+PLAYTEST_IDENTITY.namespace+'/players/qa-a',{headers:{Authorization:'Bearer owner'}});
  assert.equal(doc.status,200);
  const stored=JSON.parse((await doc.json()).fields.state.stringValue);assert.equal(stored.balance,11500);assert.ok(!JSON.stringify(stored).match(/"(draws|rounds)":/));
});
