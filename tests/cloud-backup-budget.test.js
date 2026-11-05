import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudBackup} from '../cloud/backup.js';
import {FirestoreRest} from '../cloud/firestore-rest.js';

const settings={projectId:'demo-jokers-circus',namespace:'backup-budget-test',emulator:'127.0.0.1:8787'};
function quota(initial=0,limit=6000){return {used:initial,bytes:0,reserve({reads=0}){if(this.used+reads>limit)throw Object.assign(new Error('Budget'),{code:'FIRESTORE_BUDGET'});this.used+=reads;},observe(bytes){this.bytes+=bytes;}};}

test('single-attempt REST backup charges each uncertain attempt before transport without refunding old usage',async()=>{
 const budget=quota(5682);let calls=0,fail=true;
 const db=new FirestoreRest({...settings,fetchImpl:async(url,options)=>{calls++;assert.equal(budget.used,5682+calls*3);if(fail)throw new Error('Lost response');return Response.json(JSON.parse(options.body).documents.map(name=>({found:{name,fields:{json:{stringValue:'{}'}}},readTime:'2026-10-26T00:00:00Z'})));}});
 const backup=new CloudBackup({db,quota:budget}),refs=[1,2,3].map(n=>db.doc(`circus_wallet_v1/${settings.namespace}/ledger/${n}`));
 await assert.rejects(backup.read(refs));assert.equal(calls,1,'transport cannot secretly retry');assert.equal(budget.used,5685);
 fail=false;assert.equal((await backup.read(refs)).length,3);assert.equal(calls,2);assert.equal(budget.used,5688);
 budget.used=5999;await assert.rejects(backup.read(refs),{code:'FIRESTORE_BUDGET'});assert.equal(calls,2,'deny before network');assert.equal(budget.used,5999);
});

test('backup query keeps full page allowance on failure and retries at the identical readTime',async()=>{
 const budget=quota();let fail=true,calls=0;
 const readTime='2026-10-26T00:00:00Z';
 const db=new FirestoreRest({...settings,fetchImpl:async(url,options)=>{calls++;assert.ok(url.endsWith(':runQuery'));const b=JSON.parse(options.body);assert.equal(b.readTime,readTime);assert.equal(b.structuredQuery.limit,20);assert.deepEqual(b.structuredQuery.orderBy,[{field:{fieldPath:'__name__'},direction:'ASCENDING'}]);assert.equal(budget.used,calls*20);if(fail)throw new Error('Lost query response');return Response.json([{readTime}]);}});
 const job={generation:'candidate',readTime,target:0,cursor:0,phase:'collections',startedAt:Date.now(),collection:0,cursorId:null,highlights:false};
 const values=new Map([['backup-job',job]]),state={get:k=>values.get(k),set:(k,v)=>values.set(k,v)};
 const snapshot={format:1,environment:'test',revision:0,tables:{settings:[{key:'environment',value:'test'}],wallets:[],ledger:[],operations:[],rounds:[],highlight_events:[],highlight_boards:[]}};
 let published=false;const vault={manifest:()=>({format:2}),append:()=>{},audit:()=>({revision:0}),storage:{transactionSync:fn=>fn()},publish:()=>{published=true;}};
 let now=Date.now();
 const backup=new CloudBackup({db,quota:budget,root:db.collection('circus_wallet_v1').doc(settings.namespace),environment:'test'},state,vault,{clock:()=>now});
 await assert.rejects(backup.step());assert.equal(published,false);assert.equal(job.collection,0);assert.equal(budget.used,20);
 fail=false;assert.equal((await backup.step()).retryAt,now+60000);assert.equal(calls,1,'cooldown cannot reread the failed page');
 now+=60000;assert.equal((await backup.step()).complete,false);assert.equal(published,false);assert.equal((await backup.step()).complete,true);assert.equal(budget.used,40);assert.equal(published,true);
});

test('unrecognized backup adapters keep the existing six-attempt allowance',async()=>{
 const budget=quota();const db={batchGet:async()=>[{data:()=>({})}]};await new CloudBackup({db,quota:budget}).read([{}]);assert.equal(budget.used,6);
});

