import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {arcadeEnabled,changeArcade,liveSlotMaintenance,operatorEnabled,readArcade} from './arcade-controls.js';
import {walletSettings} from '../server/wallet/settings.js';
import {problem} from '../server/wallet/wallet-common.js';
import {securityHeaders} from '../server/http/security-headers.js';
import {SnapshotVault} from './snapshot.js';
import {Sealer} from './storage.js';
import page from './operator-page.js';

export const operatorPage='/operator';
export const operatorApi='/__operator/';
export const operatorSignIn=operatorApi+'sign-in';
const rememberName='__Secure-circus-operator-remember';
const rememberSeconds=30*24*3600,sessionSeconds=3600;
const rememberEnabled=env=>liveSlotMaintenance(env)||['production','test'].includes(env.APP_ENV)&&arcadeEnabled(env);
const script=page.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\r\n?/g,'\n');
const scriptHash=createHash('sha256').update(script).digest('base64');
const responseHeaders={...securityHeaders,'Cache-Control':'no-store'};
const json=(value,status=200)=>Response.json(value,{status,headers:responseHeaders});
const operatorPages={
  test:page.replace('__OPERATOR_TITLE__','TEST · ').replace('__OPERATOR_ENV__','test').replace('__OPERATOR_LABEL__','TEST · 測試服'),
  production:page.replace('__OPERATOR_TITLE__','').replace('__OPERATOR_ENV__','production').replace('__OPERATOR_LABEL__','正式服'),
};

