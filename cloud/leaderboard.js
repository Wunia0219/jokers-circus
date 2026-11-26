import {Leaderboard,leaderboardQuery} from '../server/wallet/leaderboard.js';
import {LeaderboardNotices} from '../server/discord/leaderboard-announcement.js';
import {unpack} from '../server/firestore/documents.js';
import {problem} from '../server/wallet/wallet-common.js';

const STEP=128,LIVE_DELAY=1000;
const sourceKey=(store,meta)=>JSON.stringify([store.settings.namespace,meta.walletEpoch??null,meta.importFingerprint??null]);

export class CloudLeaderboard {
  constructor({storage,state,vault,store,meta,quota,bot,wake}){
    Object.assign(this,{storage,state,vault,store,quota,bot,wake});
    this.pending=new Map();
    this.names=new Map();
    this.target=meta.nextId;
    this.source=sourceKey(store,meta);
    this.board=new Leaderboard({sql:storage.sql,transaction:work=>storage.transactionSync(work),source:this.source,
      announcementGuild:bot?.leaderboardRoleId?bot.guild:null});
    this.board.initialize(this.target);
    this.notices=bot?.leaderboardRoleId?new LeaderboardNotices({sql:storage.sql,source:this.source,send:bot.sendLeaderboard.bind(bot)}):null;
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
    if(profile?.name&&this.board.name(guild,user)!==profile.name)this.board.remember(guild,user,profile.name);
  }
  async name(guild,user){
    const saved=this.board.name(guild,user);
    if(saved!==undefined||this.bot?.guild!==guild||this.nameLookupAfter>Date.now())return saved||null;
    const key=guild+':'+user;
    if(!this.names.has(key)){
      if(this.names.size>=10)return null;
      const lookup=(async()=>{
        try{
          const response=await this.bot.request(`/guilds/${guild}/members/${user}`);
          if(response.status===404){this.board.remember(guild,user,'',Date.now()+3600000);return null;}
          if(response.status===429)this.nameLookupAfter=Date.now()+60000;
          if(!response.ok)return null;
          const member=await response.json();
          if(member.user?.id!==user)return null;
          this.board.remember(guild,user,member.nick||member.user.global_name||member.user.username,Date.now()+86400000);
          return this.board.name(guild,user)||null;
        }catch{return null;}
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
      rank,amount,name:await this.name(session.guild,user)||`玩家 · ${user.slice(-4)}`,
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
      const rows=manifest.format===2?this.vault.rows(generation,'ledger'):this.vault.load(generation).tables.ledger.sort((a,b)=>a.id-b.id);
      this.board.seed(rows,through);
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
