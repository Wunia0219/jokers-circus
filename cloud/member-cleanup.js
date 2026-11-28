// Sweep the verified bot's own guild. Names, wallet balance and visits are never evidence of departure.
const DAY=86400000,BATCH=8;
export class MemberCleanup {
  constructor({bot,store,board,state,source,clock=Date.now}){
    Object.assign(this,{bot,store,board,state,source,clock});
    this.cutoffs=new Map();
  }
  key(user){return 'member-cleanup:'+this.source+':'+this.bot.guild+':'+user;}
  revokedAt(guild,user){
    if(guild!==this.bot.guild)return null;
    if(!this.cutoffs.has(user)){
      if(this.cutoffs.size>=1000)this.cutoffs.delete(this.cutoffs.keys().next().value);
      this.cutoffs.set(user,this.state.get(this.key('revoked:'+user)));
    }
    return this.cutoffs.get(user);
  }
  confirmed(guild,user){
    if(guild!==this.bot.guild)return;
    if(this.probe?.user===user)this.probe.cancelled=true;
    if(this.state.get(this.key(user))!=null)this.state.set(this.key(user),null);
  }
  async membership(guild,user,{verifyGuild=false}={}){
    if(guild!==this.bot.guild||this.state.get(this.key('retry'))>this.clock())return 'unknown';
    if(verifyGuild||!this.bot.verified)await this.bot.verify();
    if(!this.bot.verified)return 'unknown';
    const res=await this.bot.request('/guilds/'+guild+'/members/'+user);
    if(res.status===429){
      const delay=Number(res.headers.get('Retry-After'));
      this.state.set(this.key('retry'),this.clock()+(Number.isFinite(delay)&&delay>0?delay*1000:60000));
      return 'unknown';
    }
    if(!res.ok&&res.status!==404)return 'unknown';
    const body=await res.json();
    if(res.status===404&&body.code===10007)return 'absent';
    if(!res.ok||body?.user?.id!==user)return 'unknown';
    this.confirmed(guild,user);
    return body.pending?'pending':'present';
  }
  work(){
    this.running??=this.sweep().finally(()=>{this.probe=null;this.running=null;});
    return this.running;
  }
  status(){
    const guild=this.bot.guild,scan=this.state.get(this.key('scan'))||{};
    const rankings=[];
    for(const period of ['all','cycle'])for(const game of ['total','slot','duel']){
      const {rows,count}=this.board.page(guild,{period,game,page:1});
      rankings.push({period,game,count,ordered:rows.every((r,i)=>r.rank===i+1&&(!i||rows[i-1].amount>=r.amount))});
    }
    const {count:withoutName}=this.board.sql.exec(`SELECT COUNT(*) AS count FROM leaderboard_scores s
      LEFT JOIN leaderboard_names n ON n.guild=s.guild AND n.user=s.user
      WHERE s.guild=? AND COALESCE(n.name,'')=''`,guild).one();
    const {seeded,cursor}=this.board.state();
    return {seeded:!!seeded,cursor,rankings,withoutName,lastBatch:scan.batch??null,nextSweep:scan.due??null};
  }
  async sweep(){
    const guild=this.bot.guild,now=this.clock(),scan=this.state.get(this.key('scan'))||{};
    if(scan.due>now||this.state.get(this.key('retry'))>now||!this.board.state().seeded)return;
    const rows=this.board.sql.exec('SELECT user FROM leaderboard_scores WHERE guild=? AND user>? ORDER BY user LIMIT ?',guild,scan.after||'',BATCH).toArray();
    const batch={at:now,present:0,pending:0,absent:0,unknown:0,removed:0};
    for(const {user} of rows){
      const key=this.key(user),prior=this.state.get(key);
      const probe=this.probe={user,cancelled:false};
      const verifyGuild=prior!=null&&now-prior.missingAt>=DAY;
      const observed=await this.membership(guild,user,{verifyGuild}).catch(()=>'unknown'),observedAt=this.clock();
      if(this.state.get(this.key('retry'))>now)return;
      batch[observed]++;
      if(observed==='absent'&&!probe.cancelled){
        if(prior==null){
          const wallet=await this.store.read(this.store.walletRef(guild,user));
          if(!probe.cancelled&&wallet&&Number.isSafeInteger(wallet.revision))this.state.set(key,{missingAt:observedAt,revision:wallet.revision});
        }
        else if(verifyGuild&&observedAt-prior.missingAt>=DAY){
          // A verified login or a wallet change while the check runs cancels this removal.
          const removed=await this.store.retireMember(guild,user,prior.revision,()=>!probe.cancelled&&this.clock()-observedAt<60000&&this.state.get(key)?.missingAt===prior.missingAt);
          if(removed){batch.removed++;this.state.set(this.key('revoked:'+user),this.clock());this.cutoffs.delete(user);}
          this.state.set(key,null);
        }
      }
      this.state.set(this.key('scan'),{after:user});
    }
    this.state.set(this.key('scan'),{...(rows.length<BATCH?{due:now+DAY}:{after:rows.at(-1).user}),batch});
  }
}
