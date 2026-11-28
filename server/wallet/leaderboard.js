import {problem} from './wallet-common.js';

export const LEADERBOARD_PATH='/api/arcade/leaderboard';
export const LEADERBOARD_PAGE_SIZE=10;
export const leaderboardPeriods={all:'總排名',cycle:'月排名'};
export const leaderboardGames={total:'總投入',slot:'老虎機',duel:'野球拳'};
const amounts={
  all:{total:'all_slot+all_duel',slot:'all_slot',duel:'all_duel'},
  cycle:{total:'cycle_slot+cycle_duel',slot:'cycle_slot',duel:'cycle_duel'},
};
const projectionVersion=2;

export function leaderboardQuery(params){
  const period=params.get('period')??'all',game=params.get('game')??'total';
  const page=Number(params.get('page')??'1');
  if(!Object.hasOwn(amounts,period)||!Object.hasOwn(amounts[period],game)||!Number.isInteger(page)||page<1||page>1000000)
    throw problem(400,'排行榜查詢條件有誤。');
  return {period,game,page};
}

function wager(entry){
  if(entry.kind==='duel'&&entry.delta<0)return {game:'duel',amount:-entry.delta};
  if(entry.kind!=='spin')return null;
  const match=/^下注 (\d+)／派彩 (\d+)$/.exec(entry.reason??'');
  const amount=Number(match?.[1]),payout=Number(match?.[2]);
  if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(payout)||payout-amount!==entry.delta)
    throw new Error('Leaderboard wager does not match the committed ledger');
  return {game:'slot',amount};
}

