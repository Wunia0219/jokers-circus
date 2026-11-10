import {timingSafeEqual} from 'node:crypto';
import {FirestoreRest} from './firestore-rest.js';
import {cloudFetch} from './fetch.js';
import {assertPlaytestIdentity,PlaytestService,PLAYTEST_IDENTITY,PLAYTEST_PLAYERS,validTestPlayer,slotTestState,slotTestCheckinResult,discordTestPlayer} from './yakyuken-playtest-core.js';
import {assertDiscordTestApp,TEST_GUILD} from './discord-test-auth.js';
import {CHARACTERS} from '../src/games/yakyuken/characters.js';
import {secureResponse} from '../server/http/security-headers.js';
import {audioAsset} from './audio-asset.js';
import {testWalletRepository} from './test-wallet-repository.js';
export {DiscordTestAuth} from './discord-test-auth.js';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const allCG=Object.freeze(Object.fromEntries(CHARACTERS.filter(c=>c.enabled).map(c=>[c.id,c.winsRequired])));
export function testCGUnlocks(wallet,player,previewUserId){
  if(wallet?.player!==player||typeof previewUserId!=='string'||!/^\d{17,20}$/.test(previewUserId)||player!==discordTestPlayer(TEST_GUILD,previewUserId))return wallet;
  return {...wallet,unlocks:{...wallet.unlocks,...allCG}};
}
function authorized(request,env){
  const actual=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from('Bearer '+(env.PLAYTEST_TOKEN||''));
  return /^[a-f0-9]{64}$/.test(env.PLAYTEST_TOKEN||'')&&actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export default {
  async fetch(request,env){
    try{assertPlaytestIdentity(env);}catch{return json({error:'Test environment unavailable'},503);}
    const url=new URL(request.url);
    if(url.pathname==='/healthz'&&request.method==='GET')return json({ok:true,environment:'test',worker:PLAYTEST_IDENTITY.worker,projectId:env.FIRESTORE_PROJECT_ID,namespace:env.FIRESTORE_NAMESPACE});
    if(['/api/token','/api/interactions','/api/session'].includes(url.pathname)){
      try{assertDiscordTestApp(env);}catch{return json({error:'Discord 測試入口尚未設定完成。'},503);}
      if(url.pathname==='/api/session'){
        if(request.method!=='GET')return json({error:'請使用 GET。'},405);
        return env.DISCORD_TEST_AUTH.get(env.DISCORD_TEST_AUTH.idFromName('auth')).fetch(new Request(new URL('/authorize',url),{headers:request.headers}));
      }
      return env.DISCORD_TEST_AUTH.get(env.DISCORD_TEST_AUTH.idFromName('auth')).fetch(request);
    }
    const financial=/^\/api\/playtest\/(state|begin|hand|leave|checkin)$/.test(url.pathname)||['/api/wallet','/api/spin','/api/checkin','/api/rounds','/api/ledger'].includes(url.pathname);
    if(financial){
      let player=url.searchParams.get('player'),name;
      const internal=new Headers(request.headers);
      internal.delete('X-Test-Name');
      if(authorized(request,env)){
        if(!Object.hasOwn(PLAYTEST_PLAYERS,player))return json({error:'無效的測試玩家。'},400);
      }else{
        try{assertDiscordTestApp(env);}catch{return json({error:'需要測試存取權限。'},401);}
        if(url.searchParams.has('player'))return json({error:'Discord 玩家不能指定其他錢包。'},403);
        const authUrl=new URL('/authorize',url),response=await env.DISCORD_TEST_AUTH.get(env.DISCORD_TEST_AUTH.idFromName('auth')).fetch(new Request(authUrl,{headers:request.headers}));
        if(!response.ok)return response;const principal=await response.json();player=principal.player;name=principal.name;
        internal.set('Authorization','Bearer '+env.PLAYTEST_TOKEN);internal.set('X-Test-Name',encodeURIComponent(name));
      }
      url.searchParams.set('player',player);
      return env.YAKYUKEN_TEST.get(env.YAKYUKEN_TEST.idFromName(player)).fetch(new Request(url,new Request(request,{headers:internal})));
    }
    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__'))return json({error:'找不到此功能。'},404);
    if(!env.ASSETS)return json({error:'找不到此功能。'},404);
    if(!['GET','HEAD'].includes(request.method))return json({error:'請使用 GET。'},405);
    if(url.pathname==='/')url.pathname='/discord-test-shell.html';
    else if(['/slot','/slot/'].includes(url.pathname))url.pathname='/index.html';
    const response=secureResponse(await (url.pathname.startsWith('/assets/')&&url.pathname.endsWith('.mp3')?audioAsset(new Request(url,request),env.ASSETS):env.ASSETS.fetch(new Request(url,request))));
    // Only the independent test shell may embed same-origin game documents.
    if(url.pathname==='/discord-test-shell.html'&&response.headers.has('Content-Security-Policy'))response.headers.set('Content-Security-Policy',response.headers.get('Content-Security-Policy')+"; frame-src 'self'");
    return response;
  },
};
export class YakyukenTestPlayer{
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.queue=Promise.resolve();}
  fetch(request){const run=this.queue.then(()=>this.handle(request));this.queue=run.catch(()=>{});return run;}
  async handle(request){
    try{
      assertPlaytestIdentity(this.env);if(!authorized(request,this.env))return json({error:'需要測試存取權限。'},401);
      const url=new URL(request.url),player=url.searchParams.get('player'),path=url.pathname,action=path.split('/').at(-1);
      if(!validTestPlayer(player))return json({error:'無效的測試玩家。'},400);
      if(this.player&&this.player!==player)throw new Error('Player identity mismatch');this.player=player;
      if(!this.service){
        const credentials=JSON.parse(this.env.GOOGLE_SERVICE_ACCOUNT_JSON||'null');
        if(credentials?.type!=='service_account'||credentials.project_id!==PLAYTEST_IDENTITY.projectId)throw new Error('Test credentials mismatch');
        const db=new FirestoreRest({projectId:this.env.FIRESTORE_PROJECT_ID,namespace:this.env.FIRESTORE_NAMESPACE,credentials,endpoint:this.env.FIRESTORE_ENDPOINT,fetchImpl:cloudFetch});
        const repository=testWalletRepository(db,player,{ledger:this.env.DISCORD_TEST_COMMANDS_ENABLED==='true'&&player.startsWith('d_760012177326997544_')});
        this.service=new PlaytestService({repository,storage:this.ctx.storage,player});
      }
      if(path.startsWith('/__admin/')){
        if(this.env.DISCORD_TEST_COMMANDS_ENABLED!=='true'||!player.startsWith('d_760012177326997544_')||request.method!=='POST')return json({error:'管理入口未開放。'},403);
        const body=await request.json();
        if(['freeze','release'].includes(action)){
          if(typeof body.lease!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.lease))return json({error:'無效的重設鎖。'},400);
          const lease=await this.ctx.storage.get('admin-freeze');if(lease&&lease!==body.lease)return json({error:'另一筆重設進行中。'},409);
          if(action==='freeze'){await this.service.recover();await this.ctx.storage.put('admin-freeze',body.lease);}
          else{this.service.state=null;await this.ctx.storage.delete('admin-freeze');}
          return json({ok:true});
        }
        if(await this.ctx.storage.get('admin-freeze'))return json({error:'測試錢包重設中。'},503);
        if(!['grant','reverse'].includes(action))return json({error:'管理操作不存在。'},404);
        return json(await this.service.execute(action,body));
      }
      if(await this.ctx.storage.get('admin-freeze'))return json({error:'測試錢包重設中，請稍後。'},503);
      const decorate=data=>{
        const name=request.headers.get('X-Test-Name');
        if(!name||!data.wallet)return data;
        const wallet=testCGUnlocks(data.wallet,player,this.env.DISCORD_TEST_CG_PREVIEW_USER_ID);
        return {...data,wallet:{...wallet,name:decodeURIComponent(name)}};
      };
      if((action==='state'||path==='/api/wallet')&&request.method==='GET'){
        const data=decorate(await this.service.stateView());return json(path==='/api/wallet'?{state:slotTestState(data.wallet)}:data);
      }
      if(['/api/rounds','/api/ledger'].includes(path)&&request.method==='GET'){
        const {wallet}=await this.service.stateView();return json(path==='/api/rounds'?{rows:(wallet.slotHistory||[]).map((round,i)=>({round,sequence:wallet.slotHistory.length-i})),next:0}:{entries:[]});
      }
      if(!['begin','hand','leave','checkin','spin'].includes(action)||request.method!=='POST')return json({error:'不支援的測試請求。'},405);
      const text=await request.text();if(text.length>4096)return json({error:'測試請求過大。'},413);
      let body;try{body=JSON.parse(text);}catch{return json({error:'無效的測試請求。'},400);}
      if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'無效的測試請求。'},400);
      if(path==='/api/checkin'&&!body.requestId)body.requestId='slot-daily-'+new Date(Date.now()+8*3600000).toISOString().slice(0,10);
      const data=decorate(await this.service.execute(action,body));
      if(path==='/api/checkin')return json(slotTestCheckinResult(data));
      return json(path==='/api/spin'?{state:slotTestState(data.wallet),round:data.round}:data);
    }catch(error){if(!error.status)console.error('Playtest operation unavailable:',error.message);return json({error:error.status?error.message:'測試雲端暫時無法完成請求，請保留原操作重試。',...(error.code?{code:error.code}:{}),...(error.retryAfterMs?{retryAfterMs:error.retryAfterMs}:{})},error.status||503);}
  }
}