export function serveOperator(request,env){
  if(!operatorEnabled(env)||!Object.hasOwn(operatorPages,env.APP_ENV))return json({error:'找不到此頁面。'},404);
  if(!['GET','HEAD'].includes(request.method))return json({error:'不支援此操作。'},405);
  const markup=operatorPages[env.APP_ENV].replace('__OPERATOR_REMEMBER__',String(rememberEnabled(env)));
  return new Response(request.method==='HEAD'?null:markup,{headers:{
    ...responseHeaders,'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow',
    'Content-Security-Policy':`default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  }});
}

const sameHex=(a,b)=>timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const operatorKey=(request,env)=>{
  const key=request.headers.get('authorization')?.match(/^Bearer ([a-f\d]{64})$/i)?.[1];
  return !!key&&sameHex(key,env.ARCADE_CONSOLE_TOKEN);
};
const signature=(env,request,purpose,value)=>createHmac('sha256',Buffer.from(env.ARCADE_CONSOLE_TOKEN,'hex'))
  .update(['circus-operator',purpose,new URL(request.url).origin,value].join('\0')).digest('hex');
function issueCredential(env,request,purpose,lifetime){
  const value=Math.floor(Date.now()/1000+lifetime)+'.'+randomBytes(16).toString('hex');
  return value+'.'+signature(env,request,purpose,value);
}
function validCredential(env,request,purpose,token){
  const match=token?.match(/^(\d{1,12}\.[a-f\d]{32})\.([a-f\d]{64})$/);
  return !!match&&Number(match[1].split('.')[0])>Math.floor(Date.now()/1000)&&sameHex(match[2],signature(env,request,purpose,match[1]));
}
const rememberCookie=(value,maxAge)=>`${rememberName}=${value}; Max-Age=${maxAge}; Path=${operatorSignIn}; Secure; HttpOnly; SameSite=Strict`;

export function serveOperatorSignIn(request,env){
  if(!rememberEnabled(env)||!operatorEnabled(env))return json({error:'找不到此功能。'},404);
  const origin=new URL(request.url).origin;
  if(request.method!=='GET'&&request.headers.get('origin')!==origin)return json({error:'請從後台頁面操作。'},403);
  const cookie=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(rememberName+'='))?.slice(rememberName.length+1);
  const remembered=validCredential(env,request,'remember',cookie);
  if(request.method==='GET')return json({remembered});
  if(request.method==='DELETE')return Response.json({remembered:false},{headers:{...responseHeaders,'Set-Cookie':rememberCookie('',0)}});
  if(request.method!=='POST')return json({error:'不支援此操作。'},405);
  const supplied=request.headers.has('authorization');
  if(supplied?!operatorKey(request,env):!remembered)return json({error:'管理金鑰有誤或已過期，請重新輸入。'},401);
  const token=issueCredential(env,request,'session',sessionSeconds);
  const headers={...responseHeaders};
  if(supplied)headers['Set-Cookie']=rememberCookie(issueCredential(env,request,'remember',rememberSeconds),rememberSeconds);
  return Response.json({token},{headers});
}

export function authorizeOperator(request,env){
  if(!operatorEnabled(env))return json({error:'找不到此功能。'},404);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'請從後台頁面操作。'},403);
  if(operatorKey(request,env))return null;
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f\d.]+)$/)?.[1];
  if(rememberEnabled(env)&&validCredential(env,request,'session',token))return null;
  return json({error:'管理金鑰有誤，請重新登入。'},401);
}

function status(project){
  const {slot,feature,featureMaintenance,revision,updatedAt}=readArcade(project.state);
  const backup=project.state.get('backup-status');
  const job=project.state.get('backup-job');
  return {
    environment:project.env.APP_ENV,ready:project.ready(),mode:project.state.get('mode')??'unseeded',
    entry:{slot,revision,updatedAt,...(liveSlotMaintenance(project.env)?{liveMaintenance:true}:{}),
      ...(arcadeEnabled(project.env)?{feature,featureMaintenance,featureTitle:'野球拳'}:{})},guilds:walletSettings(project.env,{cloud:true}).guildIds,
    backup:{at:backup?.ok?backup.at:null,running:!!job,retryAt:project.state.get('backup-retry')?.nextAttempt??null},
  };
}

async function input(request){
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
    throw problem(415,'無法讀取操作內容。');
  const reader=request.body?.getReader();
  const parts=[];
  let size=0;
  try{
    if(!reader)throw new Error('Missing body');
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.length;
      if(size>2048){await reader.cancel();throw problem(413,'操作內容過長。');}
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  }catch(error){
    if(error.walletProblem)throw error;
    throw problem(400,'無法讀取操作內容。');
  }finally{reader?.releaseLock();}
}

export async function handleOperator(project,request,path){
  try{
    const action=path.slice(operatorApi.length);
    if(action==='status'&&request.method==='GET')return json(status(project));
    if(!['entry','report','backup','verify-backup'].includes(action))return json({error:'找不到此功能。'},404);
    if(request.method!=='POST')return json({error:'不支援此操作。'},405);
    const data=await input(request);
    if(!data||typeof data!=='object'||Array.isArray(data))throw problem(400,'請重新輸入操作資料。');
    if(action==='entry'){
      if(data.mode==='open'){
        if(!project.ready())throw problem(503,'遊戲服務尚未就緒。請先確認備份及服務狀態。');
        const {store}=await project.runtime();
        store.checkMeta(await store.read(store.meta));
      }
      await changeArcade(project,'web-operator',data.game,data.mode,data.revision,project.instance?.store.settlementQueue);
      return json(status(project));
    }
    if(action==='report'){
      const code=typeof data.code==='string'&&/^([SD])-([-a-zA-Z0-9]{16,80})$/i.exec(data.code.trim());
      if(!code||(!arcadeEnabled(project.env)&&code[1].toUpperCase()==='D')||typeof data.player!=='string'||!/^\d{17,20}$/.test(data.player)||!status(project).guilds.includes(data.guild))
        throw problem(400,'請核對伺服器、玩家 ID 和完整回報碼。');
      const {store}=await project.runtime();
      const game=code[1].toUpperCase()==='S'?'spin':'duel';
      return json({game,...await store.findWager(data.guild,data.player,game,code[2])});
    }
    if(action==='backup'){
      if(project.state.get('mode')!=='active')throw problem(409,'請先確認遊戲服務已啟用，再更新備份。');
      const runtime=await project.runtime();
      let complete=false;
      try{({complete}=await project.backupStep(runtime));}
      finally{if(!complete)await project.schedule(runtime.backup.nextDelay);}
      return json(status(project));
    }
    const generation=project.state.get('backup-latest');
    if(!generation)throw problem(409,'目前沒有可核對的備份。');
    const vault=new SnapshotVault(project.ctx.storage,project.state,new Sealer(project.env.CLOUD_ENCRYPTION_KEY));
    vault.audit(generation);
    return json({verified:true,at:project.state.get('backup-status')?.at??null});
  }catch(error){
    return json({error:error.walletProblem?error.message:'暫時無法完成。請更新狀態後再試。'},error.walletProblem?error.status:503);
  }
}
