import test from 'node:test';
import assert from 'node:assert/strict';
import {operationsHealth,alertFingerprint,notificationPayload} from '../cloud/operations-health.js';
import {ServiceMonitor,monitorSettings} from '../monitor/check.js';

const START=Date.UTC(2026,9,24,12),TEN_MINUTES=600000;
const quota=()=>({used:{reads:10,writes:0,egressBytes:0,storageBytes:10},limits:{reads:100,writes:100,egressBytes:1000,storageBytes:1000},blocked:false});
const healthy=(now=START)=>({mode:'active',backup:{ok:true,at:now-1000},alarm:{ok:true,at:now},quota:{...quota(),scopes:{maintenance:quota(),highlights:quota()}}});
const webhook='https://discord.com/api/webhooks/100000000000000005/isolated-operations-fixture';

test('casino delivery failures warn without exposing player amounts or changing game availability',()=>{
 const status={...healthy(),casino:{activeVisits:1,pending:2,oldestPendingAt:START-600001,uncertain:1}};
 const health=operationsHealth(status,{now:START});assert.equal(health.level,'warning');assert.equal(health.alerts.length,2);
 const text=notificationPayload(health.alerts,START).content;assert.match(text,/出入場公告/);assert.doesNotMatch(text,/餘額|token|玩家名稱/);
 assert.equal(status.mode,'active');assert.equal(status.backup.ok,true);
});
test('backup capacity warns before the full-history limit without treating legacy metadata as a failure',()=>{
 const s=healthy();assert.equal(operationsHealth(s,{now:START}).ok,true);
 s.backup.bytes=80;s.backup.limitBytes=100;assert.ok(operationsHealth(s,{now:START}).alerts.some(a=>a.code==='BACKUP_CAPACITY_HIGH'));
 s.backup.bytes=100;const alerts=operationsHealth(s,{now:START}).alerts;assert.ok(alerts.some(a=>a.code==='BACKUP_CAPACITY_EXHAUSTED'&&a.severity==='critical'));
 assert.match(notificationPayload(alerts,START).content,/完整備份容量已達上限/);
 s.backup.bytes=1;s.backup.parts=80;s.backup.limitParts=100;assert.ok(operationsHealth(s,{now:START}).alerts.some(a=>a.code==='BACKUP_CAPACITY_HIGH'));
 s.backup.parts=100;assert.equal(operationsHealth(s,{now:START}).alerts.filter(a=>a.code==='BACKUP_CAPACITY_EXHAUSTED').length,1);
});
function fixture(){
  let now=START,target=()=>Response.json(healthy(now)),delivery=()=>Response.json({id:'100000000000000007'});
  const values=new Map(),messages=[],requests=[];
  const storage={async get(key){return structuredClone(values.get(key));},async put(key,value){values.set(key,structuredClone(value));}};
  const env={CLOUD_PLAN:'free',MONITOR_ENABLED:'true',MONITORED_ORIGIN:'https://circus.fixture.workers.dev',MONITORED_TOKEN:'b'.repeat(64),MONITOR_WEBHOOK_URL:webhook};
  const fetchImpl=async(url,options)=>{
    requests.push({url:String(url),method:options.method});assert.equal(options.redirect,'manual');
    if(new URL(url).pathname==='/__ops/status'){
      assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer '+env.MONITORED_TOKEN);return target();
    }
    assert.equal(String(url),webhook+'?wait=true');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,undefined);
    const message=JSON.parse(options.body);assert.deepEqual(message.allowed_mentions,{parse:[]});messages.push(message);return delivery();
  };
  const create=()=>new ServiceMonitor(storage,env,{fetchImpl,clock:()=>now});
  return {env,values,storage,messages,requests,create,get now(){return now;},advance(ms=TEN_MINUTES){now+=ms;},target(fn){target=fn;},delivery(fn){delivery=fn;}};
}
const tick=async(f,monitor)=>{f.advance();return monitor.check();};

