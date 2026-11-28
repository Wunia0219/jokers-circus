import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {WalletStore} from '../../server/wallet/wallet.js';
import {FirestoreWalletStore} from '../../server/firestore/wallet.js';
import {firestoreImportPlan,importFirestore} from '../../server/firestore/import.js';
import {snapshotForCloud} from '../../server/recovery/cloud-handoff.js';
import {QUOTA_LIMITS} from '../../cloud/quota.js';

const projectId='demo-jokers-circus',emulator='127.0.0.1:8787',guild='100000000000000001';
const users=Array.from({length:96},(_,i)=>String(100000000000000100n+BigInt(i)));
const boardPath='/api/arcade/leaderboard?period=all&game=slot';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,emulator);
const root=resolve('test-results/leaderboard-load');

function summary(values){
  if(!values.length)return null;
  const sorted=values.toSorted((a,b)=>a-b);
  const percentile=p=>Math.round(sorted[Math.ceil(p*sorted.length)-1]);
  return {p50:percentile(.5),p95:percentile(.95),max:percentile(1)};
}

async function scenario(boardEnabled,report){
  const dir=mkdtempSync(join(root,'run-')),source=join(dir,'seed.sqlite');
  const local=new WalletStore({filename:source,environment:'test',guildIds:[guild]});
  try{for(const user of users)local.state(guild,user);}finally{local.close();}
  const namespace='load-'+randomUUID()+'-test';
  const settings={projectId,namespace,schemaVersion:2,environment:'test',emulator,quota:{projectId,filename:join(dir,'import.sqlite')}};
  const store=new FirestoreWalletStore(settings,{guildIds:[guild]});
  const plan=firestoreImportPlan(source,'test',{version:2});
  try{await importFirestore(store,plan);}finally{await store.close();}
  const snapshot=snapshotForCloud(source,'test',{upstreamImportFingerprint:plan.fingerprint});
  const admin=randomBytes(32).toString('hex'),rsa=generateKeyPairSync('rsa',{modulusLength:2048});
  let meter=null;
  const mf=new Miniflare(convertV4MiniflareOptions({modulesRoot:'test-results/cloud-bundle',modules:[
    {type:'ESModule',path:'test-results/cloud-bundle/measure.js',contents:readFileSync('scripts/qa/helpers/leaderboard-load-worker.js','utf8')},
    {type:'ESModule',path:'test-results/cloud-bundle/worker.js'}],
    compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],resourcePersistencePath:join(dir,'durable'),
    durableObjects:{CIRCUS_PROJECT:{className:'CircusProject',useSQLite:true}},
    bindings:{CLOUD_PLAN:'free',APP_ENV:'test',ARCADE_RELEASE_ENABLED:String(boardEnabled),FIRESTORE_PROJECT_ID:projectId,
      FIRESTORE_NAMESPACE:namespace,DISCORD_CLIENT_ID:'100000000000000003',DISCORD_CLIENT_SECRET:'fixture',
      DISCORD_PUBLIC_KEY:'0'.repeat(64),ALLOWED_GUILD_IDS:guild,CLOUD_ADMIN_TOKEN:admin,CLOUD_ENCRYPTION_KEY:randomBytes(32).toString('hex'),
      GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:projectId,client_email:'load@example.invalid',
        private_key:rsa.privateKey.export({format:'pem',type:'pkcs8'})})},
    outboundService:async request=>{
      const url=new URL(request.url);
      if(url.hostname==='oauth2.googleapis.com')return MFResponse.json({access_token:'local-fixture',expires_in:3600});
      if(url.hostname==='discord.com'){
        if(url.pathname==='/api/oauth2/token'){
          const user=new URLSearchParams(await request.text()).get('code');
          assert.ok(users.includes(user));
          return MFResponse.json({access_token:'fixture-'+user,scope:'identify guilds.members.read',expires_in:3600});
        }
        const user=request.headers.get('Authorization')?.replace('Bearer fixture-','');
        assert.ok(users.includes(user));
        if(url.pathname==='/api/v10/users/@me')return MFResponse.json({id:user,username:user});
        if(url.pathname===`/api/v10/users/@me/guilds/${guild}/member`)return MFResponse.json({user:{id:user},pending:false});
      }
      assert.equal(url.hostname,'firestore.googleapis.com');
      assert.ok(url.pathname.startsWith('/v1/projects/'+projectId+'/'));
      const payload=await request.json(),counts=meter;
      const response=await fetch('http://'+emulator+url.pathname,{method:'POST',body:JSON.stringify(payload),
        headers:{'Content-Type':'application/json',Authorization:'Bearer owner'}});
      const body=await response.text();
      if(counts){
        assert.ok(response.ok,'emulator REST failure '+response.status);
        if(payload.documents)counts.reads+=payload.documents.length;
        else if(payload.writes)counts.writes+=payload.writes.length;
        else if(payload.structuredQuery)counts.reads+=Math.max(1,JSON.parse(body).filter(row=>row.document).length);
        else assert.ok(/:(beginTransaction|rollback)$/.test(url.pathname),'unmetered RPC '+url.pathname);
      }
      return new MFResponse(body,{status:response.status,headers:{'Content-Type':'application/json'}});
    }}));
  const call=async(path,token,body)=>{
    const start=performance.now();
    const response=await mf.dispatchFetch('http://localhost'+path,{method:body?'POST':'GET',headers:{
      ...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json','X-Wallet-View':'compact-v1'},
      ...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();
    return {status:response.status,data,ms:performance.now()-start};
  };
  const ok=async(...args)=>{
    const result=await call(...args);assert.equal(result.status,200,args[0]+' '+JSON.stringify(result.data.error));return result.data;
  };
  try{
    const quota={projectId,exportedAt:Date.now(),scopes:Object.fromEntries(Object.entries(QUOTA_LIMITS)
      .map(([scope,limits])=>[scope,{limits,growth:0,usage:[],documents:[]}]))};
    await ok('/__ops/seed',admin,{projectId,namespace,writersStopped:true,snapshot,quota});
    await ok('/__ops/activate',admin,{writersStopped:true,freePlanVerified:true});
    await ok('/__ops/settlement-policy',admin,{compactSettlements:true});
    const tokens=[];
    for(let i=0;i<users.length;i+=4){
      const sessions=await Promise.all(users.slice(i,i+4).map(code=>ok('/api/token',null,{code,guildId:guild})));
      tokens.push(...sessions.map(r=>r.session.token));
    }
    const totals=new Map(users.map(user=>[user,0]));
    const verifyBoard=async()=>{
      const pages=await Promise.all(Array.from({length:Math.ceil(users.length/10)},(_,i)=>ok(boardPath+'&page='+(i+1),tokens[users.length-1-i])));
      const actual=pages.flatMap(page=>page.rows.map(r=>[r.name,r.amount,r.rank]));
      const expected=[...totals].sort(([a,x],[b,y])=>y-x||a.localeCompare(b)).map(([u,n],i)=>[u,n,i+1]);
      assert.deepEqual(actual,expected);
    };
    // Finish startup, including the first real alarm, outside the measured windows.
    for(let i=0;i<200;i++){
      if((await ok('/__ops/status',admin)).alarm?.ok)break;
      assert.ok(i<199,'startup alarm did not finish');await delay(50);
    }
    if(boardEnabled)await verifyBoard();
    async function wave(players,readers,spreadMs=0){
      await ok('/api/load-samples',admin,{});
      meter={reads:0,writes:0};
      const operations=Array.from({length:Math.max(players,readers)},async(_,i)=>{
        if(spreadMs)await delay(i*spreadMs/Math.max(players-1,1));
        const [spin,page]=await Promise.all([
          i<players?call('/api/spin',tokens[i],{bet:20,requestId:randomUUID()}):null,
          i<readers?call(boardPath,tokens[i]):null,
        ]);
        if(page)assert.equal(page.status,200,JSON.stringify(page.data.error));
        if(spin?.status===200){assert.equal(spin.data.round.bet,20);totals.set(users[i],totals.get(users[i])+20);}
        else if(spin)assert.deepEqual([spin.status,spin.data.code],[429,'SETTLEMENT_BUSY']);
        return {spin,page};
      });
      const results=await Promise.all(operations),accepted=results.filter(r=>r.spin?.status===200);
      let samples=await ok('/api/load-samples',admin);
      for(let n=0;boardEnabled&&samples.lags.length<accepted.length;n++){
        assert.ok(n<300,'projection did not catch up');await delay(50);samples=await ok('/api/load-samples',admin);
      }
      assert.equal(samples.starts.length,accepted.length);
      if(boardEnabled){assert.equal(samples.lags.length,accepted.length);await verifyBoard();}
      const result={boardEnabled,players,readers,spreadMs,accepted:accepted.length,busy:players-accepted.length,
        queued:samples.starts.filter(s=>s.depth>0).length,peakAdmitted:Math.max(0,...samples.starts.map(s=>s.depth+1)),
        waitMs:samples.starts.map(s=>s.waitMs),spinMs:accepted.map(r=>r.spin.ms),boardLagMs:samples.lags,
        readMs:results.filter(r=>r.page).map(r=>r.page.ms),firestore:meter};
      meter=null;report.push(result);
      console.log(JSON.stringify({boardEnabled,players,readers,spreadMs,accepted:result.accepted,busy:result.busy,
        wait:summary(result.waitMs),lag:summary(result.boardLagMs),firestore:result.firestore}));
      // Each player can spin again two seconds after their last accepted settlement.
      if(players)await delay(2100);
    }
    for(let repeat=0;repeat<3;repeat++){
      if(!boardEnabled){await wave(16,0);continue;}
      await wave(0,96);
      for(const n of [1,2,8,16,32,33,64,96])await wave(n,n);
      await wave(32,32,2000);
    }
  }finally{await mf.dispose();}
}

test('isolated concurrent spin and leaderboard load measurement',async()=>{
  mkdirSync(root,{recursive:true});
  const waves=[];
  await scenario(false,waves);await scenario(true,waves);
  const groups=Map.groupBy(waves,w=>JSON.stringify([w.boardEnabled,w.players,w.readers,w.spreadMs]));
  const results=[...groups.values()].map(group=>{
    const {boardEnabled,players,readers,spreadMs}=group[0];
    const sum=field=>group.reduce((total,w)=>total+w[field],0);
    return {boardEnabled,players,readers,spreadMs,waves:group.length,accepted:sum('accepted'),busy:sum('busy'),queued:sum('queued'),
      peakAdmitted:Math.max(...group.map(w=>w.peakAdmitted)),...Object.fromEntries(['waitMs','spinMs','boardLagMs','readMs']
        .map(field=>[field,summary(group.flatMap(w=>w[field]))])),reads:group.reduce((n,w)=>n+w.firestore.reads,0),writes:group.reduce((n,w)=>n+w.firestore.writes,0)};
  });
  writeFileSync(join(root,'report.json'),JSON.stringify({at:new Date().toISOString(),node:process.version,localEmulator:true,
    compactSettlements:true,discordAnnouncements:false,bet:20,results,waves},null,2));
});
