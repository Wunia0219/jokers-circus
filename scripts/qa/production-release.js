import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {assertProductionArtifact} from '../build/production-boundary.js';
import {APP_VERSION} from '../../src/version.js';
const arcade=process.argv.includes('--arcade');
const dist=resolve(arcade?'dist-arcade':'dist');

const files=[];
function walk(root,path=''){
  for(const entry of readdirSync(join(root,path),{withFileTypes:true})){
    const name=(path?path+'/':'')+entry.name;
    if(entry.isDirectory())walk(root,name);else files.push([name,readFileSync(join(root,name))]);
  }
}
walk(dist);assertProductionArtifact(files.filter(([name])=>!arcade||!name.startsWith('arcade/')));
assert.ok(files.some(([name])=>name==='index.html'));assert.ok(files.some(([name])=>/^assets\/index-.*\.js$/.test(name)));
const code=readFileSync('test-results/cloud-bundle/worker.js','utf8');
assert.doesNotMatch(code,/slot-game-203db|yakyuken-playtest|1567875182792544256|\/api\/playtest/i,'production Worker must not include the test cloud');
const production=JSON.parse(readFileSync('wrangler.production.local.jsonc','utf8'));
assert.equal(production.name,'jokers-circus-production');assert.equal(production.main,'cloud/worker.js');assert.equal(resolve(production.assets.directory),dist);
assert.equal(production.assets.not_found_handling??'none','none');
if(arcade){
  assert.equal(production.assets.run_worker_first,true);
  assert.equal(production.assets.html_handling,'none');
  assert.equal(production.vars.ARCADE_RELEASE_ENABLED,'true');
  if(production.vars.ARCADE_OPERATOR_IDS)assert.match(production.vars.ARCADE_OPERATOR_IDS,/^\d{17,20}(?:,\s*\d{17,20})*$/);
  const clientId=production.vars.DISCORD_CLIENT_ID;
  assert.match(clientId??'',/^\d{17,20}$/);
  assert.ok(files.some(([name,bytes])=>/^arcade\/assets\/lobby-.*\.js$/.test(name)&&String(bytes).includes(JSON.stringify(clientId))),
    'Arcade build must use the configured Discord Application ID');
  for(const name of ['arcade/lobby.html','arcade/feature/play.html','arcade/feature/cover.webp'])
    assert.ok(files.some(([path])=>path===name),name+' missing');
  for(const [name,bytes] of files.filter(([path])=>path.startsWith('arcade/'))){
    assert.match(name,/^arcade\/(?:lobby\.html|feature\/(?:play\.html|cover\.webp)|(?:feature\/)?assets\/[\w.-]+-[\w-]{8}\.[a-z0-9]+)$/);
    if(/\.(?:js|css|html)$/.test(name)){
      assert.doesNotMatch(String(bytes),/slot-game-203db|yakyuken-playtest|1567875182792544256|\/api\/playtest/i);
      if(!name.startsWith('arcade/feature/'))assert.doesNotMatch(String(bytes),/野球拳|yakyuken|cg-download|\/arcade\/feature\//i);
    }
  }
}else assert.notEqual(production.vars.ARCADE_RELEASE_ENABLED,'true');
assert.equal(production.vars.APP_ENV,'production');assert.equal(production.vars.FIRESTORE_PROJECT_ID,'jokers-circus-production');assert.equal(production.vars.FIRESTORE_NAMESPACE,'jokers-circus-v2-20261030-production');
assert.equal(production.vars.DISCORD_COMMAND_CHANNEL_IDS,'1565731918107115690');assert.equal(production.vars.DISCORD_CASINO_CHANNEL_ID,'1565731918107115690');
assert.deepEqual(production.durable_objects.bindings.map(b=>b.name),['CIRCUS_PROJECT']);
assert.ok(!production.vars.DISCORD_TEST_ENABLED);
const test=JSON.parse(readFileSync('wrangler.yakyuken-test.jsonc','utf8'));
assert.equal(test.name,'jokers-circus-yakyuken-test');assert.equal(test.main,'cloud/yakyuken-playtest-worker.js');assert.equal(test.vars.APP_ENV,'test');assert.equal(test.vars.FIRESTORE_PROJECT_ID,'slot-game-203db');assert.equal(test.vars.FIRESTORE_NAMESPACE,'yakyuken-playtest-20261105-test');
assert.ok(test.durable_objects.bindings.every(b=>b.name!=='CIRCUS_PROJECT'));
const report={version:APP_VERSION,ok:true,arcade,productionWorker:production.name,productionProject:production.vars.FIRESTORE_PROJECT_ID,testWorker:test.name,testProject:test.vars.FIRESTORE_PROJECT_ID,productionHasTestGame:false,
  files:files.map(([path,bytes])=>({path,sha256:createHash('sha256').update(bytes).digest('hex')})),workerSha256:createHash('sha256').update(code).digest('hex')};
mkdirSync('test-results/release-1.0.3',{recursive:true});writeFileSync('test-results/release-1.0.3/isolation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,version:APP_VERSION,files:files.length,productionHasTestGame:false,separateCloudAndDatabase:true}));
