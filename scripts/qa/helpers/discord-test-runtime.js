import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {PLAYTEST_IDENTITY} from '../../../cloud/yakyuken-playtest-core.js';
import {TEST_GUILD,TEST_CHANNEL} from '../../../cloud/discord-test-auth.js';

export async function createDiscordTestRuntime({assetService,output='test-results/discord-test-runtime',commands=false}={}){
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8787','This helper cannot use a live Firestore project');
  mkdirSync(output,{recursive:true});const dir=mkdtempSync(join(resolve(output),'case-')),scriptPath=join(dir,'worker.js');
  const isolatedNamespace=commands?PLAYTEST_IDENTITY.namespace+'-'+dir.split(/[\\/]/).at(-1):PLAYTEST_IDENTITY.namespace;
  await build({entryPoints:['cloud/yakyuken-playtest-worker.js'],outfile:scriptPath,bundle:true,platform:'node',format:'esm',plugins:[{name:'fixture-entropy',setup(b){b.onLoad({filter:/yakyuken-playtest-core\.js$/},args=>{
    const source=readFileSync(args.path,'utf8');assert.ok(source.includes('entropy=globalThis.crypto'));
    return {contents:source.replace('entropy=globalThis.crypto','entropy={getRandomValues:v=>{v[0]=0;}}'),loader:'js'};
  });}}]});
  const rsa=generateKeyPairSync('rsa',{modulusLength:2048}),ed=generateKeyPairSync('ed25519'),clientId='100000000000000003',users=commands?{A:'100000000000000113',B:'100000000000000114'}:{A:'100000000000000111',B:'100000000000000112'},token='a'.repeat(64),replies=new Map(),waiters=new Map();
  const publicKey=ed.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');let firestoreCalls=0,loseReset=false;
  const config={modules:true,scriptPath,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{YAKYUKEN_TEST:{className:'YakyukenTestPlayer',useSQLite:true},DISCORD_TEST_AUTH:{className:'DiscordTestAuth',useSQLite:true}},resourcePersistencePath:join(dir,'durable'),bindings:{
    APP_ENV:'test',FIRESTORE_PROJECT_ID:PLAYTEST_IDENTITY.projectId,FIRESTORE_NAMESPACE:PLAYTEST_IDENTITY.namespace,PLAYTEST_TOKEN:token,
    GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:PLAYTEST_IDENTITY.projectId,client_email:'fixture@example.invalid',private_key:rsa.privateKey.export({format:'pem',type:'pkcs8'})}),
    DISCORD_TEST_ENABLED:'true',...(commands?{DISCORD_TEST_COMMANDS_ENABLED:'true'}:{}),DISCORD_CLIENT_ID:clientId,DISCORD_PUBLIC_KEY:publicKey,DISCORD_CLIENT_SECRET:'isolated-fixture-secret',DISCORD_TEST_GUILD_ID:TEST_GUILD,DISCORD_TEST_CHANNEL_ID:TEST_CHANNEL,CLOUD_ENCRYPTION_KEY:'b'.repeat(64),
  },...(assetService?{serviceBindings:{ASSETS:assetService}}:{}),outboundService:async request=>{
    const u=new URL(request.url),auth=request.headers.get('authorization')||'';
    if(u.hostname==='oauth2.googleapis.com')return MFResponse.json({access_token:'emulator-only',expires_in:3600});
    if(u.hostname==='firestore.googleapis.com'){
      firestoreCalls++;assert.ok(u.pathname.includes('/projects/'+PLAYTEST_IDENTITY.projectId+'/'));
      const toDemo=value=>value.replaceAll('projects/'+PLAYTEST_IDENTITY.projectId+'/','projects/demo-jokers-circus/').replaceAll('circus_wallet_v1/'+PLAYTEST_IDENTITY.namespace,'circus_wallet_v1/'+isolatedNamespace);
      const payload=await request.text(),response=await fetch('http://127.0.0.1:8787'+toDemo(u.pathname),{method:request.method,headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:toDemo(payload)});
      if(loseReset&&u.pathname.endsWith(':commit')&&payload.includes('/testAdminOperations/')){assert.equal(response.status,200);loseReset=false;return MFResponse.json({error:{status:'UNAVAILABLE'}},{status:503});}
      return new MFResponse((await response.text()).replaceAll('projects/demo-jokers-circus/','projects/'+PLAYTEST_IDENTITY.projectId+'/').replaceAll('circus_wallet_v1/'+isolatedNamespace,'circus_wallet_v1/'+PLAYTEST_IDENTITY.namespace),{status:response.status,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(u.hostname,'discord.com','Unexpected external service in the isolated runtime');
    if(u.pathname.startsWith('/api/v10/webhooks/'+clientId+'/')&&request.method==='PATCH'){
      const key=u.pathname.split('/')[5],reply=await request.json();replies.set(key,reply);waiters.get(key)?.(reply);return MFResponse.json({});
    }
    if(u.pathname==='/api/oauth2/token'){
      const form=new URLSearchParams(await request.text()),who=form.get('code')==='code-B'?'B':'A';assert.equal(form.get('client_id'),clientId);
      return MFResponse.json({access_token:'fixture-oauth-'+who,scope:'identify guilds.members.read',expires_in:3600});
    }
    const who=auth==='Bearer fixture-oauth-B'?'B':'A',user=users[who];
    if(u.pathname==='/api/v10/users/@me')return MFResponse.json({id:user,username:'tester-'+who,global_name:'測試者 '+who,bot:false});
    if(u.pathname===`/api/v10/users/@me/guilds/${TEST_GUILD}/member`)return MFResponse.json({user:{id:user,bot:false},nick:'測試者 '+who,pending:false});
    throw new Error('Unexpected Discord request; test runtime cannot send channel messages');
  }};
  let mf=new Miniflare(convertV4MiniflareOptions(config));
  const call=async(path,{body,token,headers={},method}={})=>{
    const response=await mf.dispatchFetch('https://'+clientId+'.discordsays.com'+path,{method:method||(body?'POST':'GET'),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  };
  const launch=async(who='A',{channel=TEST_CHANNEL,guild=TEST_GUILD,forged=false}={})=>{
    const text=JSON.stringify({type:2,application_id:clientId,guild_id:guild,channel_id:channel,member:{user:{id:users[who],bot:false}},data:{type:4}}),timestamp=String(Math.floor(Date.now()/1000)),signature=sign(null,Buffer.from(timestamp+text),ed.privateKey).toString('hex');
    const response=await mf.dispatchFetch('https://'+clientId+'.discordsays.com/api/interactions',{method:'POST',headers:{'Content-Type':'application/json','X-Signature-Timestamp':timestamp,'X-Signature-Ed25519':forged?'0'.repeat(128):signature},body:text});return {status:response.status,data:await response.json()};
  };
  const interact=async body=>{
    const text=JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000)),signature=sign(null,Buffer.from(timestamp+text),ed.privateKey).toString('hex');
    return call('/api/interactions',{body,headers:{'X-Signature-Timestamp':timestamp,'X-Signature-Ed25519':signature}});
  };
  const completed=key=>replies.has(key)?Promise.resolve(replies.get(key)):new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiters.delete(key);reject(new Error('Deferred test reply missing'));},20000);waiters.set(key,value=>{clearTimeout(timer);waiters.delete(key);resolve(value);});});
  return {get mf(){return mf;},clientId,users,publicKey,token,call,launch,interact,completed,loseResetCommit:()=>loseReset=true,get firestoreCalls(){return firestoreCalls;},restart:async()=>{await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config));},dispose:()=>mf.dispose()};
}
