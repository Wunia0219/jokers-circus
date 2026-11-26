import {playerMention} from './player-display.js';
import {leaderboardGames,leaderboardPeriods} from '../wallet/leaderboard.js';

const format=new Intl.NumberFormat('en-US');

export function leaderboardNotice(event){
  const actor=playerMention(event.user)??'玩家';
  return {embeds:event.changes.map(({period,game,previous,current,rows})=>({
    title:`總投入排行榜 · ${event.sharedPeriod?'開服至今／月重設後':leaderboardPeriods[period]} · ${leaderboardGames[game]}`,
    color:0xcda459,
    description:[
      previous===null?`${actor} 進入前十，本次第 **${current}** 名。`:
        `${actor} 從第 **${previous}** 名升至第 **${current}** 名。`,
      '',
      ...rows.map(({user,rank,amount})=>`${rank}. ${playerMention(user)??'玩家'}　**${format.format(amount)}** 戲籌`),
    ].join('\n'),
    timestamp:event.time,
  }))};
}

export class LeaderboardNotices {
  constructor({sql,send,source,clock=Date.now}){
    Object.assign(this,{sql,send,source,clock});
    // An interrupted Discord POST may have been accepted. Never re-post it.
    sql.exec("UPDATE leaderboard_outbox SET status='uncertain' WHERE status='sending'");
  }
  nextDelay(){
    const event=this.sql.exec("SELECT due FROM leaderboard_outbox WHERE status='pending' ORDER BY id LIMIT 1").toArray()[0];
    return event?Math.max(1000,event.due-this.clock()):null;
  }
  async flush(){
    this.running??=this.deliver().finally(()=>{this.running=null;});
    return this.running;
  }
  async deliver(){
    for(let n=0;n<5;n++){
      const event=this.sql.exec("SELECT id,payload,due FROM leaderboard_outbox WHERE status='pending' ORDER BY id LIMIT 1").toArray()[0];
      if(!event||event.due>this.clock())return;
      this.sql.exec("UPDATE leaderboard_outbox SET status='sending' WHERE id=?",event.id);
      let result;
      try{result=await this.send(leaderboardNotice(JSON.parse(event.payload)),`leaderboard:${this.source}:${event.id}`);}
      catch{result={kind:'uncertain'};}
      if(result.kind==='sent')this.sql.exec('DELETE FROM leaderboard_outbox WHERE id=?',event.id);
      else if(result.kind==='retry')this.sql.exec("UPDATE leaderboard_outbox SET status='pending',due=? WHERE id=?",this.clock()+result.delay,event.id);
      else this.sql.exec("UPDATE leaderboard_outbox SET status='uncertain' WHERE id=?",event.id);
      if(result.kind!=='sent')return;
    }
  }
}