export class Leaderboard {
  constructor({sql,transaction,source,announcementGuild=null,activeVisitStart}){
    Object.assign(this,{sql,transaction,source,announcementGuild,activeVisitStart});
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_state (id INTEGER PRIMARY KEY CHECK(id=1),source TEXT NOT NULL,
      cursor INTEGER NOT NULL, quiet_through INTEGER NOT NULL, seeded INTEGER NOT NULL)`);
    sql.exec('CREATE TABLE IF NOT EXISTS leaderboard_projection (id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL)');
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_scores (guild TEXT NOT NULL, user TEXT NOT NULL, all_slot INTEGER NOT NULL DEFAULT 0,
      all_duel INTEGER NOT NULL DEFAULT 0, cycle_slot INTEGER NOT NULL DEFAULT 0, cycle_duel INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(guild,user))`);
    sql.exec('CREATE TABLE IF NOT EXISTS leaderboard_cycles (guild TEXT PRIMARY KEY, reset_id TEXT NOT NULL, reset_time TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS leaderboard_names (guild TEXT NOT NULL, user TEXT NOT NULL, name TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(guild,user))');
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_outbox (id INTEGER PRIMARY KEY, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', due INTEGER NOT NULL DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_departures (id INTEGER PRIMARY KEY, guild TEXT NOT NULL,
      user TEXT NOT NULL, start INTEGER NOT NULL, time TEXT NOT NULL)`);
    sql.exec('CREATE INDEX IF NOT EXISTS leaderboard_departures_player ON leaderboard_departures(guild,user,id)');
    sql.exec('CREATE INDEX IF NOT EXISTS leaderboard_outbox_status ON leaderboard_outbox(status,id)');
    for(const [period,games] of Object.entries(amounts))for(const [game,expression] of Object.entries(games))
      sql.exec(`CREATE INDEX IF NOT EXISTS leaderboard_${period}_${game} ON leaderboard_scores(guild, (${expression}) DESC, user)`);
  }
  state(){return this.sql.exec('SELECT source,cursor,quiet_through AS quietThrough,seeded FROM leaderboard_state WHERE id=1').toArray()[0];}
  initialize(revision){
    this.transaction(()=>{
      const saved=this.state();
      const sameSource=saved?.source===this.source&&saved.cursor<=revision;
      const version=this.sql.exec('SELECT version FROM leaderboard_projection WHERE id=1').toArray()[0]?.version;
      if(sameSource&&version===projectionVersion)return;
      for(const table of sameSource?['scores','cycles','state']:['scores','cycles','names','outbox','departures','state'])
        this.sql.exec('DELETE FROM leaderboard_'+table);
      // Rebuild the old projection without replaying announcements or forgetting verified names.
      const quietThrough=sameSource?Math.max(saved.cursor,saved.quietThrough):revision;
      this.sql.exec('INSERT INTO leaderboard_state VALUES(1,?,0,?,0)',this.source,quietThrough);
      this.sql.exec('INSERT OR REPLACE INTO leaderboard_projection VALUES(1,?)',projectionVersion);
    });
  }
  inVisit({guild,user,id}){
    const start=this.activeVisitStart(guild,user);
    return (Number.isSafeInteger(start)&&id>start)||this.sql.exec(`SELECT 1 FROM leaderboard_departures
      WHERE guild=? AND user=? AND start<? AND id>=? LIMIT 1`,guild,user,id,id).toArray().length>0;
  }
  queueDeparture({guild,user,start},end,time){
    if(guild!==this.announcementGuild||!Number.isSafeInteger(start.revision)||!Number.isSafeInteger(end.revision)||
      end.revision<=start.revision||end.revision<=this.state().quietThrough)return false;
    if(end.rounds===start.rounds&&!end.duel?.entries)return false;
    this.sql.exec('INSERT OR IGNORE INTO leaderboard_departures VALUES(?,?,?,?,?)',end.revision,guild,user,start.revision,time);
    return true;
  }
  releaseDepartures(cursor){
    const closed=this.sql.exec('SELECT * FROM leaderboard_departures WHERE id<=? ORDER BY id LIMIT 16',cursor).toArray();
    for(const {id,guild,user,start,time} of closed)this.transaction(()=>{
      const rows=this.sql.exec(`SELECT id,payload FROM leaderboard_outbox WHERE id>? AND id<=?
        AND status='held' AND json_extract(payload,'$.user')=? ORDER BY id`,start,id,user).toArray();
      const cycle=this.reset(guild)?.id??null,boards=new Map();
      for(const row of rows){
        const event=JSON.parse(row.payload);
        for(const change of event.changes){
          if(change.period==='cycle'&&event.cycle!==cycle)continue;
          const key=change.period+':'+change.game;
          const previous=boards.get(key)?.previous??change.previous;
          boards.set(key,{...change,previous});
        }
        this.sql.exec('DELETE FROM leaderboard_outbox WHERE id=?',row.id);
      }
      const changes=[...boards.values()].filter(change=>change.current<change.previous);
      if(changes.length)this.sql.exec('INSERT OR IGNORE INTO leaderboard_outbox (id,payload) VALUES(?,?)',id,
        JSON.stringify({user,time,sharedPeriod:cycle===null,changes,departure:true}));
      this.sql.exec('DELETE FROM leaderboard_departures WHERE id=?',id);
    });
    return closed.length===16;
  }
  reset(guild){
    return this.sql.exec('SELECT reset_id AS id,reset_time AS time FROM leaderboard_cycles WHERE guild=?',guild).toArray()[0];
  }
  name(guild,user,now=Date.now()){
    return this.sql.exec('SELECT name FROM leaderboard_names WHERE guild=? AND user=? AND expires>?',guild,user,now).toArray()[0]?.name;
  }
  pageNames(guild,users){
    if(!users.length)return new Map();
    const placeholders=users.map(()=>'?').join(',');
    const rows=this.sql.exec(`SELECT user,name,expires FROM leaderboard_names
      WHERE guild=? AND user IN (${placeholders})`,guild,...users).toArray();
    return new Map(rows.map(row=>[row.user,row]));
  }
  remember(guild,user,name,expires=Number.MAX_SAFE_INTEGER){
    name=Array.from(String(name??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,48).join('');
    this.sql.exec(`INSERT INTO leaderboard_names VALUES(?,?,?,?) ON CONFLICT(guild,user) DO UPDATE SET
      name=excluded.name,expires=excluded.expires WHERE name<>excluded.name OR expires<>excluded.expires`,guild,user,name,expires);
  }
  rows(guild,period,game,limit,offset=0){
    const expression=amounts[period][game];
    return this.sql.exec(`SELECT user,${expression} AS amount FROM leaderboard_scores
      WHERE guild=? ORDER BY ${expression} DESC,user LIMIT ? OFFSET ?`,guild,limit,offset).toArray()
      .map((row,i)=>({user:row.user,amount:row.amount,rank:offset+i+1}));
  }
  position(guild,period,game,user){
    const expression=amounts[period][game];
    const row=this.sql.exec(`SELECT ${expression} AS amount FROM leaderboard_scores WHERE guild=? AND user=?`,guild,user).toArray()[0];
    if(!row)return null;
    return this.rankAt(guild,period,game,user,row.amount);
  }
  rankAt(guild,period,game,user,amount){
    const expression=amounts[period][game];
    return this.sql.exec(`SELECT 1 +
      (SELECT COUNT(*) FROM leaderboard_scores WHERE guild=? AND (${expression})>?) +
      (SELECT COUNT(*) FROM leaderboard_scores WHERE guild=? AND (${expression})=? AND user<?) AS rank`,
      guild,amount,guild,amount,user).one().rank;
  }
  placesGained(guild,period,game,user,before,after){
    const expression=amounts[period][game];
    // Include only the peers this stake passes, respecting the ID tie-break at both ends.
    return this.sql.exec(`SELECT
      (SELECT COUNT(*) FROM leaderboard_scores WHERE guild=? AND (${expression})=? AND user<?) +
      (SELECT COUNT(*) FROM leaderboard_scores WHERE guild=? AND (${expression})>? AND (${expression})<?) +
      (SELECT COUNT(*) FROM leaderboard_scores WHERE guild=? AND (${expression})=? AND user>?) AS gained`,
      guild,before,user,guild,before,after,guild,after,user).one().gained;
  }
  page(guild,{period,game,page}){
    const lastReset=this.reset(guild)?.time??null;
    const count=this.sql.exec('SELECT COUNT(*) AS count FROM leaderboard_scores WHERE guild=?',guild).one().count;
    const pages=Math.max(1,Math.ceil(count/LEADERBOARD_PAGE_SIZE));
    page=Math.min(page,pages);
    return {period,game,page,pages,count,lastReset,rows:this.rows(guild,period,game,LEADERBOARD_PAGE_SIZE,(page-1)*LEADERBOARD_PAGE_SIZE)};
  }
  seed(entries,through,wallets=[]){
    const scores=new Map(),cycles=new Map();
    const scoreFor=(guild,user)=>{
      if(!scores.has(guild))scores.set(guild,new Map());
      const users=scores.get(guild);
      if(!users.has(user))users.set(user,{slot:0,duel:0,cycleSlot:0,cycleDuel:0});
      return users.get(user);
    };
    for(const {guild,user} of wallets)scoreFor(guild,user);
    let cursor=0;
    for(const entry of entries){
      if(entry.id>through)break;
      if(entry.id!==++cursor)throw new Error('Leaderboard backup ledger gap');
      const {guild,user}=entry;
      const score=scoreFor(guild,user);
      if(entry.kind==='reset'){
        if(cycles.get(guild)?.id===entry.reference)continue;
        cycles.set(guild,{id:entry.reference,time:entry.time});
        for(const score of scores.get(guild)?.values()??[])score.cycleSlot=score.cycleDuel=0;
        continue;
      }
      const stake=wager(entry);
      if(!stake)continue;
      score[stake.game]+=stake.amount;
      score[stake.game==='slot'?'cycleSlot':'cycleDuel']+=stake.amount;
    }
    if(cursor!==through)throw new Error('Leaderboard backup ledger incomplete');
    this.transaction(()=>{
      for(const [guild,users] of scores)for(const [user,score] of users)
        this.sql.exec('INSERT INTO leaderboard_scores VALUES(?,?,?,?,?,?)',guild,user,score.slot,score.duel,score.cycleSlot,score.cycleDuel);
      for(const [guild,cycle] of cycles)this.sql.exec('INSERT INTO leaderboard_cycles VALUES(?,?,?)',guild,cycle.id,cycle.time);
      this.sql.exec('UPDATE leaderboard_state SET cursor=?,seeded=1 WHERE id=1',through);
    });
  }
  apply(entries){
    this.transaction(()=>{
      const state=this.state();
      let cursor=state.cursor;
      for(const entry of entries){
        if(entry.id<=cursor)continue;
        if(entry.id!==cursor+1)throw new Error('Leaderboard ledger gap');
        cursor=entry.id;
        const {guild,user}=entry,stake=wager(entry);
        if(!stake)this.sql.exec('INSERT OR IGNORE INTO leaderboard_scores (guild,user) VALUES(?,?)',guild,user);
        if(entry.kind==='reset'){
          if(this.reset(guild)?.id===entry.reference)continue;
          this.sql.exec('UPDATE leaderboard_scores SET cycle_slot=0,cycle_duel=0 WHERE guild=? AND (cycle_slot>0 OR cycle_duel>0)',guild);
          this.sql.exec(`INSERT INTO leaderboard_cycles VALUES(?,?,?) ON CONFLICT(guild) DO UPDATE SET
            reset_id=excluded.reset_id,reset_time=excluded.reset_time`,guild,entry.reference,entry.time);
          continue;
        }
        if(!stake)continue;
        const {game,amount}=stake;
        const canAnnounce=guild===this.announcementGuild&&entry.id>state.quietThrough&&
          (!this.activeVisitStart||this.inVisit(entry));
        const cycle=canAnnounce?this.reset(guild)?.id??null:null;
        const periods=canAnnounce?(cycle===null?['all']:['all','cycle']):[];
        const scores=canAnnounce?this.sql.exec('SELECT all_slot,all_duel,cycle_slot,cycle_duel FROM leaderboard_scores WHERE guild=? AND user=?',guild,user).toArray()[0]:null;
        const changes=[];
        if(scores)for(const period of periods)for(const category of ['total',game]){
          const before=category==='total'?scores[period+'_slot']+scores[period+'_duel']:scores[period+'_'+game];
          const previous=this.rankAt(guild,period,category,user,before);
          const current=previous===1?1:previous-this.placesGained(guild,period,category,user,before,before+amount);
          if(this.activeVisitStart||current<previous)changes.push({period,game:category,previous,current});
        }
        this.sql.exec(`INSERT INTO leaderboard_scores (guild,user,all_${game},cycle_${game}) VALUES(?,?,?,?)
          ON CONFLICT(guild,user) DO UPDATE SET all_${game}=all_${game}+excluded.all_${game},
          cycle_${game}=cycle_${game}+excluded.cycle_${game}`,guild,user,amount,amount);
        if(changes.length)this.sql.exec('INSERT INTO leaderboard_outbox (id,payload,status) VALUES(?,?,?)',entry.id,
          JSON.stringify({user,time:entry.time,sharedPeriod:periods.length===1,cycle,changes}),this.activeVisitStart?'held':'pending');
      }
      this.sql.exec('UPDATE leaderboard_state SET cursor=? WHERE id=1',cursor);
    });
  }
}
