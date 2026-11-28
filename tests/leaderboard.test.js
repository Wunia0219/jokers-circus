import test from 'node:test';
import assert from 'node:assert/strict';
import {leaderboardQuery,LEADERBOARD_PATH} from '../server/wallet/leaderboard.js';
import {LeaderboardNotices} from '../server/discord/leaderboard-announcement.js';
import {CasinoBot} from '../server/discord/casino-bot.js';
import {CloudLeaderboard} from '../cloud/leaderboard.js';
import {handleFetch} from '../cloud/http-bridge.js';
import {createActivityHandler} from '../server/http/app-handler.js';
import {problem} from '../server/wallet/wallet-common.js';
import {memorySql,previewFixture,previewGuild as guild,previewRole as role,previewUser as user} from '../scripts/preview/leaderboard-fixtures.js';

const time='2026-11-01T12:00:00.000Z',otherGuild='100000000000000002';
const slot=(id,amount,overrides={})=>({id,guild,user:user(0),time,kind:'spin',reason:`下注 ${amount}／派彩 2000`,delta:2000-amount,...overrides});
const cycle=(board,game='total',page=1)=>board.page(guild,{period:'cycle',game,page});
const all=(board,game='total',page=1)=>board.page(guild,{period:'all',game,page});
const outbox=sql=>sql.exec('SELECT payload,status FROM leaderboard_outbox ORDER BY id').toArray()
  .map(({payload,status})=>({...JSON.parse(payload),status}));