test('maintenance health reports backup/alarm failures and every quota scope without exposing player data',()=>{
  const status=healthy();assert.equal(operationsHealth(status,{now:START}).ok,true);
  status.backup.at=START-49*3600000;status.alarm.ok=false;status.quota.scopes.maintenance.used.reads=80;status.quota.scopes.highlights.used.reads=100;
  const result=operationsHealth(status,{now:START});
  assert.deepEqual(result.alerts.map(a=>[a.code,a.scope||null]),[['ALARM_FAILED',null],['BACKUP_STALE',null],['QUOTA_EXHAUSTED','highlights']]);
  assert.equal(result.quotaPercent.maintenance.reads,80);assert.equal(result.level,'critical');
  status.backup.at=START+61000;status.alarm.at=0;status.quota=null;
  assert.deepEqual(operationsHealth(status,{now:START}).alerts.map(a=>a.code),['ALARM_MISSING','BACKUP_MISSING','QUOTA_UNAVAILABLE']);
});

test('backup lateness, stale alarms and invalid quota fail visibly at the documented thresholds',()=>{
  const status=healthy();status.backup.at=START-26*3600000;status.alarm.at=START-30*60000;status.quota.used.reads=NaN;
  assert.deepEqual(operationsHealth(status,{now:START}).alerts.map(a=>a.code),['ALARM_STALE','BACKUP_DELAYED','QUOTA_UNAVAILABLE']);
  status.mode='paused';assert.ok(operationsHealth(status,{now:START}).alerts.some(a=>a.code==='SERVICE_NOT_ACTIVE'));
});

test('free and paid account plans keep identical monitor safety checks',()=>{
  const f=fixture();for(const plan of ['free','paid'])assert.equal(monitorSettings({...f.env,CLOUD_PLAN:plan}).origin.origin,'https://circus.fixture.workers.dev');
});
test('disabled or unsafe monitor configuration never contacts a target or notification endpoint',async()=>{
  for(const change of [{MONITOR_ENABLED:'false'},{CLOUD_PLAN:'unknown'},{CLOUD_PLAN:''},{MONITORED_ORIGIN:'http://127.0.0.1'},{MONITORED_ORIGIN:'https://circus.fixture.workers.dev/other'},{MONITORED_ORIGIN:'https://user:secret@circus.fixture.workers.dev'},{MONITORED_TOKEN:'missing'},{MONITOR_WEBHOOK_URL:'https://untrusted.invalid/token'},{DISCORD_HIGHLIGHTS_WEBHOOK_URL:webhook}]){
    const f=fixture();Object.assign(f.env,change);assert.throws(()=>monitorSettings(f.env));assert.deepEqual(await f.create().check(),{configured:false,delivery:'disabled'});assert.equal(f.requests.length,0);
  }
});

test('unchanged healthy checks stay quiet; persistent alerts and recovery each notify once across restart',async()=>{
  const f=fixture();let monitor=f.create();await monitor.check();await tick(f,monitor);assert.equal(f.messages.length,0);
  f.target(()=>new Response(null,{status:503}));await tick(f,monitor);assert.equal(f.messages.length,0);await tick(f,monitor);assert.equal(f.messages.length,1);
  monitor=f.create();await tick(f,monitor);assert.equal(f.messages.length,1);
  f.target(()=>Response.json(healthy(f.now)));await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,1,'brief recovery cannot re-arm flapping alarms');
  await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,2);assert.match(f.messages[1].content,/服務恢復/);
  await tick(f,f.create());assert.equal(f.messages.length,2);assert.ok(!JSON.stringify([...f.values]).includes(f.env.MONITORED_TOKEN));
});

test('free allowance percentages stay quiet while a real enforced exhaustion still notifies',async()=>{
  const f=fixture();let used=80;f.target(()=>{const s=healthy(f.now);s.quota.used.reads=used;return Response.json(s);});const monitor=f.create();
  await monitor.check();await tick(f,monitor);assert.equal(f.messages.length,0);
  used=90;await tick(f,monitor);assert.equal(f.messages.length,0);
  used=100;await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,1);assert.match(f.messages[0].content,/使用額度已達上限/);
});

