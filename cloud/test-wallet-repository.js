import {PLAYTEST_IDENTITY} from './yakyuken-playtest-core.js';
import {problem,taipeiDay} from '../server/wallet/wallet-common.js';

export const sequence=id=>String(id).padStart(16,'0');
export const testRoot=db=>db.doc('circus_wallet_v1/'+PLAYTEST_IDENTITY.namespace);
export const unpackTestEntry=snapshot=>snapshot?.exists?JSON.parse(snapshot.get('data')):null;
export function decodeTestWallet(snapshot,player){
  if(!snapshot.exists)return null;
  if(snapshot.get('environment')!=='test'||snapshot.get('namespace')!==PLAYTEST_IDENTITY.namespace)throw new Error('Stored test identity mismatch');
  const state=JSON.parse(snapshot.get('state'));if(state.player!==player||state.version!==1)throw new Error('Stored player mismatch');return state;
}
export function testEntryFields(entry){
  const key=entry.guild+'_'+entry.user+'_'+sequence(entry.id);
  return {data:JSON.stringify(entry),userKey:key,...(['grant','reversal','reset'].includes(entry.kind)?{rewardKey:key}:{}),...(entry.kind==='checkin'?{checkinKey:key}:{}),...(['spin','yakyuken'].includes(entry.kind)?{gameKey:key}:{})};
}
export function testWalletRepository(db,player,{ledger=false}={}){
  const root=testRoot(db),ref=root.collection('players').doc(player),metaRef=root.collection('testAdminMeta').doc('counter');
  return {read:async()=>decodeTestWallet(await ref.get(),player),mutate:async(_,change,{intent}={})=>db.runTransaction(async tx=>{
    const current=decodeTestWallet(await tx.get(ref),player),tracked=ledger&&intent;
    const [guild,user]=player.startsWith('d_')?player.slice(2).split('_'):['qa',player];
    const metadata=tracked?(await tx.get(metaRef)).data()||{nextId:0}:null;
    if(tracked&&(!Number.isSafeInteger(metadata.nextId)||metadata.nextId>=1e12))throw new Error('Test ledger counter invalid');
    const originalRef=intent?.action==='reverse'?root.collection('testAdminLedger').doc(sequence(intent.body.reference)):null;
    const original=originalRef?unpackTestEntry(await tx.get(originalRef)):null;
    const dailyRef=intent?.action==='grant'?root.collection('testAdminDays').doc(guild+'_'+intent.body.actor+'_'+taipeiDay(intent.now)):null;
    const daily=dailyRef?(await tx.get(dailyRef)).data()||{used:0}:null;
    const state=change(current,tracked?{entryId:metadata.nextId+1,guild,user,original}:undefined);
    if(state===current)return state;
    const entry=tracked&&state.lastTestEntry;
    if(daily&&entry&&daily.used+entry.delta>1000000)throw problem(409,'超過今日發放額度。','GRANT_DAILY');
    tx.set(ref,{environment:'test',namespace:PLAYTEST_IDENTITY.namespace,state:JSON.stringify(state)});
    if(entry){
      tx.set(metaRef,{nextId:entry.id});tx.create(root.collection('testAdminLedger').doc(sequence(entry.id)),testEntryFields(entry));
      if(originalRef)tx.set(originalRef,testEntryFields({...original,reversal_id:entry.id}));
      if(dailyRef)tx.set(dailyRef,{used:daily.used+entry.delta});
    }
    return state;
  })};
}
