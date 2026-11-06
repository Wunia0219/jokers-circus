import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {assertProductionArtifact} from '../build/production-boundary.js';
import {APP_VERSION} from '../../src/version.js';

const files=[];
function walk(root,path=''){
  for(const entry of readdirSync(join(root,path),{withFileTypes:true})){
    const name=(path?path+'/':'')+entry.name;
    if(entry.isDirectory())walk(root,name);else files.push([name,readFileSync(join(root,name))]);
  }
}
walk(resolve('dist'));assertProductionArtifact(files);
assert.ok(files.some(([name])=>name==='index.html'));assert.ok(files.some(([name])=>/^assets\/index-.*\.js$/.test(name)));
const code=readFileSync('test-results/cloud-bundle/worker.js','utf8');
assert.doesNotMatch(code,/yakyuken|野球拳|slot-game-203db|yakyuken-playtest|1567875182792544256/i,'production Worker must not include the test game or test cloud');
const production=JSON.parse(readFileSync('wrangler.production.local.jsonc','utf8'));
assert.equal(production.name,'jokers-circus-production');assert.equal(production.main,'cloud/worker.js');assert.equal(resolve(production.assets.directory),resolve('dist'));
assert.equal(production.assets.not_found_handling??'none','none');
assert.equal(production.vars.APP_ENV,'production');assert.equal(production.vars.FIRESTORE_PROJECT_ID,'jokers-circus-production');assert.equal(production.vars.FIRESTORE_NAMESPACE,'jokers-circus-v2-20261030-production');
assert.equal(production.vars.DISCORD_COMMAND_CHANNEL_IDS,'1565731918107115690');assert.equal(production.vars.DISCORD_CASINO_CHANNEL_ID,'1565731918107115690');
assert.deepEqual(production.durable_objects.bindings.map(b=>b.name),['CIRCUS_PROJECT']);
assert.ok(!production.vars.DISCORD_TEST_ENABLED);
const test=JSON.parse(readFileSync('wrangler.yakyuken-test.jsonc','utf8'));
assert.equal(test.name,'jokers-circus-yakyuken-test');assert.equal(test.main,'cloud/yakyuken-playtest-worker.js');assert.equal(test.vars.APP_ENV,'test');assert.equal(test.vars.FIRESTORE_PROJECT_ID,'slot-game-203db');assert.equal(test.vars.FIRESTORE_NAMESPACE,'yakyuken-playtest-20261105-test');
assert.ok(test.durable_objects.bindings.every(b=>b.name!=='CIRCUS_PROJECT'));
const report={version:APP_VERSION,ok:true,productionWorker:production.name,productionProject:production.vars.FIRESTORE_PROJECT_ID,testWorker:test.name,testProject:test.vars.FIRESTORE_PROJECT_ID,productionHasTestGame:false,
  files:files.map(([path,bytes])=>({path,sha256:createHash('sha256').update(bytes).digest('hex')})),workerSha256:createHash('sha256').update(code).digest('hex')};
mkdirSync('test-results/release-1.0.3',{recursive:true});writeFileSync('test-results/release-1.0.3/isolation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,version:APP_VERSION,files:files.length,productionHasTestGame:false,separateCloudAndDatabase:true}));