test('individual incidents survive changing alert sets and restarts; stable warnings are not reposted',async()=>{
 const f=fixture();let failed=false,stale=false,monitor=f.create();
 f.target(()=>{const s=healthy(f.now);s.backup.at=f.now-(stale?49:30)*3600000;s.alarm.ok=!failed;s.quota.enforcement='notify-only';s.quota.used.reads=90;return Response.json(s);});
 for(const value of [false,true,false,true,false]){
   failed=value;monitor=f.create();await tick(f,monitor);await tick(f,monitor);
 }
 assert.equal(f.messages.length,2,'one backup message and one new alarm incident');
 assert.match(f.messages[0].content,/備份超過 26 小時/);
 assert.match(f.messages[1].content,/背景排程失敗/);
 assert.doesNotMatch(f.messages[1].content,/備份超過|八成/,'new incident does not repeat old warnings');
 // A genuine escalation must still notify despite the existing warning receipt.
 stale=true;await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,3);
 assert.match(f.messages[2].content,/備份超過 48 小時/);
 // A sustained partial recovery alone must not bypass the family cooldown.
 for(let i=0;i<4;i++)await tick(f,monitor);
 failed=true;await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,3);
 f.advance(6*3600000);await tick(f,monitor);assert.equal(f.messages.length,4);
 assert.match(f.messages[3].content,/背景排程失敗/);
});

test('a stable warning confirms independently of a flapping alarm, and legacy receipts migrate quietly',async()=>{
 const f=fixture();let failed=true;
 f.target(()=>{const s=healthy(f.now);s.backup.at=f.now-30*3600000;s.alarm.ok=!failed;return Response.json(s);});
 await tick(f,f.create());failed=false;await tick(f,f.create());assert.equal(f.messages.length,1);
 assert.match(f.messages[0].content,/備份超過 26 小時/);
 assert.doesNotMatch(f.messages[0].content,/背景排程失敗/);
 const state=f.values.get('monitor-state');delete state.incidents;delete state.hadIncident;f.values.set('monitor-state',state);
 await tick(f,f.create());assert.equal(f.messages.length,1,'upgrade retains existing delivered alert receipts');
});

test('uncertain delivery stays acknowledged when other incidents appear and disappear',async()=>{
 const f=fixture();let failed=false;
 f.target(()=>{const s=healthy(f.now);s.backup.at=f.now-30*3600000;s.alarm.ok=!failed;return Response.json(s);});
 f.delivery(()=>{throw new Error('Unknown POST outcome');});
 await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,1);
 failed=true;await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,2);
 assert.doesNotMatch(f.messages[1].content,/備份超過/);
 failed=false;await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,2);
 failed=true;await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,2,'set changes cannot resend either uncertain incident');
});

test('legacy blocked incidents and global Retry-After survive changes in the outgoing alert set',async()=>{
 const f=fixture();const blocked=[{code:'BACKUP_DELAYED',severity:'warning'},{code:'ALARM_FAILED',severity:'critical'}];
 f.values.set('monitor-state',{notified:alertFingerprint([]),count:0,pending:{fingerprint:alertFingerprint(blocked),status:'blocked'}});
 f.target(()=>{const s=healthy(f.now);s.backup.at=f.now-30*3600000;return Response.json(s);});
 await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,0,'partial recovery must not bypass a legacy blocked receipt');
 const g=fixture();let failed=false;
 g.target(()=>{const s=healthy(g.now);s.backup.at=g.now-30*3600000;s.alarm.ok=!failed;return Response.json(s);});
 g.delivery(()=>Response.json({retry_after:3600},{status:429}));
 await tick(g,g.create());await tick(g,g.create());assert.equal(g.messages.length,1);
 failed=true;await tick(g,g.create());await tick(g,g.create());assert.equal(g.messages.length,1,'new alert must honor the existing webhook retry deadline');
 g.delivery(()=>Response.json({id:'100000000000000009'}));g.advance(3600000);await g.create().check();assert.equal(g.messages.length,2);assert.match(g.messages[1].content,/背景排程失敗/);
});

