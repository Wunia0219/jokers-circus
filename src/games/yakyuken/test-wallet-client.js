import {duelForOutcome} from './challenge.js';

const profiles=new Set(['qa-a','qa-b','qa-low','qa-zero']);
const sessionStorage=()=>{try{return globalThis.sessionStorage;}catch{return null;}};
export class TestWalletClient{
  constructor({player='qa-a',fetchImpl=globalThis.fetch.bind(globalThis),storage=sessionStorage(),session=null,reauthorize=null}={}){
    if(session){if(session.environment!=='test'||!session.discordTest||!/^\d{17,20}$/.test(session.userId)||!/^\d{17,20}$/.test(session.guildId))throw new Error('Discord 測試會話無效。');player=`d_${session.guildId}_${session.userId}`;}
    else if(!profiles.has(player))throw new Error('無效的測試玩家。');
    Object.assign(this,{player,fetchImpl,storage,session,reauthorize});this.key='jokers-circus:yakyuken:cloud-test:pending:'+player;
    try{const pending=JSON.parse(storage?.getItem(this.key)||'null');if(pending&&['begin','hand','leave','checkin'].includes(pending.action)&&typeof pending.body?.requestId==='string'&&/^[-a-zA-Z0-9]{16,80}$/.test(pending.body.requestId))this.pending=pending;}catch{}
    this.archive={cloud:true,persistent:true,owns:()=>false,records:()=>this.wallet?.records||[],
      isUnlocked:(character,pose)=>Number.isInteger(pose)&&pose>=0&&pose<=2&&(this.wallet?.unlocks[character]??-1)>=pose,
      begin:()=>this.wallet?.activeId,update:()=>{},leave:()=>{}};
  }
  persist(){try{if(this.pending)this.storage?.setItem(this.key,JSON.stringify(this.pending));else this.storage?.removeItem(this.key);}catch{}}
  async request(action,body,retried=false){
    let response;try{response=await this.fetchImpl('/api/playtest/'+action+(this.session?'':'?player='+this.player),{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(this.session?{Authorization:'Bearer '+this.session.token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(30000)});}catch{throw new Error('測試雲端連線中斷，請重試原操作，不會重複扣款。');}
    if(response.status===401&&this.reauthorize&&!retried){
      this.reauthPromise ||= this.reauthorize().finally(()=>this.reauthPromise=null);const renewed=await this.reauthPromise;
      if(renewed?.environment!=='test'||!renewed.discordTest||renewed.userId!==this.session.userId||renewed.guildId!==this.session.guildId)throw new Error('重新授權身分不符，請重新開啟測試版。');
      this.session=renewed;return this.request(action,body,true);
    }
    let data;try{data=await response.json();}catch{throw new Error('測試雲端回應中斷，請重試原操作。');}
    if(!response.ok)throw Object.assign(new Error(data.error||'測試雲端暫時無法使用。'),{status:response.status});
    if(data.wallet?.environment!=='test'||data.wallet?.player!==this.player||data.wallet?.cloud!==true)throw new Error('測試錢包身分不符，已停止連線。');
    if(!this.wallet||data.wallet.revision>=this.wallet.revision){
      const hand=data.nextHand;
      if(hand&&(!Number.isSafeInteger(hand.index)||hand.index<0||hand.matchId!==data.wallet.activeId||!['win','loss','draw'].includes(hand.outcome)))throw new Error('測試出牌進度無效，請重新同步。');
      this.wallet=data.wallet;
      if(Object.hasOwn(data,'nextHand')){
        if(!hand||this.nextHand?.matchId!==hand.matchId||hand.index>=this.nextHand.index)this.nextHand=hand;
      }
    }
    return data;
  }
  async refresh(){if(this.pending)await this.sendPending();return this.request('state');}
  sendPending(){
    if(this.inFlight)return this.inFlight;
    if(!this.pending)return Promise.resolve();
    const pending=this.pending;
    // Reload recovery, refresh and explicit retries must own the same lock.
    this.inFlight=(async()=>{
      try{const data=await this.request(pending.action,pending.body);this.pending=null;this.persist();return data;}
      catch(error){if([400,403,404,409].includes(error.status)){this.pending=null;this.persist();}throw error;}
      finally{this.inFlight=null;}
    })();
    return this.inFlight;
  }
  async act(action,body={}){
    if(this.pending&&(this.pending.action!==action||Object.entries(body).some(([k,v])=>this.pending.body[k]!==v)))throw new Error('請先重試上一個尚未確認的操作。');
    this.pending ||= {action,body:{...body,requestId:crypto.randomUUID()}};this.persist();
    return this.sendPending();
  }
  begin(characterId){return this.act('begin',{characterId});}
  previewHand(matchId,move){
    const hand=this.nextHand;
    if(!hand||hand.matchId!==matchId||this.active()?.status!=='playing')return null;
    return {duel:duelForOutcome(move,hand.outcome),handIndex:hand.index};
  }
  hand(matchId,move,handIndex){return this.act('hand',{matchId,move,...(handIndex===undefined?{}:{handIndex})});}
  leave(matchId){return matchId?this.act('leave',{matchId}):Promise.resolve();}
  checkin(){return this.act('checkin');}
  active(){return this.wallet?.records.find(r=>r.id===this.wallet.activeId);}
}
