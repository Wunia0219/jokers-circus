import {cloudPlan} from '../cloud/plan.js';
import {operationsHealth,alertFingerprint,notificationPayload} from '../cloud/operations-health.js';
import {operationsWebhook,postNotification} from './discord.js';

const EMPTY=alertFingerprint([]),TIMEOUT=10000,MIN_CHECK_GAP=60000,RECOVERY_MS=30*60000,INCIDENT_COOLDOWN_MS=6*3600000;
const alertKey=a=>JSON.stringify([a.code,a.severity,a.scope||'']);
const fingerprintAlerts=fingerprint=>JSON.parse(fingerprint||EMPTY).map(([code,severity,scope])=>({code,severity,...(scope?{scope}:{})}));
const retained=alerts=>alerts.filter(a=>a.code!=='QUOTA_HIGH');
const family=a=>JSON.stringify([a.code.startsWith('ALARM_')?'ALARM':
  /^BACKUP_CAPACITY_/.test(a.code)?'BACKUP_CAPACITY':a.code.startsWith('BACKUP_')?'BACKUP':a.code,a.scope||'']);
const severity=a=>a.severity==='critical'?2:1;
export function monitorSettings(env){
  cloudPlan(env.CLOUD_PLAN);
  if(env.MONITOR_ENABLED!=='true')throw new Error('Monitor is disabled');
  const origin=new URL(env.MONITORED_ORIGIN);
  if(origin.protocol!=='https:'||!/^[-a-z0-9]+\.[-a-z0-9]+\.workers\.dev$/.test(origin.hostname)||origin.pathname!=='/'||origin.port||origin.search||origin.hash||origin.username||origin.password||!/^[a-f0-9]{64}$/i.test(env.MONITORED_TOKEN||''))throw new Error('Monitor configuration required');
  let webhook=null;
  if(env.MONITOR_WEBHOOK_URL){
    webhook=operationsWebhook(env.MONITOR_WEBHOOK_URL);
    if(env.DISCORD_HIGHLIGHTS_WEBHOOK_URL)throw new Error('Game announcement credentials must not be configured in the monitor');
  }
  return {origin,token:env.MONITORED_TOKEN,webhook};
}

async function probe(settings,fetchImpl,now){
  let response;
  try{response=await fetchImpl(new URL('/__ops/status',settings.origin),{method:'GET',headers:{Authorization:'Bearer '+settings.token},redirect:'manual',signal:AbortSignal.timeout(TIMEOUT)});}
  catch{return [{code:'SERVICE_UNREACHABLE',severity:'critical'}];}
  if(response.status===401||response.status===403)return [{code:'STATUS_UNAUTHORIZED',severity:'critical'}];
  if(!response.ok)return [{code:'SERVICE_UNREACHABLE',severity:'critical'}];
  try{
    const status=await response.json();
    if(!status||!['active','paused','released','unseeded'].includes(status.mode))throw new Error('Invalid status');
    return operationsHealth(status,{now}).alerts;
  }catch{return [{code:'STATUS_INVALID',severity:'critical'}];}
}

