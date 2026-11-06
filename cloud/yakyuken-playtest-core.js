import {canEnterCharacter,ENTRY_FEE} from '../src/games/yakyuken/characters.js';
import {challengeProgress,weightedDuel} from '../src/games/yakyuken/challenge.js';
import {MOVES} from '../src/games/yakyuken/rules.js';
import {checkinReceipt,weeklyCheckinState} from '../server/wallet/weekly-checkin.js';
import {taipeiDay,problem} from '../server/wallet/wallet-common.js';
import {BETS,createRound,drawStops} from '../src/game/index.js';

export const PLAYTEST_IDENTITY=Object.freeze({projectId:'slot-game-203db',namespace:'yakyuken-playtest-20261105-test',worker:'jokers-circus-yakyuken-test'});
export const PLAYTEST_PLAYERS=Object.freeze({'qa-a':'測試玩家 A','qa-b':'測試玩家 B','qa-low':'低餘額玩家','qa-zero':'零餘額玩家'});
export const discordTestPlayer=(guild,user)=>`d_${guild}_${user}`;
export const validTestPlayer=player=>Object.hasOwn(PLAYTEST_PLAYERS,player)||/^d_\d{17,20}_\d{17,20}$/.test(player||'');
const rewards=[500,500,1000,1000,1000,2000,4000];
const fail=(status,message)=>Object.assign(new Error(message),{status});
const validId=value=>typeof value==='string'&&/^[-a-zA-Z0-9]{16,80}$/.test(value);
export function assertPlaytestIdentity(env){
  if(env.APP_ENV!=='test'||env.FIRESTORE_PROJECT_ID!==PLAYTEST_IDENTITY.projectId||env.FIRESTORE_NAMESPACE!==PLAYTEST_IDENTITY.namespace)throw new Error('Dedicated test identity required');
}
export function newPlaytestWallet(player){
  if(!validTestPlayer(player))throw fail(400,'找不到測試玩家。');
  return {version:1,player,balance:player==='qa-low'?50:player==='qa-zero'?0:10000,revision:0,records:[],unlocks:{},activeId:null,checkin:null,slotHistory:[],milestones:[],lastSpinAt:0};
}
export function publicPlaytestWallet(state){
  const {lastReceipt,lastTestEntry,...wallet}=state;
  return {...wallet,environment:'test',cloud:true,name:PLAYTEST_PLAYERS[state.player]||'Discord 測試玩家',checkinView:weeklyCheckinState(state.checkin?.day,state.checkin?.receipt,taipeiDay(Date.now()),rewards)};
}
export function slotTestState(wallet,now=Date.now()){
  return {version:3,balance:wallet.balance,history:wallet.slotHistory||[],milestones:wallet.milestones||[],environment:'test',revision:wallet.revision,spinCooldownMs:Math.max(0,(wallet.lastSpinAt||0)+2000-now),...wallet.checkinView};
}
function apply(state,intent){
  const next=structuredClone(state),{action,body,requestId,now,duel}=intent;
  if(action==='begin'){
    if(!canEnterCharacter(body.characterId))throw fail(400,'這位荷官尚未開放。');
    const active=next.records.find(r=>r.id===next.activeId);
    if(active?.status==='playing')return {next,changed:false};
    if(next.balance<ENTRY_FEE)throw fail(409,'戲籌不足，請先簽到或選擇其他測試玩家。');
    next.balance-=ENTRY_FEE;
    const record={id:requestId,characterId:body.characterId,wins:0,losses:0,status:'playing',fee:ENTRY_FEE,reward:0,net:-ENTRY_FEE,startedAt:now,updatedAt:now};
    next.records=[record,...next.records].slice(0,100);next.activeId=record.id;next.unlocks[body.characterId]=Math.max(next.unlocks[body.characterId]??-1,0);
  }else if(action==='hand'){
    const record=next.records.find(r=>r.id===body.matchId);
    if(!record||next.activeId!==record.id||record.status!=='playing')throw fail(409,'這場挑戰已結束，請重新確認紀錄。');
    if(!MOVES.includes(body.move)||!duel)throw fail(400,'不支援的出拳。');
    if(duel.outcome==='draw')return {next,changed:false};
    Object.assign(record,challengeProgress(record,duel.outcome),{updatedAt:now});
    next.unlocks[record.characterId]=Math.max(next.unlocks[record.characterId]??0,Math.min(record.wins,2));
    next.balance+=record.reward;
    record.net=record.reward-record.fee;
  }else if(action==='leave'){
    const record=next.records.find(r=>r.id===body.matchId);
    if(record?.id===next.activeId&&record.status==='playing'){record.status='left';record.updatedAt=now;next.activeId=null;}
    else return {next,changed:false};
  }else if(action==='spin'){
    if(!BETS.includes(body.bet))throw fail(400,'無效的下注額。');
    const retryAfterMs=(next.lastSpinAt||0)+2000-now;
    if(retryAfterMs>0)throw Object.assign(fail(429,'轉輪尚未就緒，請稍後再試。'),{code:'SPIN_COOLDOWN',retryAfterMs});
    if(next.balance<body.bet)throw fail(409,'測試戲籌不足，請降低下注或簽到。');
    const settled=createRound({balance:next.balance,history:next.slotHistory||[],milestones:next.milestones||[]},body.bet,intent.stops,requestId,new Date(now).toISOString());
    next.balance=settled.state.balance;next.slotHistory=settled.state.history;next.milestones=settled.state.milestones;next.lastSpinAt=now;
  }else if(action==='checkin'){
    const day=taipeiDay(now);
    if(next.checkin?.day===day)return {next,changed:false};
    const receipt=checkinReceipt(next.checkin?.day,next.checkin?.receipt,day,rewards);
    next.balance+=receipt.rewards[receipt.cycleDay-1];next.checkin={day,receipt};
  }else if(action==='grant'){
    if(next.balance+body.amount>1e12)throw problem(409,'餘額超出範圍。','BALANCE_LIMIT');next.balance+=body.amount;
  }else if(action==='reverse'){
    const original=intent.original;
    if(!original||original.kind!=='grant'||original.user!==intent.user||original.guild!==intent.guild)throw problem(404,'找不到發放。','GRANT_MISSING');
    if(original.reversal_id)throw problem(409,'這筆已收回。','GRANT_REVERSED');
    if(next.balance<original.delta)throw problem(409,'餘額不足以收回。','BALANCE_LIMIT');next.balance-=original.delta;
  }else throw fail(404,'找不到此測試功能。');
  if(intent.entryId){
    const delta=next.balance-state.balance,kind=action==='reverse'?'reversal':['grant','checkin','spin'].includes(action)?action:'yakyuken';
    const reason=body.reason||(action==='spin'?`下注 ${body.bet}／派彩 ${delta+body.bet}`:action==='checkin'?'週簽到':action==='begin'?'野球拳入場':action==='hand'?'野球拳結算':'野球拳離場');
    next.lastTestEntry={id:intent.entryId,guild:intent.guild,user:intent.user,kind,delta,before:state.balance,after:next.balance,actor:body.actor||intent.user,reason,time:new Date(now).toISOString(),reference:action==='reverse'?String(body.reference):requestId,
      bet:action==='spin'?body.bet:action==='begin'?ENTRY_FEE:0,payout:action==='spin'?delta+body.bet:action==='hand'?Math.max(0,delta):0};
  }
  next.revision++;return {next,changed:true};
}
const result=(state,intent)=>({wallet:publicPlaytestWallet(state),...(intent.duel?{duel:intent.duel}:{}),...(['grant','reverse'].includes(intent.action)?{entry:state.lastTestEntry,recordCode:'R'+String(state.lastTestEntry.id).padStart(6,'0'),...(intent.action==='reverse'?{referenceCode:'R'+String(intent.body.reference).padStart(6,'0')}: {})}:{}),...(intent.action==='spin'?{round:state.slotHistory.find(r=>r.id===intent.requestId)}:{}),matchId:intent.action==='begin'?state.activeId:intent.body.matchId});