test('notification-only allowance crossing stays quiet for every metric/scope and preserves accounting',async()=>{
 const f=fixture();let used=79;
 const status=()=>{const s=healthy(f.now);for(const q of [s.quota,...Object.values(s.quota.scopes)]){q.enforcement='notify-only';for(const key of Object.keys(q.used))q.used[key]=q.limits[key]*used/100;}return s;};
 f.target(()=>Response.json(status()));
 for(const value of [79,80,99,100,150,5000,10]){
   used=value;const s=status(),original=structuredClone(s),health=operationsHealth(s,{now:f.now});
   assert.deepEqual(s,original,'health never changes counters or caps');assert.deepEqual(health.alerts,[]);
   for(const scope of ['global','maintenance','highlights'])for(const percent of Object.values(health.quotaPercent[scope]))assert.equal(percent,value);
   for(let i=0;i<4;i++)await tick(f,f.create());
 }
 assert.equal(f.messages.length,0,'no threshold or artificial recovery notifications');
});

test('six hours of overnight flapping and alarm label changes generate one incident and one recovery',async()=>{
 const f=fixture();let failure=null;
 f.target(()=>{const s=healthy(f.now);if(failure==='failed')s.alarm.ok=false;if(failure==='stale')s.alarm.at=f.now-31*60000;return Response.json(s);});
 for(let cycle=0;cycle<6;cycle++){
   failure=cycle%2?'stale':'failed';for(let i=0;i<2;i++)await tick(f,f.create());
   failure=null;for(let i=0;i<4;i++)await tick(f,f.create());
 }
 assert.equal(f.messages.length,2,'same-family hourly flapping cannot create an overnight message storm');
 assert.match(f.messages[0].content,/背景排程失敗/);assert.match(f.messages[1].content,/服務恢復/);
 failure='stale';await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,3,'genuine recurrence can notify after six hours');
 f.target(()=>new Response(null,{status:401}));await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,4,'independent critical authorization failure is not muted');
 assert.match(f.messages[3].content,/監控授權失效/);
});

test('a backup severity escalation bypasses family cooldown while downgrade stays quiet',async()=>{
 const f=fixture();let hours=30;
 f.target(()=>{const s=healthy(f.now);s.backup.at=f.now-hours*3600000;return Response.json(s);});
 await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,1);
 hours=49;await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,2);assert.match(f.messages[1].content,/48 小時/);
 hours=0;for(let i=0;i<4;i++)await tick(f,f.create());assert.equal(f.messages.length,3);
 hours=30;await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,3,'downgrading after recovery cannot bypass a recent critical receipt');
});

test('retired quota-only receipts and pending sends disappear without synthetic recovery messages',async()=>{
 for(const status of ['sent','retry','sending','uncertain','blocked','unconfigured']){
   const f=fixture(),old=[{code:'QUOTA_HIGH',severity:'warning',scope:'global'},{code:'QUOTA_HIGH',severity:'warning',scope:'maintenance'}],fp=alertFingerprint(old);
   f.values.set('monitor-state',{notified:fp,hadIncident:true,count:2,observed:fp,alerts:old,pending:{fingerprint:fp,status,at:START,nextAttempt:START+3600000},incidents:Object.fromEntries(old.map(a=>[JSON.stringify([a.code,a.severity,a.scope]),{announced:true,count:2}]))});
   f.target(()=>{const s=healthy(f.now);s.quota.enforcement='notify-only';s.quota.used.reads=10000;return Response.json(s);});
   for(let i=0;i<6;i++)await tick(f,f.create());
   const state=f.values.get('monitor-state');assert.equal(f.messages.length,0,status);assert.equal(state.hadIncident,false);assert.equal(state.pending,null);assert.deepEqual(state.alerts,[]);
 }
 // An unsent real incident bundled with a retired quota warning is not a recovery.
 const f=fixture(),quotaAlert={code:'QUOTA_HIGH',severity:'warning',scope:'global'};
 f.values.set('monitor-state',{notified:alertFingerprint([quotaAlert]),hadIncident:true,pending:{fingerprint:alertFingerprint([quotaAlert,{code:'ALARM_FAILED',severity:'critical'}]),status:'retry',nextAttempt:START+3600000}});
 for(let i=0;i<6;i++)await tick(f,f.create());assert.equal(f.messages.length,0);
 // The previous real backup issue may have recovered while quota warnings kept
 // the old global incident open. Policy removal must not send its late recovery.
 const g=fixture(),old=alertFingerprint([quotaAlert,{code:'BACKUP_DELAYED',severity:'warning'}]);
 g.values.set('monitor-state',{notified:old,hadIncident:true,alerts:[quotaAlert],pending:{fingerprint:old,status:'sent',at:START}});
 for(let i=0;i<6;i++)await tick(g,g.create());assert.equal(g.messages.length,0,'no belated recovery from the retired policy');
});

