import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {verifySlotAtlasRecovery} from '../scripts/qa/helpers/slot-atlas-recovery.js';

const url='http://127.0.0.1:4203/assets/win-018-fixture1.webp';
class Page extends EventEmitter {
  async route(pattern,handler){this.pattern=pattern;this.handler=handler;}
  async unroute(pattern,handler){assert.equal(pattern,this.pattern);assert.equal(handler,this.handler);this.handler=null;}
  waitForResponse(predicate,{timeout}){
    this.timeout=timeout;
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);this.off('response',observe);};
      const observe=response=>{if(predicate(response)){cleanup();resolve(response);}};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Response timed out after '+timeout+'ms'));},timeout);
      this.on('response',observe);
    });
  }
  async request(status=200){
    assert.ok(this.pattern.test(url));
    const respond=status=>this.emit('response',{url:()=>url,status:()=>status});
    await this.handler({fulfill:async options=>respond(options.status),continue:async()=>respond(status)});
  }
}

test('a slow preceding game cannot consume the slot recovery deadline; immediate responses are observed',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const page=new Page();t.mock.timers.tick(61000);
  assert.equal(page.listenerCount('response'),0);
  const result=await verifySlotAtlasRecovery(page,async()=>{assert.equal(page.timeout,60000);await page.request();await page.request();});
  assert.equal(result.attempts,2);assert.deepEqual(result.responses.map(r=>r.status),[503,200]);assert.equal(page.handler,null);assert.equal(page.listenerCount('response'),0);
});

test('the original early wait falsely fails even when the later slot asset recovers',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const page=new Page();
  const early=page.waitForResponse(r=>r.status()===200,{timeout:60000}),failure=assert.rejects(early,/60000ms/);
  t.mock.timers.tick(61000);await failure;
  const result=await verifySlotAtlasRecovery(page,async()=>{await page.request();await page.request();});assert.equal(result.attempts,2);
});

for(const mode of ['never requested','no retry','retry also fails'])test('real recovery regression still fails: '+mode,async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const page=new Page();let entered;
  const action=new Promise(resolve=>{entered=resolve;});
  const result=verifySlotAtlasRecovery(page,async()=>{
    if(mode!=='never requested')await page.request();if(mode==='retry also fails')await page.request(503);entered();
  }),failure=assert.rejects(result,/60000ms/);
  await action;t.mock.timers.tick(59999);assert.ok(page.handler);t.mock.timers.tick(1);await failure;
  assert.equal(page.handler,null);assert.equal(page.listenerCount('response'),0);
});

test('extra retries and an entry action failure cannot pass as successful recovery',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const page=new Page();
  await assert.rejects(verifySlotAtlasRecovery(page,async()=>{await page.request();await page.request(503);await page.request();}),/retried once/);
  const error=new Error('slot navigation failed');await assert.rejects(verifySlotAtlasRecovery(new Page(),()=>{throw error;}),actual=>actual===error);
  t.mock.timers.tick(60000);
});

test('receiving the atlas does not skip the slot readiness check',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const page=new Page();let ready,requested,complete=false;
  const action=new Promise(resolve=>{requested=resolve;}),gate=new Promise(resolve=>{ready=resolve;});
  const result=verifySlotAtlasRecovery(page,async()=>{await page.request();await page.request();requested();await gate;}).then(r=>{complete=true;return r;});
  await action;assert.equal(complete,false);ready();assert.equal((await result).attempts,2);
});
