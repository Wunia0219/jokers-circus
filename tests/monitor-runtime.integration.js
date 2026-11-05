import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {APP_VERSION} from '../src/version.js';
import {alertFingerprint} from '../cloud/operations-health.js';

test('separate real workerd scheduled handler persists deduplication, reports recovery and exposes no public control',async t=>{
  const root=resolve('test-results/monitor-runtime');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'case-'));
  // Only this isolated test wrapper supplies a controlled clock; production has no clock override.
  const script=resolve('test-results/monitor-bundle/runtime-fixture.mjs');
  writeFileSync(script,"import worker,{CircusMonitor} from './worker.js';\nexport class TestMonitor extends CircusMonitor {constructor(ctx,env){super(ctx,env);this.monitor.clock=()=>Number(env.FIXTURE_NOW);}}\nexport default {...worker,async fetch(req,env,ctx){if(new URL(req.url).pathname==='/fixture-scheduled'){await worker.scheduled({cron:'*/10 * * * *'},env,ctx);return new Response('ok');}return worker.fetch(req,env,ctx);}};\n");
  let now=Date.now(),down=true,mf,probes=0;const messages=[],token='c'.repeat(64),origin='https://circus.fixture.workers.dev';
  const q=()=>({used:{reads:0,writes:0,egressBytes:0,storageBytes:0},limits:{reads:100,writes:100,egressBytes:100,storageBytes:100}});
  const config=()=>({name:'monitor-fixture',modules:[{type:'ESModule',path:script},{type:'ESModule',path:resolve('test-results/monitor-bundle/worker.js')}],modulesRoot:resolve('.'),compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{CIRCUS_MONITOR:{className:'TestMonitor',useSQLite:true}},resourcePersistencePath:join(dir,'durable'),bindings:{CLOUD_PLAN:'paid',MONITOR_ENABLED:'true',MONITORED_ORIGIN:origin,MONITORED_TOKEN:token,MONITOR_WEBHOOK_URL:'https://discord.com/api/webhooks/100000000000000005/isolated-operations-fixture',FIXTURE_NOW:String(now)},outboundService:async request=>{
    const url=new URL(request.url);
    if(url.origin===origin&&url.pathname==='/__ops/status'){
      probes++;assert.equal(request.method,'GET');assert.equal(request.headers.get('authorization'),'Bearer '+token);
      return down?new MFResponse(null,{status:503}):MFResponse.json({mode:'active',backup:{ok:true,at:now-1000},alarm:{ok:true,at:now},quota:{...q(),scopes:{maintenance:q(),highlights:q()}}});
    }
    if(url.hostname==='discord.com'&&url.pathname==='/api/webhooks/100000000000000005/isolated-operations-fixture'){
      assert.equal(request.method,'POST');assert.equal(request.headers.has('authorization'),false);assert.equal(url.searchParams.get('wait'),'true');
      const message=await request.json();assert.deepEqual(message.allowed_mentions,{parse:[]});messages.push(message);return MFResponse.json({id:'100000000000000007'});
    }
    throw new Error('External calls are not permitted by this isolated test');
  }});
  const restart=async()=>{if(mf)await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config()));};t.after(()=>mf?.dispose());
  const status=async()=>{const response=await mf.dispatchFetch('http://localhost/__ops/status',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);return response.json();};
  const cron=async()=>{
    const response=await mf.dispatchFetch('http://localhost/fixture-scheduled');assert.equal(response.status,200,await response.text());
    for(let i=0;i<40;i++){const state=await status();if(state.checkedAt===now&&state.delivery!=='sending')return state;await delay(50);}
    assert.fail('Scheduled handler did not finish the isolated monitor check');
  };
  await restart();const health=await (await mf.dispatchFetch('http://localhost/healthz')).json();assert.equal(health.version,APP_VERSION);assert.equal(health.notificationsConfigured,true);
  assert.equal((await mf.dispatchFetch('http://localhost/__ops/status')).status,403);
  assert.equal((await mf.dispatchFetch('http://localhost/check',{method:'POST'})).status,404);
  assert.equal((await mf.dispatchFetch('http://localhost/__ops/backup',{method:'POST',headers:{Authorization:'Bearer '+token}})).status,404);
  assert.equal((await cron()).confirmed,false);assert.equal(messages.length,0);
  now+=600000;await restart();assert.equal((await cron()).delivery,'sent');assert.equal(messages.length,1);
  now+=600000;await restart();await cron();assert.equal(messages.length,1,'sent incident survives DO/process restart');
  down=false;now+=600000;await restart();await cron();assert.equal(messages.length,1);
  for(let i=0;i<3;i++){now+=600000;await restart();await cron();}
  assert.equal(messages.length,2);assert.match(messages[1].content,/服務恢復/);
  await cron();assert.equal(messages.length,2);assert.equal(probes,7,'duplicate Cron in the same minute is suppressed');
  writeFileSync(join(dir,'report.json'),JSON.stringify({realWorkerd:true,scheduledHandler:true,actualCloudCron:false,restartDeduplication:true,recovery:true,noProductionRequests:true,readOnlyProbe:true},null,2));
});