test('retiring mixed pending warnings preserves real incidents and all uncertain outcome receipts',async()=>{
 for(const status of ['retry','sending','uncertain']){
   const f=fixture(),alarm={code:'ALARM_FAILED',severity:'critical'},old=[alarm,{code:'QUOTA_HIGH',severity:'warning',scope:'global'}];
   f.values.set('monitor-state',{notified:status==='uncertain'?alertFingerprint(old):alertFingerprint([]),pending:{fingerprint:alertFingerprint(old),status,at:START,nextAttempt:START+3600000}});
   f.target(()=>{const s=healthy(f.now);s.alarm.ok=false;return Response.json(s);});
   for(let i=0;i<2;i++)await tick(f,f.create());assert.equal(f.messages.length,0,'no early retry or unknown-outcome resend');
   f.advance(3600000);await tick(f,f.create());
   assert.equal(f.messages.length,status==='retry'?1:0,status);
   if(status==='retry'){assert.match(f.messages[0].content,/背景排程失敗/);assert.doesNotMatch(f.messages[0].content,/Firestore|八成/);}
 }
});

test('persistent short Discord rate limits gain durable exponential backoff across changed alert sets',async()=>{
 const f=fixture();let authFailure=false;
 f.target(()=>authFailure?new Response(null,{status:401}):new Response(null,{status:503}));
 f.delivery(()=>Response.json({retry_after:1},{status:429}));
 await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,1);
 for(let attempt=2;attempt<=8;attempt++){
   const previous=f.values.get('monitor-state'),deadline=previous.retryAfter;
   f.advance(Math.max(60000,deadline-f.now));await f.create().check();
   assert.equal(f.messages.length,attempt);const state=f.values.get('monitor-state');
   assert.equal(state.retryAfter-f.now,Math.min(3600000,60000*2**(attempt-1)));
 }
 const count=f.messages.length;authFailure=true;await tick(f,f.create());await tick(f,f.create());assert.equal(f.messages.length,count,'changed alerts cannot shorten global backoff');
});

test('missing notification destination records confirmed health without sending; later configuration can notify',async()=>{
  const f=fixture();delete f.env.MONITOR_WEBHOOK_URL;f.target(()=>new Response(null,{status:503}));const monitor=f.create();
  await monitor.check();assert.equal((await tick(f,monitor)).delivery,'unconfigured');assert.equal(f.messages.length,0);
  f.env.MONITOR_WEBHOOK_URL=webhook;assert.equal((await tick(f,f.create())).delivery,'sent');assert.equal(f.messages.length,1);
});

test('transient errors recover quietly and simultaneous/duplicate checks use a single probe',async()=>{
  const f=fixture();let resolve;f.target(()=>new Promise(r=>resolve=r));const monitor=f.create();const a=monitor.check(),b=monitor.check();
  await new Promise(r=>setImmediate(r));resolve(new Response(null,{status:503}));await Promise.all([a,b]);assert.equal(f.requests.length,1);
  await f.create().check();assert.equal(f.requests.length,1,'same-minute duplicate is suppressed after restart');
  f.target(()=>Response.json(healthy(f.now)));await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,0);
});

