import {timingSafeEqual} from 'node:crypto';
import {FirestoreRest} from './firestore-rest.js';
import {cloudFetch} from './fetch.js';
import {assertPlaytestIdentity,PlaytestService,PLAYTEST_IDENTITY,PLAYTEST_PLAYERS,validTestPlayer,slotTestState} from './yakyuken-playtest-core.js';
import {assertDiscordTestApp} from './discord-test-auth.js';
import {secureResponse} from '../server/http/security-headers.js';
import {audioAsset} from './audio-asset.js';
export {DiscordTestAuth} from './discord-test-auth.js';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
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
        const db=new FirestoreRest({projectId:this.env.FIRESTORE_PROJECT_ID,namespace:this.env.FIRESTORE_NAMESPACE,credentials,endpoint:this.env.FIRESTORE_ENDPOINT,fetchImpl:cloudFetch}),ref=db.doc(`circus_wallet_v1/${this.env.FIRESTORE_NAMESPACE}/players/${player}`);
        const decode=snap=>{
          if(!snap.exists)return null;
          if(snap.get('environment')!=='test'||snap.get('namespace')!==PLAYTEST_IDENTITY.namespace)throw new Error('Stored test identity mismatch');
          const state=JSON.parse(snap.get('state'));if(state.player!==player||state.version!==1)throw new Error('Stored player mismatch');return state;
        };
        const repository={read:async()=>decode(await ref.get()),mutate:async(_,change)=>db.runTransaction(async tx=>{
          const current=decode(await tx.get(ref)),state=change(current);if(state!==current)tx.set(ref,{environment:'test',namespace:PLAYTEST_IDENTITY.namespace,state:JSON.stringify(state)});return state;
        })};
        this.service=new PlaytestService({repository,storage:this.ctx.storage,player});
      }
      const decorate=data=>{const name=request.headers.get('X-Test-Name');if(name&&data.wallet)data.wallet.name=decodeURIComponent(name);return data;};
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
      return json(['/api/spin','/api/checkin'].includes(path)?{state:slotTestState(data.wallet),...(data.round?{round:data.round}:{})}:data);
    }catch(error){if(!error.status)console.error('Playtest operation unavailable:',error.message);return json({error:error.status?error.message:'測試雲端暫時無法完成請求，請保留原操作重試。',...(error.code?{code:error.code}:{}),...(error.retryAfterMs?{retryAfterMs:error.retryAfterMs}:{})},error.status||503);}
  }
}
