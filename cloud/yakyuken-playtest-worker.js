import {timingSafeEqual} from 'node:crypto';
import {FirestoreRest} from './firestore-rest.js';
import {cloudFetch} from './fetch.js';
import {assertPlaytestIdentity,PlaytestService,PLAYTEST_IDENTITY,PLAYTEST_PLAYERS} from './yakyuken-playtest-core.js';

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
    if(!authorized(request,env))return json({error:'需要測試存取權限。'},401);
    const player=url.searchParams.get('player');
    if(!Object.hasOwn(PLAYTEST_PLAYERS,player))return json({error:'無效的測試玩家。'},400);
    if(!/^\/api\/playtest\/(state|begin|hand|leave|checkin)$/.test(url.pathname))return json({error:'找不到此功能。'},404);
    return env.YAKYUKEN_TEST.get(env.YAKYUKEN_TEST.idFromName(player)).fetch(request);
  },
};
export class YakyukenTestPlayer{
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.queue=Promise.resolve();}
  fetch(request){const run=this.queue.then(()=>this.handle(request));this.queue=run.catch(()=>{});return run;}
  async handle(request){
    try{
      assertPlaytestIdentity(this.env);if(!authorized(request,this.env))return json({error:'需要測試存取權限。'},401);
      const url=new URL(request.url),player=url.searchParams.get('player'),action=url.pathname.split('/').at(-1);
      if(!Object.hasOwn(PLAYTEST_PLAYERS,player))return json({error:'無效的測試玩家。'},400);
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
      if(action==='state'&&request.method==='GET')return json(await this.service.stateView());
      if(!['begin','hand','leave','checkin'].includes(action)||request.method!=='POST')return json({error:'不支援的測試請求。'},405);
      const text=await request.text();if(text.length>4096)return json({error:'測試請求過大。'},413);
      let body;try{body=JSON.parse(text);}catch{return json({error:'無效的測試請求。'},400);}
      return json(await this.service.execute(action,body));
    }catch(error){if(!error.status)console.error('Playtest operation unavailable:',error.message);return json({error:error.status?error.message:'測試雲端暫時無法完成請求，請保留原操作重試。'},error.status||503);}
  }
}
