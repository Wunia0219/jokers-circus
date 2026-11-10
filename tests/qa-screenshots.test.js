import assert from 'node:assert/strict';
import test from 'node:test';
import {createQaScreenshots} from '../scripts/qa/helpers/qa-screenshots.js';

test('CI diagnostic policy omits success PNGs but still captures failures',async()=>{
  const calls=[],page={screenshot:async options=>{calls.push(options);}};
  const screenshots=createQaScreenshots({mode:'failure'});
  await screenshots.capture(page,'success.png');assert.deepEqual(calls,[]);
  await screenshots.failure(page,'failure.png');
  assert.deepEqual(calls,[{path:'failure.png',timeout:5000}]);
});

test('full diagnostic mode retains captures without changing normal screenshot options',async()=>{
  const calls=[],observed=[],page={screenshot:async options=>{calls.push(options);return 'image';}};
  const screenshots=createQaScreenshots({mode:'all',timing:{measure:async(name,run)=>{observed.push(name);return run();}}});
  assert.equal(await screenshots.capture(page,'qa/success.png'),'image');
  assert.deepEqual(calls,[{path:'qa/success.png'}]);assert.deepEqual(observed,['screenshot/success.png']);
  const error=new Error('capture failed');
  await assert.rejects(screenshots.capture({screenshot:async()=>{throw error;}},'qa/success.png'),value=>value===error);
});

test('a failed diagnostic capture does not replace the original test failure',async t=>{
  const log=t.mock.method(console,'error',()=>{}),original=new Error('original assertion');
  const screenshots=createQaScreenshots({mode:'failure'});
  await assert.rejects((async()=>{
    try{throw original;}catch(error){
      await screenshots.failure({screenshot:async()=>{throw new Error('page closed');}},'failure.png');throw error;
    }
  })(),error=>error===original);
  assert.equal(log.mock.callCount(),1);
});

test('an invalid screenshot mode fails closed',()=>{
  for(const mode of ['', 'none','typo'])assert.throws(()=>createQaScreenshots({mode}),/QA_SCREENSHOTS/);
});