test('429 honors Retry-After across restart and cancels an unsent alert when service recovers',async()=>{
  const f=fixture();f.target(()=>new Response(null,{status:503}));f.delivery(()=>Response.json({retry_after:7200},{status:429}));let monitor=f.create();
  await monitor.check();assert.equal((await tick(f,monitor)).delivery,'retry');assert.equal(f.messages.length,1);
  monitor=f.create();await tick(f,monitor);assert.equal(f.messages.length,1);
  f.target(()=>Response.json(healthy(f.now)));await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,1);assert.equal(f.values.get('monitor-state').pending,null);
});

test('429 retries only after the declared interval and acknowledges the successful notification',async()=>{
  const f=fixture();f.target(()=>new Response(null,{status:503}));f.delivery(()=>new Response('{}',{status:429,headers:{'retry-after':'1800'}}));const monitor=f.create();
  await monitor.check();await tick(f,monitor);await tick(f,monitor);assert.equal(f.messages.length,1);
  f.delivery(()=>Response.json({id:'100000000000000008'}));f.advance(1800000);assert.equal((await f.create().check()).delivery,'sent');assert.equal(f.messages.length,2);
  await tick(f,f.create());assert.equal(f.messages.length,2);
});

test('lost POST responses and interrupted sending intents remain uncertain and are never blindly repeated',async()=>{
  for(const failure of ['network','server','bad-message','interrupted']){
    const f=fixture();f.target(()=>new Response(null,{status:503}));const monitor=f.create();
    if(failure==='network')f.delivery(()=>{throw new Error('secret upstream body');});
    if(failure==='server')f.delivery(()=>new Response(null,{status:500}));
    if(failure==='bad-message')f.delivery(()=>Response.json({unexpected:'not-a-message'}));
    await monitor.check();
    if(failure==='interrupted'){
      const fp=alertFingerprint([{code:'SERVICE_UNREACHABLE',severity:'critical'}]);
      const state=f.values.get('monitor-state');state.pending={fingerprint:fp,status:'sending'};f.values.set('monitor-state',state);
    }else assert.equal((await tick(f,monitor)).delivery,'uncertain');
    const sent=f.messages.length;assert.equal((await tick(f,f.create())).delivery,'uncertain');await tick(f,f.create());assert.equal(f.messages.length,sent);
    assert.ok(!JSON.stringify([...f.values]).includes('secret upstream body'));
  }
});

test('definitive notification rejection stays blocked and no unapproved redirects are followed',async()=>{
  const f=fixture();f.target(()=>new Response(null,{status:503}));f.delivery(()=>new Response(null,{status:403}));const monitor=f.create();
  await monitor.check();assert.equal((await tick(f,monitor)).delivery,'blocked');await tick(f,f.create());assert.equal(f.messages.length,1);
  const g=fixture();g.target(()=>new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}}));await g.create().check();assert.equal(g.requests.length,1);
});

test('monitor does not post unless its persistent sending intent has been saved',async()=>{
  const f=fixture();f.target(()=>new Response(null,{status:503}));const monitor=f.create();await monitor.check();
  const put=f.storage.put;f.storage.put=async(key,value)=>{if(value.pending?.status==='sending')throw new Error('Storage unavailable');return put(key,value);};
  f.advance();await assert.rejects(monitor.check(),/Storage unavailable/);assert.equal(f.messages.length,0);
});

test('401, malformed responses and arbitrary player fields produce only safe aggregate notification text',async()=>{
  for(const response of [()=>new Response(null,{status:401}),()=>Response.json({playerId:'private-player',mode:'invalid'}),()=>{throw new Error('token=private-token');}]){
    const f=fixture();f.target(response);const monitor=f.create();await monitor.check();await tick(f,monitor);assert.equal(f.messages.length,1);
    assert.ok(!JSON.stringify(f.messages).includes('private-'));assert.ok(!JSON.stringify([...f.values]).includes('private-'));
  }
  const payload=notificationPayload([{code:'<@everyone>',scope:'secret',severity:'critical'}],START);assert.ok(!payload.content.includes('<@'));assert.deepEqual(payload.allowed_mentions,{parse:[]});
});