test('failed backup attempts back off durably across restart without reading during cooldown',async()=>{
 let now=Date.now(),calls=0;const values=new Map(),state={get:k=>structuredClone(values.get(k)),set:(k,v)=>values.set(k,structuredClone(v))};
 const store={},vault={};
 const create=()=>{const backup=new CloudBackup(store,state,vault,{clock:()=>now});backup.checkpoint=async()=>{calls++;throw new Error('private upstream body');};return backup;};
 for(let attempt=1;attempt<=8;attempt++){
   const backup=create();await assert.rejects(backup.step());assert.equal(calls,attempt);
   const retry=state.get('backup-retry'),delay=Math.min(30*60000,60000*2**(attempt-1));
   assert.equal(retry.nextAttempt,now+delay);assert.equal(create().nextDelay,delay);
   assert.equal((await create().step()).retryAt,retry.nextAttempt);assert.equal(calls,attempt);
   assert.ok(!JSON.stringify(retry).includes('private'));
   now=retry.nextAttempt;
 }
 const recovered=create();recovered.checkpoint=async()=>({complete:false});await recovered.step();assert.equal(state.get('backup-retry'),null);assert.equal(recovered.nextDelay,1000);
});

test('expired remote snapshot retains verified backup and completed remote pages can still audit',async()=>{
 const now=Date.now(),values=new Map([['backup-latest','verified'],['backup-status',{ok:true,at:now-86400000}]]);
 const state={get:k=>structuredClone(values.get(k)),set:(k,v)=>values.set(k,structuredClone(v))};let reads=0,discarded=0,published=0,auditOk=true;
 const job={generation:'candidate',phase:'ledger',startedAt:now-51*60000,readTime:'original'};
 const vault={storage:{transactionSync:fn=>fn()},manifest:()=>({format:2}),discard:()=>discarded++,audit:()=>{if(!auditOk)throw new Error('Corrupt candidate');return {revision:99};},publish:()=>published++};
 state.set('backup-job',job);
 const create=()=>new CloudBackup({db:{batchGet:()=>reads++}},state,vault,{clock:()=>now});
 await assert.rejects(create().step(),/snapshot expired/);assert.equal(discarded,1);assert.equal(reads,0);assert.equal(state.get('backup-latest'),'verified');assert.equal(state.get('backup-status').at,now-86400000);
 state.set('backup-retry',null);state.set('backup-job',{...job,phase:'audit'});auditOk=false;
 await assert.rejects(create().step(),/Corrupt candidate/);assert.equal(published,0,'failed audit cannot publish even after the readTime has expired');
 state.set('backup-retry',null);auditOk=true;assert.equal((await create().step()).complete,true);assert.equal(published,1);assert.equal(reads,0);assert.equal(discarded,1);assert.equal(state.get('backup-status').revision,99);
});

test('8000-entry backlog completes with bounded checkpoints before readTime expires, including restart',async()=>{
 let now=Date.now(),reads=0,published=0,steps=0;const initial=now,readTime=new Date(now).toISOString(),values=new Map([['backup-latest','verified']]);
 const state={get:k=>structuredClone(values.get(k)),set:(k,v)=>values.set(k,structuredClone(v))};
 const seen=new Set(),db=new FirestoreRest({...settings,fetchImpl:async(url,options)=>{
   const body=JSON.parse(options.body);
   if(body.structuredQuery){assert.equal(body.readTime,readTime);return Response.json([{readTime}]);}
   assert.ok(body.documents.length<=20);
   return Response.json(body.documents.map(name=>{
     reads++;const id=Number(name.split('/').at(-1));
     const ledger=name.includes('/ledger/');if(ledger){assert.equal(body.readTime,readTime);assert.ok(!seen.has(id),'no repeated ledger reads');seen.add(id);}
     const data=ledger?{id,kind:'spin',guild:'g',user:'u'}:name.includes('/meta/')?{nextId:8000}:{roundStorage:'operation-v1',result:{round:{id:'fixture'}}};
     return {readTime,found:{name,fields:{json:{stringValue:JSON.stringify(data)},...(ledger?{operationKey:{stringValue:'spin:fixture'},roundStorage:{stringValue:'operation-v1'}}:{})}}};
   }));
 }});
 const vault={manifest:()=>({format:2,header:{revision:0,upstreamImportFingerprint:null}}),fork:()=>{},append:()=>{},audit:()=>({revision:8000}),publish:()=>published++,discard:()=>assert.fail('bounded continuation must finish before expiry'),storage:{transactionSync:fn=>fn()}};
 const store={db,quota:{reserve:()=>{},observe:()=>{}},checkMeta:()=>{},root:db.collection('circus_wallet_v1').doc(settings.namespace)};store.meta=store.root.collection('meta').doc('state');
 const create=()=>new CloudBackup(store,state,vault,{clock:()=>now});let backup=create();
 while(!(await backup.step()).complete){steps++;now+=backup.nextDelay;if(steps===200)backup=create();assert.ok(steps<450);}
 assert.equal(seen.size,8000);assert.equal(reads,16001);assert.equal(published,1);assert.ok(now-initial<10*60000,'8k backlog is processed within ten simulated minutes');assert.equal(state.get('backup-job'),null);
});
