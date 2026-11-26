import {createServer} from 'vite';
import {CasinoBot} from '../../server/discord/casino-bot.js';
import {LeaderboardNotices} from '../../server/discord/leaderboard-announcement.js';
import {leaderboardQuery,LEADERBOARD_PATH} from '../../server/wallet/leaderboard.js';
import {previewFixture,previewGuild,previewRole} from './leaderboard-fixtures.js';

const host='127.0.0.1',port=4207,origin=`http://${host}:${port}`;
const previewPath='/api/local-leaderboard-preview';
const channel='100000000000000002',applicationId='100000000000000003';
let fixture=previewFixture(),lastNotices=[];
const bot=new CasinoBot({guild:previewGuild,channel,applicationId,leaderboardRoleId:previewRole,fetchImpl:async(url,options)=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/users/@me'))return Response.json({id:applicationId,bot:true});
  if(path.endsWith('/channels/'+channel))return Response.json({id:channel,guild_id:previewGuild,type:0});
  if(path.endsWith('/channels/'+channel+'/messages')&&options.method==='POST'){
    lastNotices.push(JSON.parse(options.body));
    return Response.json({id:'100000000000000010',channel_id:channel});
  }
  throw new Error('Only the local Discord mock is available');
}});
const json=(res,status,data)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
};
const server=await createServer({
  cacheDir:'.tools/leaderboard-vite-cache',
  optimizeDeps:{entries:['leaderboard-preview.html']},
  server:{host,port,strictPort:true,watch:{ignored:['**/.tools/**','**/test-results/**','**/dist*/**','**/data/**']}},
  plugins:[{name:'leaderboard-local-preview',configureServer(vite){
    vite.middlewares.use(async(req,res,next)=>{
      const url=new URL(req.url,origin);
      if(![LEADERBOARD_PATH,previewPath].includes(url.pathname))return next();
      if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)
        return json(res,403,{error:'此預覽只供本機使用。'});
      try{
        if(url.pathname===LEADERBOARD_PATH&&req.method==='GET'){
          const result=fixture.board.page(previewGuild,leaderboardQuery(url.searchParams));
          return json(res,200,{...result,rows:result.rows.map(({user,rank,amount})=>({rank,amount,name:fixture.board.name(previewGuild,user)}))});
        }
        if(url.pathname===previewPath&&req.method==='POST'){
          const action=url.searchParams.get('action');
          lastNotices=[];
          if(action==='restore'){
            fixture.close();
            fixture=previewFixture();
          }else if(['newcomer','promote','reset'].includes(action)){
            fixture[action]();
            await new LeaderboardNotices({sql:fixture.sql,source:'local-preview',send:bot.sendLeaderboard.bind(bot)}).flush();
          }else return json(res,400,{error:'未知的預覽操作。'});
          return json(res,200,{notices:lastNotices});
        }
        return json(res,405,{error:'不支援此操作。'});
      }catch(error){return json(res,error.status||500,{error:error.status?error.message:'本機預覽失敗。'});}
    });
  }}],
});
await server.listen();
console.log(`排行榜本機預覽 ${origin}/leaderboard-preview.html`);
