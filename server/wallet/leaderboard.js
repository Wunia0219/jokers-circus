import {problem} from './wallet-common.js';

export const LEADERBOARD_PATH='/api/arcade/leaderboard';
export const LEADERBOARD_PAGE_SIZE=10;
export const leaderboardPeriods={all:'開服至今',cycle:'月重設後'};
export const leaderboardGames={total:'總投入',slot:'老虎機',duel:'野球拳'};
const amounts={
  all:{total:'all_slot+all_duel',slot:'all_slot',duel:'all_duel'},
  cycle:{total:'cycle_slot+cycle_duel',slot:'cycle_slot',duel:'cycle_duel'},
};

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
  constructor({sql,transaction,source,announcementGuild=null}){
    Object.assign(this,{sql,transaction,source,announcementGuild});
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_state (id INTEGER PRIMARY KEY CHECK(id=1),source TEXT NOT NULL,
      cursor INTEGER NOT NULL, quiet_through INTEGER NOT NULL, seeded INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_scores (guild TEXT NOT NULL, user TEXT NOT NULL, all_slot INTEGER NOT NULL DEFAULT 0,
      all_duel INTEGER NOT NULL DEFAULT 0, cycle_slot INTEGER NOT NULL DEFAULT 0, cycle_duel INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(guild,user))`);
    sql.exec('CREATE TABLE IF NOT EXISTS leaderboard_cycles (guild TEXT PRIMARY KEY, reset_id TEXT NOT NULL, reset_time TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS leaderboard_names (guild TEXT NOT NULL, user TEXT NOT NULL, name TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(guild,user))');
    sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_outbox (id INTEGER PRIMARY KEY, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', due INTEGER NOT NULL DEFAULT 0)`);
    for(const [period,games] of Object.entries(amounts))for(const [game,expression] of Object.entries(games))
      sql.exec(`CREATE INDEX IF NOT EXISTS leaderboard_${period}_${game} ON leaderboard_scores(guild, (${expression}) DESC, user)`);
  }
  state(){return this.sql.exec('SELECT source,cursor,quiet_through AS quietThrough,seeded FROM leaderboard_state WHERE id=1').toArray()[0];}
  initialize(revision){
    this.transaction(()=>{
      const saved=this.state();
      if(saved?.source===this.source&&saved.cursor<=revision)return;
      for(const table of ['scores','cycles','names','outbox','state'])this.sql.exec('DELETE FROM leaderboard_'+table);
      this.sql.exec('INSERT INTO leaderboard_state VALUES(1,?,0,?,0)',this.source,revision);
    });
  }
  reset(guild){
    return this.sql.exec('SELECT reset_id AS id,reset_time AS time FROM leaderboard_cycles WHERE guild=?',guild).toArray()[0];
  }
  name(guild,user,now=Date.now()){
    return this.sql.exec('SELECT name FROM leaderboard_names WHERE guild=? AND user=? AND expires>?',guild,user,now).toArray()[0]?.name;
  }
  remember(guild,user,name,expires=Number.MAX_SAFE_INTEGER){
    name=Array.from(String(name??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,48).join('');
    this.sql.exec(`INSERT INTO leaderboard_names VALUES(?,?,?,?) ON CONFLICT(guild,user) DO UPDATE SET
      name=excluded.name,expires=excluded.expires WHERE name<>excluded.name OR expires<>excluded.expires`,guild,user,name,expires);
  }
  rows(guild,period,game,limit,offset=0){
    const expression=amounts[period][game];
    return this.sql.exec(`SELECT user,${expression} AS amount FROM leaderboard_scores
      WHERE guild=? AND ${expression}>0 ORDER BY ${expression} DESC,user LIMIT ? OFFSET ?`,guild,limit,offset).toArray()
      .map((row,i)=>({user:row.user,amount:row.amount,rank:offset+i+1}));
  }
  page(guild,{period,game,page}){
    const lastReset=this.reset(guild)?.time??null,expression=amounts[period][game];
    const count=this.sql.exec(`SELECT COUNT(*) AS count FROM leaderboard_scores WHERE guild=? AND ${expression}>0`,guild).one().count;
    const pages=Math.max(1,Math.ceil(count/LEADERBOARD_PAGE_SIZE));
    page=Math.min(page,pages);
    return {period,game,page,pages,count,lastReset,rows:this.rows(guild,period,game,LEADERBOARD_PAGE_SIZE,(page-1)*LEADERBOARD_PAGE_SIZE)};
  }
  seed(entries,through){
    const scores=new Map(),cycles=new Map();
    let cursor=0;
    for(const entry of entries){
      if(entry.id>through)break;
      if(entry.id!==++cursor)throw new Error('Leaderboard backup ledger gap');
      const {guild,user}=entry;
      if(entry.kind==='reset'){
        if(cycles.get(guild)?.id===entry.reference)continue;
        cycles.set(guild,{id:entry.reference,time:entry.time});
        for(const score of scores.get(guild)?.values()??[])score.cycleSlot=score.cycleDuel=0;
        continue;
      }
      const stake=wager(entry);
      if(!stake)continue;
      if(!scores.has(guild))scores.set(guild,new Map());
      const users=scores.get(guild);
      if(!users.has(user))users.set(user,{slot:0,duel:0,cycleSlot:0,cycleDuel:0});
      const score=users.get(user);
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
        if(entry.kind==='reset'){
          if(this.reset(entry.guild)?.id===entry.reference)continue;
          this.sql.exec('UPDATE leaderboard_scores SET cycle_slot=0,cycle_duel=0 WHERE guild=? AND (cycle_slot>0 OR cycle_duel>0)',entry.guild);
          this.sql.exec(`INSERT INTO leaderboard_cycles VALUES(?,?,?) ON CONFLICT(guild) DO UPDATE SET
            reset_id=excluded.reset_id,reset_time=excluded.reset_time`,entry.guild,entry.reference,entry.time);
          continue;
        }
        const stake=wager(entry);
        if(!stake)continue;
        const {guild,user}=entry,{game,amount}=stake;
        const canAnnounce=guild===this.announcementGuild&&entry.id>state.quietThrough;
        const periods=canAnnounce?(this.reset(guild)?['all','cycle']:['all']):[];
        const boards=periods.flatMap(period=>['total',game].map(game=>({
          period,game,previous:this.rows(guild,period,game,LEADERBOARD_PAGE_SIZE).find(row=>row.user===user)?.rank,
        })));
        this.sql.exec(`INSERT INTO leaderboard_scores (guild,user,all_${game},cycle_${game}) VALUES(?,?,?,?)
          ON CONFLICT(guild,user) DO UPDATE SET all_${game}=all_${game}+excluded.all_${game},
          cycle_${game}=cycle_${game}+excluded.cycle_${game}`,guild,user,amount,amount);
        const changes=[];
        for(const {period,game,previous} of boards){
          const rows=this.rows(guild,period,game,LEADERBOARD_PAGE_SIZE),current=rows.find(row=>row.user===user)?.rank;
          if(current!==undefined&&(previous===undefined||current<previous))
            changes.push({period,game,previous:previous??null,current,rows});
        }
        if(changes.length)this.sql.exec('INSERT INTO leaderboard_outbox (id,payload) VALUES(?,?)',entry.id,
          JSON.stringify({user,time:entry.time,sharedPeriod:periods.length===1,changes}));
      }
      this.sql.exec('UPDATE leaderboard_state SET cursor=? WHERE id=1',cursor);
    });
  }
}