// The dedicated player DO serializes calls. Firestore is authoritative; durable
// intents bridge an unknown Firestore commit and the subsequent DO receipt.
export class PlaytestService{
  constructor({repository,storage,player,clock=Date.now,entropy=globalThis.crypto}){Object.assign(this,{repository,storage,player,clock,entropy});}
  async load(){this.state ||= await this.repository.read(this.player) ?? newPlaytestWallet(this.player);return this.state;}
  async recover(){
    const intent=await this.storage.get('pending');if(!intent)return;
    const state=await this.repository.mutate(this.player,(current,ledger)=>{
      const prior=current??newPlaytestWallet(this.player);
      if(prior.lastReceipt?.requestId===intent.requestId){if(prior.lastReceipt.fingerprint!==intent.fingerprint)throw fail(409,'測試請求編號衝突。');return prior;}
      const {next}=apply(prior,{...intent,...ledger});next.lastReceipt={requestId:intent.requestId,fingerprint:intent.fingerprint};return next;
    },{intent});
    this.state=state;const response=result(state,intent);
    await this.storage.transaction(async tx=>{await tx.put('receipt:'+intent.requestId,{fingerprint:intent.fingerprint,response});await tx.delete('pending');});
    return response;
  }
  async stateView(){await this.recover();return {wallet:publicPlaytestWallet(await this.load())};}
  async execute(action,body){
    if(!body||typeof body!=='object'||Array.isArray(body)||!validId(body.requestId))throw fail(400,'無效的測試請求。');
    const admin=['grant','reverse'].includes(action);
    const allowed={begin:['requestId','characterId'],hand:['requestId','matchId','move'],leave:['requestId','matchId'],checkin:['requestId'],spin:['requestId','bet'],grant:['requestId','actor','amount','reason'],reverse:['requestId','actor','reference','reason']}[action];
    if(!Array.isArray(allowed)||Object.keys(body).some(k=>!allowed.includes(k)))throw fail(400,'無效的測試操作欄位。');
    if(['hand','leave'].includes(action)&&!validId(body.matchId))throw fail(400,'無效的測試場次。');
    if(admin){
      if(!/^\d{17,20}$/.test(body.actor||'')||!/^d_\d{17,20}_\d{17,20}$/.test(this.player))throw problem(403,'測試管理身分無效。','COMMAND_ADMIN');
      if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>200)throw problem(400,'請填寫原因。','REASON_REQUIRED');
      if(action==='grant'&&(!Number.isSafeInteger(body.amount)||body.amount<1||body.amount>100000))throw problem(400,'發放數量無效。','GRANT_AMOUNT');
      if(action==='reverse'&&(!Number.isSafeInteger(body.reference)||body.reference<1))throw problem(400,'紀錄編號無效。','GRANT_MISSING');
    }
    const fingerprint=JSON.stringify([action,body.characterId??null,body.matchId??null,body.move??null,...(action==='spin'?[body.bet]:[]),...(admin?[body.actor,body.amount??body.reference,body.reason]:[])]);
    await this.recover();
    const old=await this.storage.get('receipt:'+body.requestId);
    if(old){if(old.fingerprint!==fingerprint)throw problem(409,'測試請求編號已用於其他操作。','REQUEST_CONFLICT');return admin?{...old.response,duplicate:true}:old.response;}
    const state=await this.load(),record=state.records.find(r=>r.id===body.matchId);
    const intent={action,body,requestId:body.requestId,fingerprint,now:this.clock()};
    if(action==='spin')intent.stops=drawStops(()=>{const v=new Uint32Array(1);this.entropy.getRandomValues(v);return v[0];});
    if(action==='hand'){
      if(!record||record.id!==state.activeId||record.status!=='playing')throw fail(409,'這場挑戰已結束，請重新確認紀錄。');
      if(!MOVES.includes(body.move))throw fail(400,'不支援的出拳。');
      intent.duel=weightedDuel(record.characterId,body.move,this.entropy);
    }
    const {changed}=admin?{changed:true}:apply(state,intent);
    if(!changed){
      const response=result(state,intent);
      await this.storage.put('receipt:'+body.requestId,{fingerprint,response});return response;
    }
    await this.storage.put('pending',intent);
    try{return await this.recover();}catch(error){this.state=null;if(error.walletProblem)await this.storage.delete('pending');throw error;}
  }
}
