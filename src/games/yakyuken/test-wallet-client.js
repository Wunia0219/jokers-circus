const profiles=new Set(['qa-a','qa-b','qa-low','qa-zero']);
export class TestWalletClient{
  constructor({player='qa-a',fetchImpl=globalThis.fetch.bind(globalThis),storage=globalThis.sessionStorage}={}){
    if(!profiles.has(player))throw new Error('無效的測試玩家。');
    Object.assign(this,{player,fetchImpl,storage});this.key='jokers-circus:yakyuken:cloud-test:pending:'+player;
    try{const pending=JSON.parse(storage?.getItem(this.key)||'null');if(pending&&['begin','hand','leave','checkin'].includes(pending.action)&&/^[-a-zA-Z0-9]{16,80}$/.test(pending.body?.requestId||''))this.pending=pending;}catch{}
    this.archive={cloud:true,persistent:true,owns:()=>false,records:()=>this.wallet?.records||[],
      isUnlocked:(character,pose)=>Number.isInteger(pose)&&pose>=0&&pose<=2&&(this.wallet?.unlocks[character]??-1)>=pose,
      begin:()=>this.wallet?.activeId,update:()=>{},leave:()=>{}};
  }
  persist(){try{if(this.pending)this.storage?.setItem(this.key,JSON.stringify(this.pending));else this.storage?.removeItem(this.key);}catch{}}
  async request(action,body){
    let response;try{response=await this.fetchImpl('/api/playtest/'+action+'?player='+this.player,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(30000)});}catch{throw new Error('測試雲端連線中斷，請重試原操作，不會重複扣款。');}
    let data;try{data=await response.json();}catch{throw new Error('測試雲端回應中斷，請重試原操作。');}
    if(!response.ok)throw Object.assign(new Error(data.error||'測試雲端暫時無法使用。'),{status:response.status});
    if(data.wallet?.environment!=='test'||data.wallet?.player!==this.player||data.wallet?.cloud!==true)throw new Error('測試錢包身分不符，已停止連線。');
    if(!this.wallet||data.wallet.revision>=this.wallet.revision)this.wallet=data.wallet;
    return data;
  }
  async refresh(){if(this.pending)await this.sendPending();return this.request('state');}
  async sendPending(){
    const pending=this.pending;
    try{const data=await this.request(pending.action,pending.body);this.pending=null;this.persist();return data;}
    catch(error){if([400,403,404,409].includes(error.status)){this.pending=null;this.persist();}throw error;}
  }
  async act(action,body={}){
    if(this.pending&&(this.pending.action!==action||Object.entries(body).some(([k,v])=>this.pending.body[k]!==v)))throw new Error('請先重試上一個尚未確認的操作。');
    if(this.inFlight)return this.inFlight;
    this.pending ||= {action,body:{...body,requestId:crypto.randomUUID()}};this.persist();
    this.inFlight=this.sendPending().finally(()=>this.inFlight=null);return this.inFlight;
  }
  begin(characterId){return this.act('begin',{characterId});}
  hand(matchId,move){return this.act('hand',{matchId,move});}
  leave(matchId){return matchId?this.act('leave',{matchId}):Promise.resolve();}
  checkin(){return this.act('checkin');}
  active(){return this.wallet?.records.find(r=>r.id===this.wallet.activeId);}
}
