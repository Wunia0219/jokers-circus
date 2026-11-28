import {Leaderboard,leaderboardQuery} from '../server/wallet/leaderboard.js';
import {LeaderboardNotices} from '../server/discord/leaderboard-announcement.js';
import {unpack} from '../server/firestore/documents.js';
import {problem} from '../server/wallet/wallet-common.js';

const STEP=128,LIVE_DELAY=1000,NAME_TTL=86400000,PAGE_CACHE_LIMIT=64,RETRY_DELAY=30000;
const sourceKey=(store,meta)=>JSON.stringify([store.settings.namespace,meta.walletEpoch??null,meta.importFingerprint??null]);

export class CloudLeaderboard {
  constructor({storage,state,vault,store,meta,quota,bot,memberBot=bot,wake,clock=Date.now,activeVisitStart=()=>null}){
    Object.assign(this,{storage,state,vault,store,quota,memberBot,wake,clock});
    this.pending=new Map();
    this.names=new Map();
    this.pages=new Map();
    this.retryAt=0;
    this.syncDue=0;
    this.target=meta.nextId;
    this.source=sourceKey(store,meta);
    const announces=bot?.leaderboardRoleId||bot?.leaderboardText;
    this.board=new Leaderboard({sql:storage.sql,transaction:work=>storage.transactionSync(work),source:this.source,
      announcementGuild:announces?bot.guild:null,activeVisitStart:announces?activeVisitStart:undefined});
    this.board.initialize(this.target);
    // Pending cards from the per-round delivery path cannot be sent under the new rule.
    if(announces)storage.sql.exec(`UPDATE leaderboard_outbox SET status='superseded'
      WHERE status='pending' AND json_extract(payload,'$.departure') IS NULL`);
    this.notices=announces?new LeaderboardNotices({sql:storage.sql,source:this.source,send:bot.sendLeaderboard.bind(bot)}):null;
  }
  queueDeparture(visit,end,time){
    if(!this.notices||!this.board.queueDeparture(visit,end,time))return false;
    this.target=Math.max(this.target,end.revision);
    return true;
  }
  observeMeta(meta){
    if(sourceKey(this.store,meta)!==this.source)throw new Error('Leaderboard source changed');
    this.target=Math.max(this.target,meta.nextId);
    const {cursor,seeded}=this.board.state();
    if(!seeded||cursor<this.target)this.requestSync();
  }
  commit(entries){
    for(const entry of entries){
      this.target=Math.max(this.target,entry.id);
      this.pending.set(entry.id,entry);
      if(this.pending.size>STEP*4)this.pending.delete(this.pending.keys().next().value);
    }
    if(entries.length)this.requestSync();
  }
  requestSync(){
    const now=this.clock(),due=Math.max(now+LIVE_DELAY,this.retryAt);
    if(this.syncDue>now&&this.syncDue<=due)return;
    this.wake(due-now);
    this.syncDue=due;
  }
  remember({guild,user,profile}){
    const now=this.clock();
    if(profile?.name&&this.board.name(guild,user,now)!==profile.name)this.board.remember(guild,user,profile.name,now+NAME_TTL);
  }
  async verifyMemberBot(){
    if(this.memberBot.verified)return;
    this.memberVerification??=this.memberBot.verify().catch(error=>{
      this.nameLookupAfter=this.clock()+60000;
      throw error;
    }).finally(()=>{this.memberVerification=null;});
    await this.memberVerification;
  }
  async name(guild,user,saved=this.board.pageNames(guild,[user]).get(user)){
    const now=this.clock();
    if(saved?.expires>now)return saved.name||null;
    const previous=saved?.name||null;
    if(this.memberBot?.guild!==guild||this.nameLookupAfter>now)return previous;
    const key=guild+':'+user;
    if(!this.names.has(key)){
      if(this.names.size>=10)return previous;
      const lookup=(async()=>{
        try{
          await this.verifyMemberBot();
          const response=await this.memberBot.request(`/guilds/${guild}/members/${user}`);
          if(response.status===429){
            const seconds=Number(response.headers.get('Retry-After'));
            const delay=Number.isFinite(seconds)&&seconds>0?seconds*1000:60000;
            this.nameLookupAfter=Math.max(this.nameLookupAfter||0,this.clock()+delay);
          }
          const member=response.ok?await response.json():null;
          const checkedAt=this.clock();
          if(member?.user?.id===user)this.onConfirmedMember?.(guild,user);
          const updated=this.board.name(guild,user,checkedAt);
          if(updated!==undefined)return updated||null;
          if(response.status===404)this.board.remember(guild,user,previous||'',checkedAt+3600000);
          if(member?.user?.id!==user)return previous;
          return this.board.remember(guild,user,member.nick||member.user.global_name||member.user.username||previous,checkedAt+NAME_TTL)||previous;
        }catch{return previous;}
      })().finally(()=>this.names.delete(key));
      this.names.set(key,lookup);
    }
    return this.names.get(key);
  }
  async page(session,params){
    const query=leaderboardQuery(params),state=this.board.state();
    if(!state.seeded||this.target-state.cursor>STEP){
      this.requestSync();
      throw problem(503,'排行榜正在同步，請稍後再試。');
    }
    this.remember(session);
    if(this.pageCursor!==state.cursor){
      this.pages.clear();
      this.pageCursor=state.cursor;
    }
    const key=JSON.stringify([session.guild,query.period,query.game,query.page]);
    let page=this.pages.get(key);
    if(!page){
      page=this.board.page(session.guild,query);
      if(this.pages.size>=PAGE_CACHE_LIMIT)this.pages.delete(this.pages.keys().next().value);
      this.pages.set(key,page);
    }
    const names=this.board.pageNames(session.guild,page.rows.map(row=>row.user));
    return {...page,rows:await Promise.all(page.rows.map(async({user,rank,amount})=>({
      rank,amount,name:await this.name(session.guild,user,names.get(user)??null)||'Discord 名稱待同步',
    })))};
  }
  work(){
    if(this.running)return this.running;
    this.syncDue=0;
    if(this.clock()<this.retryAt){
      this.requestSync();
      return Promise.resolve();
    }
    this.running=this.step().catch(error=>{
      this.retryAt=this.clock()+RETRY_DELAY;
      this.requestSync();
      throw error;
    }).finally(()=>{this.running=null;});
    return this.running;
  }
  async step(){
    let snapshot=this.board.state();
    if(!snapshot.seeded){
      const generation=this.state.get('backup-latest'),manifest=this.vault.manifest(generation);
      const through=Math.min(manifest.revision,snapshot.quietThrough);
      const tables=manifest.format===2?null:this.vault.load(generation).tables;
      const rows=tables?tables.ledger.sort((a,b)=>a.id-b.id):this.vault.rows(generation,'ledger');
      const wallets=tables?tables.wallets:this.vault.rows(generation,'wallets');
      this.board.seed(rows,through,wallets);
      snapshot=this.board.state();
    }
    if(snapshot.cursor<this.target){
      const ids=Array.from({length:Math.min(this.target-snapshot.cursor,STEP)},(_,i)=>snapshot.cursor+i+1);
      const missing=[],batch=new Map();
      for(const id of ids){
        const entry=this.pending.get(id);
        if(entry)batch.set(id,entry);
        else missing.push(id);
      }
      if(missing.length){
        this.quota.reserve({reads:missing.length});
        const docs=await this.store.db.batchGet(missing.map(id=>this.store.root.collection('ledger').doc(String(id))));
        this.quota.observe(Buffer.byteLength(JSON.stringify(docs.map(doc=>doc.data()))));
        for(let i=0;i<docs.length;i++){
          const entry=unpack(docs[i]);
          if(entry?.id!==missing[i])throw new Error('Leaderboard live ledger gap');
          batch.set(entry.id,entry);
        }
      }
      this.board.apply(ids.map(id=>batch.get(id)));
    }
    const {cursor}=this.board.state();
    for(const id of this.pending.keys())if(id<=cursor)this.pending.delete(id);
    const moreDepartures=this.notices&&this.board.releaseDepartures(cursor);
    if(cursor<this.target||moreDepartures)this.requestSync();
    await this.notices?.flush();
    const delay=this.notices?.nextDelay();
    if(delay!==null&&delay!==undefined)this.wake(delay);
  }
}
