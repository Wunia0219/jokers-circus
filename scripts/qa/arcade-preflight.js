import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,unlinkSync,writeFileSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';
import {buildArcadeRelease} from '../build/arcade-release.js';
import {arcadeAssetDirs,assertArcadeArtifact,assertEntryApp,readReleaseFiles} from '../build/arcade-artifact.js';
import {assertProductionArtifact,TEST_DISCORD_APP} from '../build/production-boundary.js';
import {checkToolchain} from './check-toolchain.js';

const productionApp='1561284960986599626';
const targets={
  test:{
    config:'wrangler.arcade-test.jsonc',dist:'dist-arcade-test',worker:'jokers-circus-arcade-test',
    project:'slot-game-203db',namespace:'jokers-circus-arcade-test',app:TEST_DISCORD_APP,
    guild:'760012177326997544',channel:'1564243344857632818',region:'us',
  },
  production:{
    config:'wrangler.production.local.jsonc',dist:'dist',worker:'jokers-circus-production',
    project:'jokers-circus-production',namespace:'jokers-circus-v2-20261030-production',app:productionApp,
    guild:'1503958213454856252',channel:'1565731918107115690',region:'asia-east1',
  },
};
targets['production-arcade']={...targets.production,config:'wrangler.arcade-production.jsonc',dist:'dist-arcade-production'};
const [target,...args]=process.argv.slice(2);
if(!Object.hasOwn(targets,target)||args.length&&!(args.length===2&&args[0]==='--legacy'&&args[1]))
  throw new Error('Usage: npm run arcade:preflight -- <test|production|production-arcade> [--legacy PREVIOUS_DIST]');

checkToolchain();
const expected=targets[target],legacy=args.length?resolve(args[1]):null;
const config=JSON.parse(readFileSync(expected.config,'utf8').replace(/^\uFEFF/,''));
assert.equal(config.name,expected.worker);
assert.equal(config.main,'cloud/worker.js');
assert.deepEqual(config.durable_objects.bindings,[{name:'CIRCUS_PROJECT',class_name:'CircusProject'}]);
const vars=config.vars;
assert.deepEqual([vars.APP_ENV,vars.FIRESTORE_PROJECT_ID,vars.FIRESTORE_NAMESPACE,vars.DISCORD_CLIENT_ID,
  vars.ALLOWED_GUILD_IDS,vars.DISCORD_COMMAND_CHANNEL_IDS,vars.FIRESTORE_ENDPOINT],[
  target==='test'?'test':'production',expected.project,expected.namespace,expected.app,expected.guild,expected.channel,
  `https://firestore.${expected.region}.rep.googleapis.com`,
]);
assert.ok(!Object.hasOwn(vars,'ARCADE_CONSOLE_TOKEN'),'Set the console key as a Worker Secret');
assert.ok(!vars.FIRESTORE_EMULATOR_HOST&&!vars.DISCORD_TEST_ENABLED);
assert.equal(resolve(config.assets.directory),resolve(expected.dist));
assert.equal(config.assets.binding,'ASSETS');
assert.match(vars.DISCORD_PUBLIC_KEY??'',/^[a-f\d]{64}$/i);
if(target==='test'){
  assert.equal(config.assets.run_worker_first,true);
  assert.equal(config.assets.html_handling,'none');
  assert.equal(config.assets.not_found_handling,'none');
  assert.equal(vars.ARCADE_RELEASE_ENABLED,'true');
  assert.equal(vars.DISCORD_COMMAND_PROFILE,'test-simple');
  assert.deepEqual(config.migrations,[{tag:'v1',new_sqlite_classes:['CircusProject']}]);
  assert.ok(!config.route&&!config.routes&&!config.env&&!config.triggers,'Test Worker must use its dedicated workers.dev URL');
  assert.ok(Object.keys(vars).every(key=>!/^DISCORD_(?:BOT|CASINO|HIGHLIGHTS)/.test(key)),
    'Test Worker must have no Discord announcement configuration');
}else{
  if(target==='production-arcade'){
    assert.equal(vars.ARCADE_RELEASE_ENABLED,'true');
    assert.equal(config.assets.run_worker_first,true);
    assert.equal(config.assets.html_handling,'none');
    assert.equal(config.assets.not_found_handling,'none');
    assert.deepEqual(config.migrations,[{tag:'v1',new_sqlite_classes:['CircusProject']}]);
  }else assert.ok(!vars.ARCADE_RELEASE_ENABLED||vars.ARCADE_RELEASE_ENABLED==='false');
  assert.notEqual(vars.ARCADE_CG_PREVIEW_ALL,'true');
  assert.ok(!vars.DISCORD_COMMAND_PROFILE);
  assert.equal(vars.DISCORD_CASINO_ENABLED,'true');
  assert.equal(vars.DISCORD_CASINO_GUILD_ID,expected.guild);
  assert.equal(vars.DISCORD_CASINO_CHANNEL_ID,expected.channel);
  if(target==='production')for(const path of ['/api/*','/__ops/*','/healthz','/readyz','/assets/*.mp3','/game-entry.json','/operator','/__operator/*'])
    assert.ok(config.assets.run_worker_first.includes(path),'Missing production Worker route: '+path);
}

