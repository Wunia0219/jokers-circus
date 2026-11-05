import {WalletService} from '../server/wallet/wallet-service.js';
import {validSignature} from '../server/discord/commands.js';
import {CloudState,CloudSessions,CloudLoginLimit,Sealer} from './storage.js';
import {cloudFetch} from './fetch.js';
import {assertPlaytestIdentity,discordTestPlayer} from './yakyuken-playtest-core.js';

export const TEST_GUILD='760012177326997544',TEST_CHANNEL='1564243344857632818',LIVE_APP='1561284960986599626';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function assertDiscordTestApp(env){
  assertPlaytestIdentity(env);
  if(env.DISCORD_TEST_ENABLED!=='true'||!/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID||'')||env.DISCORD_CLIENT_ID===LIVE_APP||env.DISCORD_TEST_GUILD_ID!==TEST_GUILD||env.DISCORD_TEST_CHANNEL_ID!==TEST_CHANNEL)throw new Error('Separate Discord test App required');
}
const failure=(status,message)=>Object.assign(new Error(message),{status});
export class DiscordTestAuth{
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.active=0;}
  setup(){
    if(this.service)return;
    assertDiscordTestApp(this.env);this.state=new CloudState(this.ctx.storage);this.limit=new CloudLoginLimit(this.state);
    this.sealer=new Sealer(this.env.CLOUD_ENCRYPTION_KEY);
    const store={environment:'test',walletEpoch:'discord-test-v1',assertGuild:g=>{if(g!==TEST_GUILD)throw failure(403,'請從指定測試伺服器開啟。');},validate:(g,u)=>{if(g!==TEST_GUILD||!/^\d{17,20}$/.test(u||''))throw failure(403,'測試玩家身分無效。');}};
    this.service=new WalletService(store,{fetchImpl:cloudFetch,sessions:new CloudSessions(this.ctx.storage,this.sealer)});
  }
  async fetch(request){
    try{
      this.setup();const url=new URL(request.url),origin=request.headers.get('origin');
      if(origin&&origin!==`https://${this.env.DISCORD_CLIENT_ID}.discordsays.com`&&origin!==`https://${this.env.DISCORD_TEST_ORIGIN_HOST}`)return json({error:'不允許的測試來源。'},403);
      if(url.pathname==='/authorize'){
        const session=await this.service.authorize(request.headers.get('authorization'));
        const testers=(this.env.DISCORD_TESTER_IDS||'').split(',').filter(Boolean);
        if(testers.length&&!testers.includes(session.user))throw failure(403,'此帳號尚未加入測試名單。');
        return json({player:discordTestPlayer(session.guild,session.user),name:session.profile?.name||'測試玩家',guild:session.guild,user:session.user});
      }
      if(request.method!=='POST')return json({error:'請使用 POST。'},405);
      const text=await request.text();if(text.length>65536)return json({error:'請求過大。'},413);
      let body;try{body=JSON.parse(text);}catch{return json({error:'無效的請求。'},400);}
      if(url.pathname==='/api/interactions'){
        if(!validSignature(this.env.DISCORD_PUBLIC_KEY,Object.fromEntries(request.headers),Buffer.from(text)))return json({error:'無效的 Discord 簽章。'},401);
        if(body.type===1)return json({type:1});
        if(body.application_id!==this.env.DISCORD_CLIENT_ID||body.type!==2||body.data?.type!==4||body.guild_id!==TEST_GUILD||(body.channel_id||body.channel?.id)!==TEST_CHANNEL||body.member?.user?.bot||!/^\d{17,20}$/.test(body.member?.user?.id||''))return json({type:4,data:{flags:64,content:`請到 <#${TEST_CHANNEL}> 啟動測試版。`}});
        const user=body.member.user.id,testers=(this.env.DISCORD_TESTER_IDS||'').split(',').filter(Boolean);
        if(testers.length&&!testers.includes(user))return json({type:4,data:{flags:64,content:'此帳號尚未加入測試名單。'}});
        this.state.set('launch:'+user,{guild:TEST_GUILD,channel:TEST_CHANNEL,expires:Date.now()+86400000});
        return json({type:12});
      }
      if(url.pathname!=='/api/token')return json({error:'找不到此功能。'},404);
      if(text.length>4096||typeof body.code!=='string'||!/^[A-Za-z0-9_-]{1,512}$/.test(body.code)||body.guildId!==TEST_GUILD)return json({error:'請從指定測試伺服器重新啟動。'},403);
      if(this.active>=8)return json({error:'登入忙碌，請稍後重試。'},429);
      const delay=this.limit.take();if(delay)return json({error:'登入嘗試過於頻繁，請稍後重試。'},429);
      this.active++;let succeeded=false;
      try{
        const upstream=await cloudFetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.env.DISCORD_CLIENT_ID,client_secret:this.env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code:body.code}),signal:AbortSignal.timeout(12000),redirect:'error'});
        if(!upstream.ok)return json({error:'Discord 登入未完成，請重新開啟測試版。'},upstream.status===429?429:502);
        const token=await upstream.json();
        if(typeof token.access_token!=='string'||!String(token.scope||'').split(' ').includes('identify'))return json({error:'Discord 未提供必要授權。'},502);
        const session=await this.service.create(token,TEST_GUILD),authorized=await this.service.authorize('Bearer '+session.token),permit=this.state.get('launch:'+session.userId);
        if(!permit||permit.guild!==TEST_GUILD||permit.channel!==TEST_CHANNEL||permit.expires<Date.now())throw failure(403,'請從指定測試頻道的活動入口重新啟動。');
        const testers=(this.env.DISCORD_TESTER_IDS||'').split(',').filter(Boolean);
        if(testers.length&&!testers.includes(session.userId))throw failure(403,'此帳號尚未加入測試名單。');
        this.state.set('player:'+discordTestPlayer(TEST_GUILD,session.userId),{guild:TEST_GUILD,user:session.userId});
        succeeded=true;
        return json({access_token:token.access_token,session:{...session,discordTest:true},profile:{name:authorized.profile?.name||'測試玩家'}});
      }finally{this.active--;if(!succeeded)this.limit.failed();}
    }catch(error){return json({error:error.status?error.message:'Discord 測試登入暫時無法使用。'},error.status||503);}
  }
}
