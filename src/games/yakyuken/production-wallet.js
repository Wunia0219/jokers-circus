import {canUnlockPose} from './characters.js';

const taipeiDay=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function sessionStorage(){
  try{return globalThis.sessionStorage;}catch{return null;}
}

export class ProductionDuelWallet {
  constructor(session,fetchImpl,storage=sessionStorage()){
    this.fetch=fetchImpl;
    this.player=`d_${session.guildId}_${session.userId}`;
    this.environment=session.environment;
    this.epoch=session.walletEpoch;
    this.key=`circus:duel:${this.environment}:${this.player}:${this.epoch??''}`;
    this.storage=storage;
    try{
      const pending=JSON.parse(storage?.getItem(this.key)||'null');
      if(['begin','hand','leave','checkin'].includes(pending?.action)&&typeof pending.body?.requestId==='string'&&
        /^[-a-zA-Z0-9]{16,80}$/.test(pending.body.requestId))this.pending=pending;
    }catch{}
    this.archive={cloud:true,persistent:true,owns:()=>false,records:()=>this.wallet?.records||[],
      isUnlocked:(character,pose)=>canUnlockPose(character,pose)&&
        (this.previewAllCG||(this.wallet?.unlocks[character]??-1)>=pose),
      begin:()=>this.wallet?.activeId,update:()=>{},leave:()=>{}};
  }
  persist(){
    try{
      if(this.pending)this.storage?.setItem(this.key,JSON.stringify(this.pending));
      else this.storage?.removeItem(this.key);
    }catch{}
  }
  get supportCode(){
    return this.pending&&this.pending.action!=='checkin'?'D-'+this.pending.body.requestId:null;
  }
  async request(action,body){
    const response=await this.fetch('/api/feature/'+action,{method:body?'POST':'GET',cache:'no-store',
      headers:{...(this.epoch?{'X-Wallet-Epoch':this.epoch}:{}),...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    const data=await response.json();
    if(!response.ok){
      if(data.code==='DUEL_CLOSED')this.admissionOpen=false;
      throw Object.assign(new Error(data.error||'服務暫時無法使用。'),{status:response.status,code:data.code});
    }
    if(data.wallet?.player!==this.player||data.wallet.environment!==this.environment||data.wallet.cloud!==true||
      !Number.isSafeInteger(data.wallet.revision)||!Array.isArray(data.wallet.records)||
      (data.wallet.activeId!==null&&(!data.nextHand||data.nextHand.matchId!==data.wallet.activeId||
        !Number.isSafeInteger(data.nextHand.index)||data.nextHand.index<0)))
      throw new Error('暫時無法確認戲籌，請重新開啟遊戲。');
    if(!this.wallet||data.wallet.revision>=this.wallet.revision){
      this.wallet=data.wallet;this.nextHand=data.nextHand;
      this.admissionOpen=data.admissionOpen;
      this.previewAllCG=this.environment==='test'&&data.previewAllCG===true;
    }
    return data;
  }
  async refresh(){
    if(this.pending){
      try{await this.sendPending();}
      catch(error){if(this.pending)throw error;}
    }
    return this.request('state');
  }
  sendPending(){
    if(this.inFlight)return this.inFlight;
    if(!this.pending)return Promise.resolve();
    const {action,body}=this.pending;
    this.inFlight=this.request(action,body).then(data=>{
      this.pending=null;this.persist();return data;
    },error=>{
      if([400,409].includes(error.status)){this.pending=null;this.persist();throw error;}
      const code=this.supportCode;
      throw new Error(code?`剛才的結果還在確認，請再試一次。\n回報碼 ${code}`:'簽到尚未確認，請重試。',{cause:error});
    }).finally(()=>{this.inFlight=null;});
    return this.inFlight;
  }
  act(action,body={}){
    if(this.pending&&(this.pending.action!==action||Object.entries(body).some(([key,value])=>this.pending.body[key]!==value)))
      throw new Error('請先確認剛才的結果，再繼續遊戲。');
    this.pending ||= {action,body:{...body,requestId:crypto.randomUUID()}};
    this.persist();
    return this.sendPending();
  }
  begin(characterId){return this.act('begin',{characterId});}
  hand(matchId,move,handIndex){return this.act('hand',{matchId,move,handIndex});}
  leave(matchId){return matchId?this.act('leave',{matchId}):Promise.resolve();}
  checkin(){return this.pending?.action==='checkin'?this.sendPending():this.act('checkin',{day:taipeiDay()});}
  active(){return this.wallet?.records.find(record=>record.id===this.wallet.activeId);}
}