const oppositeApp=target==='test'?productionApp:TEST_DISCORD_APP;
const checkOtherApp=files=>{
  for(const [name,data] of files)if(/\.(?:js|css|html)$/.test(name))
    assert.ok(!String(data).includes(oppositeApp),'Other Discord App in '+name);
};
if(legacy){
  const oldFiles=[['index.html',readFileSync(join(legacy,'index.html'))],
    ...arcadeAssetDirs.filter(dir=>existsSync(join(legacy,dir))).flatMap(dir=>readReleaseFiles(legacy,dir))];
  assertEntryApp(oldFiles,'index.html',expected.app);
  if(target==='production')assertProductionArtifact(oldFiles);
  checkOtherApp(oldFiles);
}
const dist=resolve(expected.dist);
if(existsSync(dist))assert.equal(relative(realpathSync('.'),realpathSync(dist)),expected.dist,'Release output must be inside this workspace');
await buildArcadeRelease({clientId:expected.app,target,legacy,outDir:dist,logLevel:'warn'});
const files=readReleaseFiles(dist);
if(target!=='production')assertArcadeArtifact(files,expected.app);
else{assertProductionArtifact(files);assertEntryApp(files,'index.html',expected.app);}
checkOtherApp(files);

const reports=resolve('test-results/arcade-preflight');
mkdirSync(reports,{recursive:true});
const output=mkdtempSync(join(reports,target+'-'));
const configPath=join(output,'wrangler.jsonc');
const relativeToOutput=path=>relative(output,path).split(sep).join('/');
const staged={
  ...config,main:relativeToOutput(resolve(config.main)),
  assets:{...config.assets,directory:relativeToOutput(dist)},
};
const bundle=join(output,'worker');
writeFileSync(configPath,JSON.stringify(staged),{mode:0o600});
try{
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config',configPath,'--outdir',bundle],{
    encoding:'utf8',windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(output,'wrangler.log')},
  });
  if(result.error)throw result.error;
  assert.equal(result.status,0,'Wrangler dry-run failed; inspect the local Wrangler diagnostic');
}finally{unlinkSync(configPath);}
const worker=readFileSync(join(bundle,'worker.js'));
assert.ok(!/slot-game-203db|yakyuken-playtest|1567875182792544256|\/api\/playtest/i.test(String(worker)),
  'The shared Worker bundle must not include the old playtest implementation');
const sha256=data=>createHash('sha256').update(data).digest('hex');
const report={ok:true,target,worker:expected.worker,project:expected.project,namespace:expected.namespace,
  dryRun:true,legacyIncluded:!!legacy,workerSha256:sha256(worker),
  files:files.map(([path,data])=>({path,sha256:sha256(data)}))};
const reportPath=join(output,'report.json');
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,target,dryRun:true,legacyIncluded:!!legacy,assets:files.length,report:relative('.',reportPath)}));
