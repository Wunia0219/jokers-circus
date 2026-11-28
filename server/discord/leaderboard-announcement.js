import {playerMention} from './player-display.js';
import {leaderboardGames,leaderboardPeriods} from '../wallet/leaderboard.js';
import {LEADERBOARD_RECEIPT_NAME} from './casino-receipt.js';

const placesGained=({previous,current})=>previous-current;

function boardDescription({period,game,previous,current},sharedPeriod,boldGain=false){
  const periodName=sharedPeriod?`${leaderboardPeriods.cycle}／${leaderboardPeriods.all}`:leaderboardPeriods[period];
  return `${periodName} · ${rankDescription({game,previous,current},boldGain)}`;
}

function rankDescription({game,previous,current},boldGain){
  const gain=`上升 ${previous-current} 名`;
  return `${leaderboardGames[game]}　第 ${previous} 名 → 第 ${current} 名（${boldGain?`**${gain}**`:gain}）`;
}

export function leaderboardNotice(event,{groupPeriods=false}={}){
  const changes=event.changes.filter(change=>change.previous!==null&&placesGained(change)>0);
  if(!changes.length)return null;
  const actor=playerMention(event.user)??'玩家';
  const featured=changes.reduce((best,change)=>placesGained(change)>placesGained(best)?change:best);
  const grouped=groupPeriods&&!event.sharedPeriod;
  const lines=grouped?['cycle','all'].flatMap(period=>{
    const boards=changes.filter(change=>change.period===period);
    return boards.length?['',`**${leaderboardPeriods[period]}**`,...boards.map(change=>rankDescription(change,true))]:[];
  }):changes.map(change=>boardDescription(change,event.sharedPeriod,true));
  return {embeds:[{
    title:'排行榜 · 名次晉升',
    color:0xb08763,
    description:[actor,...lines].join('\n'),
    image:{url:`attachment://${LEADERBOARD_RECEIPT_NAME}`},
    timestamp:event.time,
  }],leaderboardReceipt:{previous:featured.previous,current:featured.current,
    ...(grouped?{board:`${featured.period}-${featured.game}`}:{}),description:boardDescription(featured,event.sharedPeriod)}};
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
      try{
        const message=leaderboardNotice(JSON.parse(event.payload));
        result=message?await this.send(message,`leaderboard:${this.source}:${event.id}`):{kind:'sent'};
      }
      catch{result={kind:'uncertain'};}
      if(result.kind==='sent')this.sql.exec('DELETE FROM leaderboard_outbox WHERE id=?',event.id);
      else if(result.kind==='retry')this.sql.exec("UPDATE leaderboard_outbox SET status='pending',due=? WHERE id=?",this.clock()+result.delay,event.id);
      else this.sql.exec("UPDATE leaderboard_outbox SET status='uncertain' WHERE id=?",event.id);
      if(result.kind!=='sent')return;
    }
  }
}
