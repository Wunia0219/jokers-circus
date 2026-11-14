import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {build} from 'vite';
import {discordTestBuildOptions} from '../build/discord-test.js';
import {PLAYTEST_IDENTITY,assertPlaytestIdentity} from '../../cloud/yakyuken-playtest-core.js';
import {assertDiscordTestApp,TEST_CHANNEL,TEST_GUILD,LIVE_APP} from '../../cloud/discord-test-auth.js';
import {configureQuietLaunch} from '../../server/discord/entry-point.js';
import {registerCommands} from '../../server/discord/discord-registration.js';

const [command,...args]=process.argv.slice(2);if(!['build','deploy','check','configure-entry','register-commands'].includes(command)||args.length>2||args.length&&args[0]!=='--config')throw new Error('Use build|deploy|check|configure-entry|register-commands [--config private-file]');
const app=JSON.parse(readFileSync(args[1]||'.tools/discord-test-app.json','utf8'));
if(app.purpose!=='discord-test'||!/^\d{17,20}$/.test(app.clientId||'')||app.clientId===LIVE_APP)throw new Error('A new, separate Discord test App is required');
if(app.guildId!==TEST_GUILD||app.channelId!==TEST_CHANNEL)throw new Error('Test guild/channel identity mismatch');
if(app.cgPreviewUserId!==undefined&&(typeof app.cgPreviewUserId!=='string'||!/^\d{17,20}$/.test(app.cgPreviewUserId)))throw new Error('Invalid private CG preview user ID');
const worker=JSON.parse(readFileSync('wrangler.yakyuken-test.jsonc','utf8'));assertPlaytestIdentity(worker.vars);
if(worker.name!==PLAYTEST_IDENTITY.worker||worker.main!=='cloud/yakyuken-playtest-worker.js'||worker.assets||worker.routes||worker.env||worker.triggers)throw new Error('Unexpected test Worker identity');
worker.vars={...worker.vars,DISCORD_TEST_ENABLED:'true',DISCORD_TEST_COMMANDS_ENABLED:'true',DISCORD_CLIENT_ID:app.clientId,DISCORD_TEST_GUILD_ID:TEST_GUILD,DISCORD_TEST_CHANNEL_ID:TEST_CHANNEL,DISCORD_PUBLIC_KEY:app.publicKey||'',DISCORD_TESTER_IDS:(app.testerIds||[]).join(',')};
worker.vars.DISCORD_TEST_CG_PREVIEW_USER_ID=app.cgPreviewUserId??'';
assertDiscordTestApp(worker.vars);
const out=resolve('test-results/discord-test-dist'),localConfig=resolve('wrangler.discord-test.local.jsonc');
worker.assets={directory:out,binding:'ASSETS',run_worker_first:true,html_handling:'none'};
worker.vars.DISCORD_TEST_ORIGIN_HOST='jokers-circus-yakyuken-test.nini900219.workers.dev';
mkdirSync('test-results',{recursive:true});mkdirSync('.tools',{recursive:true});writeFileSync(localConfig,JSON.stringify(worker,null,2)+'\n');
const run=(more,input)=>new Promise((done,reject)=>{
  const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...more,'--config',localConfig],{windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:[input?'pipe':'ignore','pipe','pipe']});let output='';
  if(input)child.stdin.end(input);child.stdout.on('data',data=>{output+=data;process.stdout.write(data);});child.stderr.on('data',data=>process.stderr.write(data));child.on('error',reject);child.on('exit',code=>code===0?done(output):reject(new Error('Discord test operation failed')));
});
const buildTest=()=>build(discordTestBuildOptions(out,app.clientId));
if(command==='build')await buildTest();
if(command==='register-commands')await registerCommands({env:{DISCORD_CLIENT_ID:app.clientId,DISCORD_CLIENT_SECRET:app.clientSecret,ALLOWED_GUILD_IDS:TEST_GUILD}});
if(command==='configure-entry'){
  if(!app.clientSecret)throw new Error('Test App secret is missing');
  console.log(JSON.stringify(await configureQuietLaunch({clientId:app.clientId,clientSecret:app.clientSecret})));
}
if(command==='deploy'){
  if(typeof app.clientSecret!=='string'||!app.clientSecret||!/^[a-f\d]{64}$/i.test(app.publicKey||''))throw new Error('Test OAuth credentials and public key are required');
  const auth=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(app.clientId+':'+app.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'applications.commands.update'}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!auth.ok)throw new Error('New test App credentials could not be verified; no deployment was performed');
  const access=(await auth.json()).access_token;
  const commands=await fetch(`https://discord.com/api/v10/applications/${app.clientId}/commands`,{headers:{Authorization:'Bearer '+access},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!commands.ok)throw new Error('Test App command access could not be verified; no deployment was performed');
  const source=parseEnv(readFileSync('.env.firestore.local','utf8'));
  if(source.APP_ENV!=='test'||source.FIRESTORE_PROJECT_ID!==PLAYTEST_IDENTITY.projectId)throw new Error('Test Firestore source required');
  const credentials=JSON.parse(readFileSync(resolve(source.GOOGLE_APPLICATION_CREDENTIALS),'utf8'));
  if(credentials.project_id!==PLAYTEST_IDENTITY.projectId||credentials.type!=='service_account')throw new Error('Test credentials mismatch');
  const gatewayPath='.tools/yakyuken-playtest.json',gateway=JSON.parse(readFileSync(gatewayPath,'utf8'));
  if(gateway.origin!=='https://'+worker.vars.DISCORD_TEST_ORIGIN_HOST||!/^[a-f0-9]{64}$/.test(gateway.token))throw new Error('Dedicated gateway mismatch');
  const keyPath='.tools/discord-test-encryption-key',key=(()=>{try{return readFileSync(keyPath,'utf8').trim();}catch{const value=randomBytes(32).toString('hex');writeFileSync(keyPath,value);return value;}})();
  if(!/^[a-f0-9]{64}$/.test(key))throw new Error('Invalid test session encryption key');
  await buildTest();
  const secrets=resolve('.tools/discord-test-upload-secrets.json');
  writeFileSync(secrets,JSON.stringify({PLAYTEST_TOKEN:gateway.token,GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify(credentials),DISCORD_CLIENT_SECRET:app.clientSecret,CLOUD_ENCRYPTION_KEY:key}));
  try{await run(['secret','bulk',secrets]);}finally{unlinkSync(secrets);}
  await run(['deploy']);
  writeFileSync('test-results/discord-test-deployment.json',JSON.stringify({at:new Date().toISOString(),origin:gateway.origin,appId:app.clientId,guildId:TEST_GUILD,channelId:TEST_CHANNEL,identity:PLAYTEST_IDENTITY},null,2)+'\n');
}
if(command==='check'||command==='deploy'){
  const origin='https://'+worker.vars.DISCORD_TEST_ORIGIN_HOST;
  for(const path of ['/healthz','/','/slot/','/terms.html','/privacy.html']){
    const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
    if(response.status!==200)throw new Error('Test public probe failed: '+path);
    if(path!=='/healthz'&&!response.headers.get('Content-Security-Policy'))throw new Error('Test CSP missing');
  }
  for(const path of ['/api/wallet','/api/playtest/state']){const response=await fetch(origin+path,{redirect:'error'});if(response.status!==401)throw new Error('Public wallet requires a verified session');}
  console.log(JSON.stringify({ok:true,origin,appId:app.clientId,guildId:TEST_GUILD,channelId:TEST_CHANNEL}));
}
