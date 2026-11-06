import {FirestoreRest} from './firestore-rest.js';
import {cloudFetch} from './fetch.js';
import {PLAYTEST_IDENTITY,assertPlaytestIdentity,discordTestPlayer,slotTestState} from './yakyuken-playtest-core.js';
import {sequence,testRoot,decodeTestWallet,testEntryFields,unpackTestEntry} from './test-wallet-repository.js';
import {problem,taipeiDay} from '../server/wallet/wallet-common.js';

const GUILD='760012177326997544',snowflake=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const code=id=>'R'+String(id).padStart(6,'0');
const record=value=>{const id=typeof value==='string'&&/^R\d{6,16}$/.test(value)?Number(value.slice(1)):value;if(!Number.isSafeInteger(id)||id<1)throw problem(400,'紀錄編號無效。','GRANT_MISSING');return id;};
// Commands reuse the existing player DO and test database. There is no bot,
// background poller, additional Worker or connection to production resources.
export class TestCommandStore{
  constructor(env,state,{db}={}){
    assertPlaytestIdentity(env);
    const credentials=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'null');
    if(!db&&(credentials?.type!=='service_account'||credentials.project_id!==PLAYTEST_IDENTITY.projectId))throw new Error('Test command credentials mismatch');
    Object.assign(this,{env,control:state,environment:'test',grantMax:100000,grantDaily:1000000,tail:Promise.resolve()});
    this.db=db||new FirestoreRest({projectId:env.FIRESTORE_PROJECT_ID,namespace:env.FIRESTORE_NAMESPACE,credentials,endpoint:env.FIRESTORE_ENDPOINT,fetchImpl:cloudFetch});this.root=testRoot(this.db);
  }
  validate(guild,user){if(guild!==GUILD||!snowflake(user))throw problem(403,'只允許指定測試伺服器的玩家。','GUILD_CLOSED');}
  register(user){this.control.set('player:'+discordTestPlayer(GUILD,user),{guild:GUILD,user});}
  request(requestId,fingerprint){
    if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))throw problem(400,'無效的請求編號。','REQUEST_INVALID');
    const key='test-admin-request:'+requestId,previous=this.control.get(key);fingerprint=JSON.stringify(fingerprint);
    if(previous&&previous.fingerprint!==fingerprint)throw problem(409,'表單已用於其他操作，請重新開啟。','REQUEST_CONFLICT');
    if(!previous)this.control.set(key,{fingerprint});return {key,fingerprint,previous};
  }
  async mutation(requestId,fingerprint,work){const request=this.request(requestId,fingerprint);if(request.previous?.result)return {...request.previous.result,duplicate:true};const value=await work(),{entry,recordCode,referenceCode}=value,result={entry,recordCode,...(referenceCode?{referenceCode}:{})};this.control.set(request.key,{fingerprint:request.fingerprint,result});return {...result,...(value.duplicate?{duplicate:true}:{})};}
  serial(work){const task=this.tail.then(async()=>{await this.guard();return work();});this.tail=task.catch(()=>{});return task;}
  async rpc(user,path,body){
    this.validate(GUILD,user);const player=discordTestPlayer(GUILD,user);
    const response=await this.env.YAKYUKEN_TEST.get(this.env.YAKYUKEN_TEST.idFromName(player)).fetch(new Request('https://test.internal'+path+'?player='+player,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.env.PLAYTEST_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
    const result=await response.json();if(!response.ok)throw response.status<500?problem(response.status,result.error,result.code):new Error('Test player temporarily unavailable');return result;
  }
  async state(guild,user){this.validate(guild,user);await this.guard();this.register(user);return slotTestState((await this.rpc(user,'/api/playtest/state')).wallet);}
  grant(guild,actor,user,amount,reason,requestId){this.validate(guild,actor);this.validate(guild,user);return this.serial(()=>this.mutation(requestId,['grant',actor,user,amount,reason],async()=>{this.register(user);return this.rpc(user,'/__admin/grant',{requestId,actor,amount,reason});}));}
  reverse(guild,actor,reference,reason,requestId){
    this.validate(guild,actor);const id=record(reference);
    return this.serial(()=>this.mutation(requestId,['reverse',actor,id,reason],async()=>{const original=unpackTestEntry(await this.root.collection('testAdminLedger').doc(sequence(id)).get());
      if(!original||original.guild!==guild||original.kind!=='grant')throw problem(404,'找不到發放。','GRANT_MISSING');
      this.register(original.user);return this.rpc(original.user,'/__admin/reverse',{requestId,actor,reference:id,reason});}));
  }
  async playerWallets(guild,{after=''}={}){
    this.validate(guild,'100000000000000001');await this.guard();const prefix='d_'+guild+'_';
    if(after&&!snowflake(after))throw problem(400,'無效的玩家游標。','PLAYER_INVALID');
    let query=this.root.collection('players').where('__name__','>=',prefix).where('__name__','<',prefix+'\uffff').orderBy('__name__');if(after)query=query.startAfter(prefix+after);
    const page=await query.limit(21).get(),rows=page.docs.slice(0,20).map(doc=>{const wallet=decodeTestWallet(doc,doc.id);return {user:doc.id.slice(prefix.length),balance:wallet.balance,rounds:wallet.slotHistory?.length||0};});
    return {rows,next:page.docs.length>20?rows.at(-1).user:'',time:new Date().toISOString()};
  }
  query(guild,user,category,before){
    this.validate(guild,user);const field={rewards:'rewardKey',checkin:'checkinKey',game:'gameKey',all:'userKey'}[category];if(!field)throw problem(400,'無效的分類。','AUDIT_FILTER');
    const prefix=guild+'_'+user+'_';let q=this.root.collection('testAdminLedger').where(field,'>=',prefix).where(field,'<',before?prefix+sequence(record(before)):prefix+'\uffff').orderBy(field,'desc');return q;
  }
  cutoff(days){if(![0,1,7,30].includes(days))throw problem(400,'無效的期間。','AUDIT_FILTER');return days?Date.parse(taipeiDay(Date.now())+'T00:00:00+08:00')-(days-1)*86400000:0;}
  async auditHistory(guild,user,{category='rewards',days=0,before}={}){
    await this.guard();const cutoff=this.cutoff(days),page=await this.query(guild,user,category,before).limit(11).get(),rows=page.docs.map(unpackTestEntry).filter(row=>Date.parse(row.time)>=cutoff);
    return {rows:rows.slice(0,10).map(row=>({...row,...(['grant','reversal'].includes(row.kind)?{recordCode:code(row.id)}:{})})),next:rows.length>10?rows[9].id:0};
  }
  async auditSummary(guild,user,days=0){
    await this.guard();const cutoff=this.cutoff(days),page=await this.query(guild,user,'all').limit(1000).get();if(page.size===1000&&Date.parse(unpackTestEntry(page.docs.at(-1)).time)>=cutoff)throw problem(409,'紀錄超過摘要上限，請縮短期間或改查逐筆紀錄。','AUDIT_LIMIT');
    const rows=page.docs.map(unpackTestEntry).filter(row=>Date.parse(row.time)>=cutoff),games=rows.filter(row=>['spin','yakyuken'].includes(row.kind)),claims=rows.filter(row=>row.kind==='checkin');
    return {game:{rounds:games.filter(row=>row.bet>0).length,bet:games.reduce((sum,row)=>sum+row.bet,0),payout:games.reduce((sum,row)=>sum+row.payout,0),net:games.reduce((sum,row)=>sum+row.delta,0)},checkin:{days:claims.length,total:claims.reduce((sum,row)=>sum+row.delta,0)}};
  }
  guard(){const pending=this.control.get('test-admin-reset');if(!pending)return Promise.resolve();this.recovery ||= this.finishReset(pending).finally(()=>this.recovery=null);return this.recovery;}
  resetWallets(guild,actor,requestId){
    this.validate(guild,actor);if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))throw problem(400,'無效的重設請求。','REQUEST_INVALID');
    return this.serial(async()=>{
      this.request(requestId,['reset',actor]);
      const receipt=await this.root.collection('testAdminOperations').doc(requestId).get();if(receipt.exists){const report=JSON.parse(receipt.get('data'));if(report.reset.actor!==actor)throw problem(409,'請求編號已使用。','REQUEST_CONFLICT');return {...report,duplicate:true};}
      const users=this.control.entries('player:').map(([,v])=>v).filter(v=>v.guild===GUILD).map(v=>v.user);
      if(users.length>1000)throw problem(409,'測試玩家超出安全重設容量。','RESET_LIMIT');
      const intent={actor,requestId,users:[...new Set(users)].sort(),time:new Date().toISOString()};this.control.set('test-admin-reset',intent);return this.guard();
    });
  }
  async finishReset(intent){
    const {users,requestId,actor,time}=intent;let report;
    try{
      for(const user of users)await this.rpc(user,'/__admin/freeze',{lease:requestId});
      report=await this.db.runTransaction(async tx=>{
        const receiptRef=this.root.collection('testAdminOperations').doc(requestId),receipt=await tx.get(receiptRef);if(receipt.exists)return JSON.parse(receipt.get('data'));
        const prefix='d_'+GUILD+'_',page=await tx.get(this.root.collection('players').where('__name__','>=',prefix).where('__name__','<',prefix+'\uffff').orderBy('__name__').limit(101));
        if(page.empty)throw problem(409,'本群還沒有錢包。','RESET_EMPTY');if(page.size>100)throw problem(409,'測試服一次最多重設 100 位玩家。','RESET_LIMIT');
        if(page.docs.some(doc=>!users.includes(doc.id.slice(prefix.length))))throw new Error('Unregistered test wallet; reset remains locked for recovery');
        if(page.docs.reduce((size,doc)=>size+Buffer.byteLength(doc.get('state')||'')+2048,0)>6*1024*1024)throw problem(409,'測試錢包資料超過單筆重設容量。','RESET_LIMIT');
        const metaRef=this.root.collection('testAdminMeta').doc('counter'),meta=(await tx.get(metaRef)).data()||{nextId:0};
        if(!Number.isSafeInteger(meta.nextId)||meta.nextId<0||meta.nextId+page.size>=1e12)throw new Error('Test reset counter invalid');
        report={reset:{requestId,actor,time,count:page.size,totalBefore:'0'},entries:[]};let total=0n;
        for(const doc of page.docs){const wallet=decodeTestWallet(doc,doc.id),user=doc.id.slice(prefix.length),entry={id:++meta.nextId,guild:GUILD,user,kind:'reset',before:wallet.balance,after:10000,delta:10000-wallet.balance,actor,reason:'全群重設',time,reference:requestId};
          total+=BigInt(wallet.balance);report.entries.push({user,before:wallet.balance,after:10000});wallet.balance=10000;wallet.revision++;wallet.lastTestEntry=entry;
          tx.set(doc.ref,{environment:'test',namespace:PLAYTEST_IDENTITY.namespace,state:JSON.stringify(wallet)});tx.create(this.root.collection('testAdminLedger').doc(sequence(entry.id)),testEntryFields(entry));
        }
        report.reset.totalBefore=String(total);tx.set(metaRef,meta);tx.create(receiptRef,{data:JSON.stringify(report)});return report;
      });
    }catch(error){if(!error.walletProblem)throw error;for(const user of users)await this.rpc(user,'/__admin/release',{lease:requestId});this.control.set('test-admin-reset',null);throw error;}
    this.control.set('test-admin-last-reset',requestId);
    for(const user of users)await this.rpc(user,'/__admin/release',{lease:requestId});this.control.set('test-admin-reset',null);return report;
  }
  async walletResetReport(guild,actor,requestId){this.validate(guild,actor);await this.guard();const latest=this.control.get('test-admin-last-reset');if(requestId&&requestId!==latest)throw problem(409,'已有新的重設，請重新開啟最新報表。','RESET_MISSING');requestId ||= latest;if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))throw problem(404,'沒有重設報表。','RESET_MISSING');const snapshot=await this.root.collection('testAdminOperations').doc(requestId).get();if(!snapshot.exists)throw problem(404,'沒有重設報表。','RESET_MISSING');return {...JSON.parse(snapshot.get('data')),duplicate:true};}
}
