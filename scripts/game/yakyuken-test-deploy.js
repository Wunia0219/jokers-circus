import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {PLAYTEST_IDENTITY,assertPlaytestIdentity} from '../../cloud/yakyuken-playtest-core.js';

if(process.argv.slice(2).join(' ')!=='--deploy')throw new Error('Explicit --deploy required for the dedicated test Worker');
if(existsSync('.tools/discord-test-app.json')&&JSON.parse(readFileSync('.tools/discord-test-app.json','utf8')).clientId)throw new Error('Discord test App is configured; use node scripts/game/discord-test.js deploy to preserve its assets and login configuration');
const configPath='wrangler.yakyuken-test.jsonc',config=JSON.parse(readFileSync(configPath,'utf8'));
assertPlaytestIdentity(config.vars);
if(config.name!==PLAYTEST_IDENTITY.worker||config.main!=='cloud/yakyuken-playtest-worker.js'||config.assets||config.triggers||config.env||config.routes)throw new Error('Unexpected test deployment configuration');
const source=parseEnv(readFileSync('.env.firestore.local','utf8'));
if(source.APP_ENV!=='test'||source.FIRESTORE_PROJECT_ID!==PLAYTEST_IDENTITY.projectId)throw new Error('Existing test Firestore credentials required');
const credentials=JSON.parse(readFileSync(resolve(source.GOOGLE_APPLICATION_CREDENTIALS),'utf8'));
if(credentials.type!=='service_account'||credentials.project_id!==PLAYTEST_IDENTITY.projectId)throw new Error('Test credential identity mismatch');
mkdirSync('.tools',{recursive:true});
const gatewayPath='.tools/yakyuken-playtest.json',previous=existsSync(gatewayPath)?JSON.parse(readFileSync(gatewayPath,'utf8')):null;
const token=previous?.token||randomBytes(32).toString('hex');
if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid private playtest token');
const secretPath=resolve('.tools/yakyuken-playtest-secrets.json');
const run=args=>new Promise((done,reject)=>{
  const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--config',configPath],{windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',data=>{output+=data;process.stdout.write(data);});child.stderr.on('data',data=>process.stderr.write(data));child.on('error',reject);
  child.on('exit',code=>code===0?done(output):reject(new Error('Dedicated test deployment failed')));
});
const deployment=await run(['deploy']),match=deployment.match(/https:\/\/jokers-circus-yakyuken-test\.[a-z0-9-]+\.workers\.dev/);
if(!match)throw new Error('Dedicated test origin missing; do not use another Worker');
writeFileSync(secretPath,JSON.stringify({PLAYTEST_TOKEN:token,GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify(credentials)}));
try{await run(['secret','bulk',secretPath]);}finally{unlinkSync(secretPath);}
const origin=match[0],health=await fetch(origin+'/healthz',{redirect:'error',signal:AbortSignal.timeout(20000)}).then(r=>r.json());
if(!health.ok||health.environment!=='test'||health.worker!==PLAYTEST_IDENTITY.worker||health.projectId!==PLAYTEST_IDENTITY.projectId||health.namespace!==PLAYTEST_IDENTITY.namespace)throw new Error('Dedicated test health identity mismatch');
writeFileSync(gatewayPath,JSON.stringify({origin,token},null,2)+'\n');
writeFileSync('test-results/yakyuken-test-deployment.json',JSON.stringify({origin,health,deployedAt:new Date().toISOString()},null,2)+'\n');
console.log('Dedicated test deployment ready; run node scripts/game/yakyuken-preview.js --cloud-test');
