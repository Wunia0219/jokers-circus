import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetRecovery,transientAssetError} from '../src/ui/dealer/asset-recovery.js';

test('atlas transient failures retry at most twice with stable URLs and sanitized diagnostics',async()=>{
  const calls=[],delays=[],report=[];
  const load=createAssetRecovery({load:async url=>{calls.push(url);if(calls.length<3)throw new TypeError('Failed to fetch');return 'texture';},wait:async ms=>delays.push(ms),report:item=>report.push(item)});
  assert.equal(await load('/assets/win.webp?private=hidden'),'texture');assert.equal(new Set(calls).size,1);assert.equal(calls.length,3);assert.deepEqual(delays,[300,1000]);assert.ok(!JSON.stringify(report).includes('hidden'));
  let count=0;await assert.rejects(()=>createAssetRecovery({load:async()=>{count++;throw new Error('Failed to fetch');},wait:async()=>{}})('/a.webp'));assert.equal(count,3);
});
test('permanent HTTP/decoding failures do not retry; bounded queue stops disposed work',async()=>{
  assert.equal(transientAssetError(new Error('Failed to fetch /a: 404 Not Found')),false);
  assert.equal(transientAssetError(new Error('Failed to fetch /a: 503 Unavailable')),true);
  let count=0;await assert.rejects(()=>createAssetRecovery({load:async()=>{count++;throw new Error('image decode failed');}})('/a.webp'));assert.equal(count,1);
  let active=0,peak=0,disposed=false;const gates=[];
  const load=createAssetRecovery({load:async()=>{active++;peak=Math.max(peak,active);await new Promise(done=>gates.push(done));active--;return 'texture';},disposed:()=>disposed});
  const tasks=Array.from({length:12},(_,i)=>load('/'+i+'.webp'));const settled=Promise.allSettled(tasks);
  await new Promise(done=>setImmediate(done));assert.equal(gates.length,4);disposed=true;gates.forEach(done=>done());
  const results=await settled;assert.equal(peak,4);assert.equal(results.filter(x=>x.status==='fulfilled').length,4);assert.equal(results.filter(x=>x.status==='rejected').length,8);
});