test('six boards use committed stake, stable ties and ten rows per page',t=>{
  const fixture=previewFixture();t.after(fixture.close);
  const {board}=fixture;
  assert.equal(all(board).count,13);
  assert.deepEqual(all(board).rows.map(r=>r.rank),[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(all(board,'total',2).rows.map(r=>r.rank),[11,12,13]);
  for(const game of ['total','slot','duel']){
    assert.deepEqual(all(board,game).rows,cycle(board,game).rows);
    assert.equal(all(board,game).rows[0].amount,{total:36500,slot:25500,duel:11000}[game]);
  }
  const start=board.state().cursor;
  const tied=slot(start+1,25500,{user:user(13)});
  board.apply([tied,slot(start+2,4000,{kind:'grant'}),slot(start+3,200,{kind:'duel',delta:2000}),
    slot(start+4,200,{guild:otherGuild})]);
  board.apply([tied]);
  assert.deepEqual(all(board,'slot').rows.slice(0,2).map(r=>[r.user,r.amount]),[[user(0),25500],[user(13),25500]]);
  assert.equal(all(board,'duel').rows[0].amount,11000);
  assert.equal(board.page(otherGuild,{period:'all',game:'total',page:1}).rows[0].amount,200);
  assert.throws(()=>leaderboardQuery(new URLSearchParams({game:'constructor'})),{status:400});
  assert.throws(()=>leaderboardQuery(new URLSearchParams({page:'0'})),{status:400});
});

test('reset clears current scores once per guild reset and preserves lifetime totals',t=>{
  const fixture=previewFixture();t.after(fixture.close);
  const {board,sql}=fixture,before=all(board).rows,start=board.state().cursor;
  const reset={id:start+1,guild,user:user(0),kind:'reset',delta:0,time,reference:'monthly-a'};
  board.apply([reset,{...reset,id:start+2,user:user(1)}]);
  assert.deepEqual(all(board).rows,before);
  assert.equal(cycle(board).count,13);
  assert.ok(cycle(board).rows.every(row=>row.amount===0));
  assert.deepEqual(outbox(sql),[]);
  board.apply([slot(start+3,500,{user:user(1)})]);
  board.apply([reset]);
  assert.equal(cycle(board).rows[0].amount,500);
  assert.equal(cycle(board).lastReset,time);
  assert.equal(all(board).rows[0].amount,36500);
  assert.deepEqual(outbox(sql).map(e=>e.changes.map(c=>[c.period,c.game])),[[['cycle','total'],['cycle','slot']]]);
  assert.throws(()=>board.apply([slot(start+4,100),slot(start+6,100)]),/ledger gap/);
  assert.equal(cycle(board).rows[0].amount,500);
});

test('rank moves each send one grouped message and only ping the configured role',async t=>{
  const fixture=previewFixture();t.after(fixture.close);
  const {board,sql}=fixture;
  fixture.climb();fixture.promote();
  board.apply([slot(board.state().cursor+1,100,{user:user(0)})]); // #1 keeps the same rank
  board.apply([slot(board.state().cursor+1,50000,{user:user(13)})]); // No previous rank
  const events=outbox(sql);
  assert.equal(events.length,2);
  assert.ok(events.every(e=>e.sharedPeriod&&e.changes.length===2));
  assert.ok(events[0].changes.every(c=>c.previous===13&&c.current<=10));
  assert.ok(events.every(e=>e.changes.every(c=>c.previous>c.current)));
  const posts=[];
  const bot=new CasinoBot({guild,channel:otherGuild,applicationId:user(0),leaderboardRoleId:role,fetchImpl:async(_,options)=>{
    const message=JSON.parse(options.body.get('payload_json'));
    assert.equal(options.body.get('files[0]').name,'casino-leaderboard.png');
    posts.push(message);
    return Response.json({id:user(1),channel_id:otherGuild});
  }});
  bot.verified=true;
  const notices=new LeaderboardNotices({sql,source:'case',send:bot.sendLeaderboard.bind(bot)});
  await notices.flush();await notices.flush();
  assert.equal(posts.length,2);
  assert.notEqual(posts[0].nonce,posts[1].nonce);
  for(const post of posts){
    assert.equal(post.content,`<@&${role}>`);
    assert.deepEqual(post.allowed_mentions,{parse:[],roles:[role]});
    assert.equal(post.embeds.length,1);
    assert.equal(post.embeds[0].title,'排行榜 · 名次晉升');
    assert.equal(post.embeds[0].image.url,'attachment://casino-leaderboard.png');
    assert.equal(post.components[0].components[0].label,'開啟遊戲');
  }
});

test('moves outside the top ten retain both positions and post one card with the test label',async t=>{
  const fixture=previewFixture();t.after(fixture.close);
  const {board,sql}=fixture;
  board.apply([slot(board.state().cursor+1,2100,{user:user(12)})]);
  const [event]=outbox(sql);
  assert.deepEqual(event.changes,[{period:'all',game:'total',previous:13,current:12},{period:'all',game:'slot',previous:13,current:12}]);
  const posts=[];
  const bot=new CasinoBot({guild,channel:otherGuild,applicationId:user(0),leaderboardText:'@試運者',fetchImpl:async(url,options)=>{
    assert.ok(url.endsWith(`/channels/${otherGuild}/messages`));
    posts.push(JSON.parse(options.body.get('payload_json')));
    return Response.json({id:user(1),channel_id:otherGuild});
  }});
  bot.verified=true;
  await new LeaderboardNotices({sql,source:'case',send:bot.sendLeaderboard.bind(bot)}).flush();
  assert.equal(posts.length,1);
  assert.equal(posts[0].content,'@試運者');
  assert.deepEqual(posts[0].allowed_mentions,{parse:[]});
  assert.match(posts[0].embeds[0].description,new RegExp(`<@${user(12)}>.*`));
  assert.match(posts[0].embeds[0].description,/第 13 名 → 第 12 名（\*\*上升 1 名\*\*）/);
  assert.match(posts[0].attachments[0].description,/上升 1 名/);
});

test('one departure releases the combined changes after projection catches up',async t=>{
  const player=user(12);
  let start;
  const fixture=previewFixture({activeVisitStart:(g,u)=>g===guild&&u===player?start:undefined});
  t.after(fixture.close);
  const {board,sql}=fixture;
  start=board.state().cursor;
  const startRevision=start;
  const first=board.position(guild,'all','slot',player);
  const posts=[];
  const notices=new LeaderboardNotices({sql,source:'case',send:async message=>{
    posts.push(message);return {kind:'sent'};
  }});
  fixture.climb();
  await notices.flush();
  assert.equal(posts.length,0);
  assert.deepEqual(outbox(sql).map(event=>event.status),['held']);

  const finish=board.state().cursor+1;
  assert.equal(board.queueDeparture({guild,user:player,start:{revision:startRevision,rounds:0}},
    {revision:finish,rounds:2},time),true);
  start=undefined;
  board.releaseDepartures(finish-1);
  await notices.flush();
  assert.equal(posts.length,0);
  board.apply([slot(finish,10000,{user:player})]);
  board.releaseDepartures(finish);
  board.releaseDepartures(finish);
  await notices.flush();
  assert.equal(posts.length,1);
  const current=board.position(guild,'all','slot',player);
  assert.ok(posts[0].embeds[0].description.includes(`老虎機　第 ${first} 名 → 第 ${current} 名`));
  assert.deepEqual(outbox(sql),[]);
});

test('rank notices preserve retry deadlines and quarantine interrupted sends',async t=>{
  const fixture=previewFixture();t.after(fixture.close);
  const {sql}=fixture;
  fixture.climb();fixture.promote();
  let now=1000,attempts=0;
  const options={sql,source:'case',clock:()=>now,send:async()=>{
    attempts++;
    return attempts===1?{kind:'retry',delay:9000}:{kind:'sent'};
  }};
  await new LeaderboardNotices(options).flush();
  const restarted=new LeaderboardNotices(options);
  assert.equal(restarted.nextDelay(),9000);
  await restarted.flush();
  assert.equal(attempts,1);
  sql.exec("UPDATE leaderboard_outbox SET status='sending' WHERE id=(SELECT MAX(id) FROM leaderboard_outbox)");
  const afterInterruptedSend=new LeaderboardNotices(options);
  now=10000;
  await afterInterruptedSend.flush();
  assert.equal(attempts,2);
  assert.deepEqual(outbox(sql).map(event=>event.status),['uncertain']);
  assert.equal(afterInterruptedSend.nextDelay(),null);
});

test('archive bootstraps quietly and the live projection recovers missing committed rows after restart',async t=>{
  const {sql,transaction,close}=memorySql();t.after(close);
  const storage={sql,transactionSync:transaction};
  const ledger=[slot(1,500),slot(2,1000),slot(3,2000)],fetches=[];
  const readDoc=id=>({exists:true,get:()=>JSON.stringify(ledger[id-1]),data:()=>ledger[id-1]});
  const store={settings:{namespace:'test'},root:{collection:()=>({doc:Number})},
    db:{batchGet:async ids=>{fetches.push(ids);return ids.map(readDoc);}}};
  const quota={reserve(){},observe(){}};
  const vault={manifest:()=>({format:2,revision:1}),rows:(_,table)=>table==='wallets'?[{guild,user:user(1)}]:ledger.slice(0,1)};
  const options={storage,state:{get:()=>null},vault,store,quota,wake(){}};
  const cloud=new CloudLeaderboard({...options,meta:{nextId:2}});
  await cloud.work();
  assert.equal(cloud.board.state().cursor,2);
  assert.deepEqual(fetches,[[2]]);
  assert.deepEqual(outbox(sql),[]);
  const restarted=new CloudLeaderboard({...options,meta:{nextId:3}});
  await restarted.work();
  assert.deepEqual(fetches,[[2],[3]]);
  const page=await restarted.page({guild,user:user(0),profile:{name:'樣本'}},new URLSearchParams());
  assert.deepEqual(page.rows,[{rank:1,amount:3500,name:'樣本'},{rank:2,amount:0,name:'Discord 名稱待同步'}]);
  const fresh=new CloudLeaderboard({...options,meta:{nextId:0,walletEpoch:'new'},vault:{manifest:()=>({format:2,revision:0}),rows:()=>[]}});
  await fresh.work();
  assert.equal(all(fresh.board).count,0);
});

test('the deployed projection backfills zero rows and preserves verified names and queued announcements',async t=>{
  const {sql,transaction,close}=memorySql();t.after(close);
  const ledger=[slot(1,1000),{id:2,guild,user:user(2),kind:'welcome'},{id:3,guild:otherGuild,user:user(3),kind:'welcome'}];
  const meta={nextId:3},store={settings:{namespace:'test'},root:{collection:()=>({doc:Number})},db:{batchGet:async ids=>ids.map(id=>({exists:true,get:()=>JSON.stringify(ledger[id-1]),data:()=>ledger[id-1]}))}};
  const options={storage:{sql,transactionSync:transaction},state:{get:()=>null},store,meta,quota:{reserve(){},observe(){}},wake(){},
    vault:{manifest:()=>({format:2,revision:1}),rows:(_,table)=>table==='wallets'?[{guild,user:user(1)}]:ledger.slice(0,1)}};
  const prior=new CloudLeaderboard(options);
  prior.board.seed(ledger,3);
  prior.board.remember(guild,user(0),'舊版已核對');
  sql.exec('DELETE FROM leaderboard_scores WHERE all_slot=0');
  sql.exec('INSERT INTO leaderboard_outbox(id,payload) VALUES(1,?)','{}');
  sql.exec('DELETE FROM leaderboard_projection');
  const upgraded=new CloudLeaderboard(options);
  await upgraded.work();
  assert.equal(upgraded.board.name(guild,user(0)),'舊版已核對');
  assert.equal(outbox(sql).length,1);
  assert.deepEqual(all(upgraded.board).rows.map(row=>[row.user,row.amount]),[[user(0),1000],[user(1),0],[user(2),0]]);
  for(const period of ['all','cycle'])for(const game of ['total','slot','duel'])assert.equal(upgraded.board.page(guild,{period,game,page:1}).count,3);
  assert.equal(upgraded.board.page(otherGuild,{period:'all',game:'total',page:1}).count,1);
  upgraded.board.remember(guild,user(4),'有登入、無錢包');
  assert.equal(all(upgraded.board).count,3);
  const newWallet={id:4,guild,user:user(5),kind:'welcome'};
  upgraded.commit([newWallet]);
  await upgraded.work();
  assert.equal(all(upgraded.board).count,4);
  assert.equal(outbox(sql).length,1);
});

test('a verified lookup-only bot resolves past players and does not enable announcements',async t=>{
  const {sql,transaction,close}=memorySql();t.after(close);
  let verifies=0,lookups=0;
  const memberBot={guild,verified:false,async verify(){verifies++;this.verified=true;},
    async request(path){lookups++;const id=path.split('/').at(-1);return id===user(0)?
      Response.json({nick:'群內暱稱',user:{id,username:'帳號名稱'}}):Response.json({user:{id,global_name:'顯示名稱'}});}};
  const cloud=new CloudLeaderboard({storage:{sql,transactionSync:transaction},state:{get:()=>null},store:{settings:{namespace:'test'}},
    meta:{nextId:0},memberBot,wake(){},vault:{manifest:()=>({format:2,revision:0}),rows:(_,table)=>table==='wallets'?[0,1,2].map(index=>({guild,user:user(index)})):[]}});
  await cloud.work();
  const session={guild,user:user(2),profile:{name:'登入已核對'}};
  const first=await cloud.page(session,new URLSearchParams());
  assert.deepEqual(first.rows.map(row=>row.name),['群內暱稱','顯示名稱','登入已核對']);
  await cloud.page(session,new URLSearchParams());
  assert.deepEqual([verifies,lookups],[1,2]);
  assert.equal(await cloud.name(otherGuild,user(0)),null);
  assert.equal(cloud.notices,null);
});

test('leaderboard HTTP reads use only the signed-in guild and respect the feature reveal gate',async()=>{
  let feature='hidden';
  const handler=createActivityHandler({wallet:{
    store:{walletEpoch:'test-epoch'},arcade:{read:()=>({feature})},
    service:{authorize:async authorization=>{
      if(authorization!=='Bearer verified')throw problem(401,'登入已過期');
      return {guild};
    }},
    leaderboard:{page:async(session,params)=>({guild:session.guild,...leaderboardQuery(params)})},
  }});
  const request=(query='',headers={},method='GET')=>handleFetch(handler,new Request(
    'https://activity.example'+LEADERBOARD_PATH+'?'+query,{headers,method}));
  const headers={Authorization:'Bearer verified','X-Wallet-Epoch':'test-epoch'};
  assert.equal((await request()).status,401);
  assert.equal((await request('',{Authorization:'Bearer verified'})).status,401);
  assert.equal((await request('',headers,'POST')).status,405);
  assert.equal((await request('game=duel',headers)).status,404);
  feature='open';
  const response=await request('period=cycle&game=duel&page=2&guild='+otherGuild,headers);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(await response.json(),{guild,period:'cycle',game:'duel',page:2});
});
