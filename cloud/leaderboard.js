import {Leaderboard,leaderboardQuery} from '../server/wallet/leaderboard.js';
import {LeaderboardNotices} from '../server/discord/leaderboard-announcement.js';
import {unpack} from '../server/firestore/documents.js';
import {problem} from '../server/wallet/wallet-common.js';

const STEP=128,LIVE_DELAY=1000,NAME_TTL=86400000;
const sourceKey=(store,meta)=>JSON.stringify([store.settings.namespace,meta.walletEpoch??null,meta.importFingerprint??null]);

export class CloudLeaderboard {
  constructor({storage,state,vault,store,meta,quota,bot,memberBot=bot,wake}){
    Object.assign(this,{storage,state,vault,store,quota,memberBot,wake});
    this.pending=new Map();
    this.names=new Map();
    this.target=meta.nextId;
    this.source=sourceKey(store,meta);
    const announces=bot?.leaderboardRoleId||bot?.leaderboardText;
    this.board=new Leaderboard({sql:storage.sql,transaction:work=>storage.transactionSync(work),source:this.source,
      announcementGuild:announces?bot.guild:null});
    this.board.initialize(this.target);
    this.notices=announces?new LeaderboardNotices({sql:storage.sql,source:this.source,send:bot.sendLeaderboard.bind(bot)}):null;
  }
  observeMeta(meta){
    if(sourceKey(this.store,meta)!==this.source)throw new Error('Leaderboard source changed');
    this.target=Math.max(this.target,meta.nextId);
  }
  commit(entries){
    for(const entry of entries){
      this.target=Math.max(this.target,entry.id);
      this.pending.set(entry.id,entry);
      if(this.pending.size>STEP*4)this.pending.delete(this.pending.keys().next().value);
    }
    if(entries.length)this.wake(LIVE_DELAY);
  }
  remember({guild,user,profile}){
    if(profile?.name&&this.board.name(guild,user)!==profile.name)this.board.remember(guild,user,profile.name,Date.now()+NAME_TTL);
  }
  async verifyMemberBot(){
    if(this.memberBot.verified)return;
    this.memberVerification??=this.memberBot.verify().catch(error=>{
      this.nameLookupAfter=Date.now()+60000;
      throw error;
    }).finally(()=>{this.memberVerification=null;});
    await this.memberVerification;
  }
  async name(guild,user){
    const saved=this.board.name(guild,user);
    if(saved!==undefined)return saved||null;
    const previous=this.board.name(guild,user,0)||null;
    if(this.memberBot?.guild!==guild||this.nameLookupAfter>Date.now())return previous;
    const key=guild+':'+user;
    if(!this.names.has(key)){
      if(this.names.size>=10)return previous;
      const lookup=(async()=>{
        try{
          await this.verifyMemberBot();
          const response=await this.memberBot.request(`/guilds/${guild}/members/${user}`);
          if(response.status===429)this.nameLookupAfter=Date.now()+60000;
          const updated=this.board.name(guild,user);
          if(updated!==undefined)return updated||null;
          if(response.status===404)this.board.remember(guild,user,previous||'',Date.now()+3600000);
          if(!response.ok)return previous;
          const member=await response.json();
          if(member.user?.id!==user)return previous;
          const name=this.board.name(guild,user);
          if(name!==undefined)return name||null;
          this.board.remember(guild,user,member.nick||member.user.global_name||member.user.username||previous,Date.now()+NAME_TTL);
          return this.board.name(guild,user)||previous;
        }catch{return previous;}
      })().finally(()=>this.names.delete(key));
      this.names.set(key,lookup);
    }
    return this.names.get(key);
  }
  async page(session,params){
    const query=leaderboardQuery(params),state=this.board.state();
    if(!state.seeded||this.target-state.cursor>STEP){
      this.wake(LIVE_DELAY);
      throw problem(503,'排行榜正在同步，請稍後再試。');
    }
    this.remember(session);
    const page=this.board.page(session.guild,query);
    return {...page,rows:await Promise.all(page.rows.map(async({user,rank,amount})=>({
      rank,amount,name:await this.name(session.guild,user)||'Discord 名稱待同步',
    })))};
  }
  work(){
    this.running??=this.step().finally(()=>{this.running=null;});
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
      const missing=ids.filter(id=>!this.pending.has(id));
      const batch=new Map(ids.filter(id=>this.pending.has(id)).map(id=>[id,this.pending.get(id)]));
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
    if(cursor<this.target)this.wake(LIVE_DELAY);
    await this.notices?.flush();
    const delay=this.notices?.nextDelay();
    if(delay!==null&&delay!==undefined)this.wake(delay);
  }
}