// Persistent intent is saved BEFORE POST. Unknown outcomes are never blindly resent.
export class ServiceMonitor {
  constructor(storage,env,{fetchImpl=globalThis.fetch.bind(globalThis),clock=Date.now}={}){Object.assign(this,{storage,env,fetchImpl,clock});}
  check(){this.running ||= this.run().finally(()=>this.running=null);return this.running;}
  async run(){
    let settings;try{settings=monitorSettings(this.env);}catch{return {configured:false,delivery:'disabled'};}
    const now=this.clock(),state=await this.storage.get('monitor-state')||{notified:EMPTY,count:0};
    // Migrate existing receipts without reposting the alerts already delivered.
    state.incidents ||= Object.fromEntries(fingerprintAlerts(state.notified).map(a=>[alertKey(a),{announced:true,count:0}]));
    state.hadIncident ??= state.notified!==EMPTY;
    state.lastAttemptAt ??= state.pending?.at??null;
    state.lastNotificationAt ??= state.pending?.status==='sent'?state.pending.at??null:null;
    if(state.pending?.status==='retry'&&Number.isSafeInteger(state.pending.nextAttempt))state.retryAfter=Math.max(state.retryAfter||0,state.pending.nextAttempt);
    if(fingerprintAlerts(state.notified).some(a=>a.code==='QUOTA_HIGH')||(state.alerts||[]).some(a=>a.code==='QUOTA_HIGH')||fingerprintAlerts(state.pending?.fingerprint).some(a=>a.code==='QUOTA_HIGH'))state.retiringQuota=true;
    // Retire only the free-allowance warnings, including old pending retries.
    // Removing a notification policy is not a service recovery event.
    state.notified=alertFingerprint(retained(fingerprintAlerts(state.notified)));
    state.alerts=retained(state.alerts||[]);
    for(const key of Object.keys(state.incidents))if(JSON.parse(key)[0]==='QUOTA_HIGH')delete state.incidents[key];
    if(state.pending){
      const active=retained(fingerprintAlerts(state.pending.fingerprint));
      if(!active.length&&state.pending.fingerprint!==EMPTY)state.pending=null;
      else state.pending.fingerprint=alertFingerprint(active);
    }
    const pendingAcknowledged=state.pending?.fingerprint!==EMPTY&&['sending','sent','uncertain'].includes(state.pending?.status);
    if(state.notified===EMPTY&&!Object.values(state.incidents).some(i=>i.announced)&&!pendingAcknowledged)state.hadIncident=false;
    // Unlike active incidents, delivery history survives a healthy interval.
    // Seed old receipts conservatively so upgrades cannot re-arm them at once.
    if(!state.deliveryHistory){
      state.deliveryHistory={};
      for(const [key,i] of Object.entries(state.incidents))if(i.announced){
        const [code,level,scope]=JSON.parse(key),a={code,severity:level,scope};
        const prior=state.deliveryHistory[family(a)];
        state.deliveryHistory[family(a)]={at:state.pending?.at||state.checkedAt||now,severity:Math.max(prior?.severity||0,severity(a))};
      }
    }
    for(const [key,receipt] of Object.entries(state.deliveryHistory))if(JSON.parse(key)[0]==='QUOTA_HIGH'||now-receipt.at>=INCIDENT_COOLDOWN_MS)delete state.deliveryHistory[key];
    const acknowledge=(pending,status)=>{
      for(const a of fingerprintAlerts(pending.fingerprint)){
        const incident=state.incidents[alertKey(a)] ||= {count:0};
        if(status==='blocked')incident.blocked=true;else incident.announced=true;
        if(status!=='blocked')state.deliveryHistory[family(a)]={at:now,severity:Math.max(state.deliveryHistory[family(a)]?.severity||0,severity(a))};
      }
      if(status!=='blocked'){
        state.notified=pending.fingerprint;
        state.hadIncident=pending.fingerprint!==EMPTY;
      }
    };
    if(state.pending?.status==='blocked')acknowledge(state.pending,'blocked');
    if(state.pending?.status==='sending'){
      state.pending.status='uncertain';acknowledge(state.pending,'uncertain');
      await this.storage.put('monitor-state',state);
    }
    if(Number.isSafeInteger(state.checkedAt)&&now-state.checkedAt<MIN_CHECK_GAP){await this.storage.put('monitor-state',state);return {configured:true,checkedAt:state.checkedAt,alerts:state.alerts||[],confirmed:state.count>=2,delivery:state.pending?.status||'idle'};}
    const alerts=await probe(settings,this.fetchImpl,now),fingerprint=alertFingerprint(alerts);
    if(state.retiringQuota){
      if(!alerts.length){state.hadIncident=false;if(state.pending?.fingerprint===EMPTY)state.pending=null;}
      delete state.retiringQuota;
    }
    state.count=state.observed===fingerprint?Math.min(2,state.count+1):1;
    state.observed=fingerprint;state.checkedAt=now;state.alerts=alerts;
    const present=new Set(alerts.map(alertKey));
    for(const [key,incident] of Object.entries(state.incidents)){
      if(present.has(key))continue;
      incident.count=0;incident.missingSince ??= now;
      // An intermittent healthy check must not re-arm a chronic alarm.
      if(now-incident.missingSince>=RECOVERY_MS)delete state.incidents[key];
    }
    for(const a of alerts){const incident=state.incidents[alertKey(a)] ||= {count:0};incident.count=Math.min(2,incident.count+1);delete incident.missingSince;}
    if(alerts.length)delete state.clearSince;else state.clearSince ??= now;
    const save=async()=>{await this.storage.put('monitor-state',state);return {configured:true,checkedAt:now,alerts,confirmed:state.count>=2,delivery:state.pending?.status||'idle'};};
    const fresh=alerts.filter(a=>{
      const i=state.incidents[alertKey(a)],last=state.deliveryHistory[family(a)];
      return i.count>=2&&!i.announced&&!i.blocked&&(!last||severity(a)>last.severity);
    });
    const recovery=!alerts.length&&state.hadIncident&&now-state.clearSince>=RECOVERY_MS;
    if(!fresh.length&&!recovery){
      if(state.pending&&['pending','retry','unconfigured'].includes(state.pending.status))state.pending=null;
      return save();
    }
    // Send only newly confirmed incidents. Partial recovery is kept in status,
    // rather than reposting all unchanged warnings with a different set hash.
    const outgoing=recovery?[]:fresh,deliveryFingerprint=alertFingerprint(outgoing);
    if(state.pending?.fingerprint!==deliveryFingerprint)state.pending={fingerprint:deliveryFingerprint,status:'pending'};
    const pending=state.pending;
    if(['uncertain','blocked'].includes(pending.status))return save();
    if(!settings.webhook){pending.status='unconfigured';return save();}
    if(Math.max(pending.nextAttempt||0,state.retryAfter||0)>now)return save();
    pending.status='sending';pending.at=now;state.lastAttemptAt=now;await this.storage.put('monitor-state',state);
    Object.assign(pending,await postNotification(settings.webhook,notificationPayload(outgoing,now),{fetchImpl:this.fetchImpl,now}));
    if(pending.status==='retry'){
      state.deliveryRetries=Math.min(16,(state.deliveryRetries||0)+1);
      state.retryAfter=pending.nextAttempt=Math.max(pending.nextAttempt,now+Math.min(3600000,60000*2**(state.deliveryRetries-1)));
    }else{state.deliveryRetries=0;state.retryAfter=0;}
    if(pending.status==='sent')state.lastNotificationAt=now;
    if(['sent','uncertain','blocked'].includes(pending.status))acknowledge(pending,pending.status);
    return save();
  }
}
