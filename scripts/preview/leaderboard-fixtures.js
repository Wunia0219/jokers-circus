import {DatabaseSync} from 'node:sqlite';
import {Leaderboard} from '../../server/wallet/leaderboard.js';

export const previewGuild='100000000000000001',previewRole='100000000000000009';
export const previewUser=index=>String(100000000000000100n+BigInt(index));
export const previewNames=['紅幕旅人','金邊紙牌','月下荷官','黑桃爵士','絨幕觀眾','星光巡演','戒指魔術師',
  '夜場常客','花牌騎士','木偶收藏家','彩帶行者','霧光信使','馬戲見習生','初登舞台'];

export function memorySql(){
  const db=new DatabaseSync(':memory:');
  const sql={exec(query,...args){
    const statement=db.prepare(query);
    if(/^SELECT/i.test(query.trim())){
      const rows=statement.all(...args);
      return {toArray:()=>rows,one:()=>rows[0]};
    }
    statement.run(...args);
  }};
  const transaction=work=>{
    db.exec('BEGIN');
    try{const result=work();db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  };
  return {sql,transaction,close:()=>db.close()};
}

export function previewFixture(){
  const storage=memorySql(),entries=[],date='2026-11-01T12:00:00.000Z';
  const board=new Leaderboard({...storage,source:'local-preview',announcementGuild:previewGuild});
  function wager(index,game,amount,time=date){
    return {id:entries.length+1,guild:previewGuild,user:previewUser(index),time,kind:game==='slot'?'spin':'duel',
      delta:game==='slot'?0:-amount,reason:game==='slot'?`下注 ${amount}／派彩 ${amount}`:'挑戰入場費'};
  }
  for(let index=0;index<13;index++){
    entries.push(wager(index,'slot',25500-index*2000));
    if(index<11)entries.push(wager(index,'duel',(11-index)*1000));
  }
  board.initialize(entries.length);
  board.seed(entries,entries.length);
  previewNames.forEach((name,index)=>board.remember(previewGuild,previewUser(index),name));
  const commit=entry=>{entries.push(entry);board.apply([entry]);};
  return {...storage,board,commit,
    newcomer:()=>commit(wager(13,'slot',14500,new Date().toISOString())),
    promote:()=>commit(wager(8,'duel',13000,new Date().toISOString())),
    reset:()=>commit({id:entries.length+1,guild:previewGuild,user:previewUser(0),kind:'reset',delta:0,time:new Date().toISOString(),reference:'local-'+(entries.length+1)}),
  };
}