test('real scheduled worker retires legacy quota-only warnings quietly and bounds overnight flapping across restarts',async t=>{
 const root=resolve('test-results/monitor-retirement');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'case-'));
 // This isolated wrapper alone can seed old receipts and control the clock.
 const script=resolve('test-results/monitor-bundle/retirement-fixture.mjs');
 writeFileSync(script,"import worker,{CircusMonitor} from './worker.js';\nexport class TestMonitor extends CircusMonitor {constructor(ctx,env){super(ctx,env);this.monitor.clock=()=>Number(env.FIXTURE_NOW);}async fetch(req){if(new URL(req.url).pathname==='/fixture-seed'){await this.storage.put('monitor-state',await req.json());return Response.json({ok:true});}return super.fetch(req);}}\nexport default {...worker,async fetch(req,env,ctx){if(new URL(req.url).pathname==='/fixture-seed')return env.CIRCUS_MONITOR.get(env.CIRCUS_MONITOR.idFromName(new URL(env.MONITORED_ORIGIN).origin)).fetch(req);if(new URL(req.url).pathname==='/fixture-scheduled'){await worker.scheduled({cron:'*/10 * * * *'},env,ctx);return new Response('ok');}return worker.fetch(req,env,ctx);}};\n");
 let now=Date.now(),failure=null,mf;const messages=[],token='d'.repeat(64),origin='https://circus.fixture.workers.dev';
 const q=()=>({used:{reads:500000,writes:500000,egressBytes:500000,storageBytes:500000},limits:{reads:100,writes:100,egressBytes:100,storageBytes:100},enforcement:'notify-only'});
 const config=()=>({modules:[{type:'ESModule',path:script},{type:'ESModule',path:resolve('test-results/monitor-bundle/worker.js')}],modulesRoot:resolve('.'),compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{CIRCUS_MONITOR:{className:'TestMonitor',useSQLite:true}},resourcePersistencePath:join(dir,'durable'),bindings:{CLOUD_PLAN:'paid',MONITOR_ENABLED:'true',MONITORED_ORIGIN:origin,MONITORED_TOKEN:token,MONITOR_WEBHOOK_URL:'https://discord.com/api/webhooks/100000000000000005/isolated-operations-fixture',FIXTURE_NOW:String(now)},outboundService:async request=>{
   const url=new URL(request.url);
   if(url.origin===origin&&url.pathname==='/__ops/status')return MFResponse.json({mode:'active',backup:{ok:true,at:now-1000},alarm:{ok:failure!=='failed',at:failure==='stale'?now-31*60000:now},quota:{...q(),scopes:{maintenance:q(),highlights:q()}}});
   if(url.hostname==='discord.com'){const message=await request.json();assert.deepEqual(message.allowed_mentions,{parse:[]});messages.push(message);return MFResponse.json({id:'100000000000000007'});}
   throw new Error('Isolated monitor forbids external services');
 }});
 const restart=async()=>{if(mf)await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(config()));};t.after(()=>mf?.dispose());
 const status=async()=>{const r=await mf.dispatchFetch('http://localhost/__ops/status',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);return r.json();};
 const tick=async()=>{
   now+=600000;await restart();await mf.dispatchFetch('http://localhost/fixture-scheduled');
   for(let i=0;i<40;i++){const s=await status();if(s.checkedAt===now&&s.delivery!=='sending')return s;await delay(50);}
   assert.fail('Scheduled retirement check did not finish');
 };
 await restart();const oldTime=now-600000,fp=alertFingerprint([{code:'QUOTA_HIGH',severity:'warning',scope:'global'},{code:'BACKUP_DELAYED',severity:'warning'}]);
 assert.equal((await mf.dispatchFetch('http://localhost/fixture-seed',{method:'POST',body:JSON.stringify({notified:fp,count:2,alerts:[{code:'QUOTA_HIGH',severity:'warning',scope:'global'}],pending:{fingerprint:fp,status:'sent',at:oldTime}})})).status,200);
 let s;for(let i=0;i<4;i++)s=await tick();assert.equal(messages.length,0);assert.deepEqual(s.alerts,[]);assert.equal(s.lastAttemptAt,oldTime);assert.equal(s.lastNotificationAt,oldTime);
 for(let cycle=0;cycle<6;cycle++){
   failure=cycle%2?'stale':'failed';for(let i=0;i<2;i++)await tick();
   failure=null;for(let i=0;i<4;i++)s=await tick();
 }
 assert.equal(messages.length,2,'restart plus hourly alarm changes cannot repost six overnight incidents');assert.match(messages[1].content,/服務恢復/);
 assert.ok(messages.every(m=>!m.content.includes('Firestore')));assert.deepEqual(s.alerts,[]);
 writeFileSync(join(dir,'report.json'),JSON.stringify({ok:true,realWorkerd:true,scheduledHandler:true,legacyRetirementQuiet:true,overnightCycles:6,notificationCount:messages.length,allRestartsDeduplicated:true,noProductionRequests:true},null,2));
});
