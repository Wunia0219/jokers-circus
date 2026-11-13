import {arcadeEnabled,readArcade} from './arcade-controls.js';
import {audioAsset} from './audio-asset.js';

export const ARCADE_STATUS='/api/arcade';
const featurePrefix='/arcade/feature/';
const lobbyPath='/arcade/lobby.html';
const towelDownload=featurePrefix+'youran-finale.png';
export const arcadeLobby=(url,env)=>arcadeEnabled(env)&&(url.pathname===lobbyPath||
  url.pathname==='/'&&(url.searchParams.has('frame_id')||url.hostname===`${env.DISCORD_CLIENT_ID}.discordsays.com`));

export function arcadeStatus(state){
  const {slot,feature,featureMaintenance,revision}=readArcade(state);
  return {slot,revision,...(feature==='hidden'?{}:{feature:{mode:featureMaintenance,title:'野球拳',
    image:'/arcade/feature/cover.webp',path:'/arcade/feature/play.html'}})};
}

export async function arcadeAsset(request,env,project){
  const url=new URL(request.url),path=url.pathname;
  // All static asset requests run through the Worker for a dual-game build.
  // Reject alternate encodings before the asset service can normalize them.
  if(path.includes('%')||path.includes('//')||path.includes('\\'))return new Response(null,{status:404});
  if(!arcadeEnabled(env))return path.startsWith('/arcade/')?new Response(null,{status:404}):null;
  // Older slot tabs still consult this file. They must stay able to replay a
  // pending round; the settlement gate now controls whether a new bet starts.
  if(path==='/game-entry.json')return new Response(request.method==='HEAD'?null:JSON.stringify({mode:'open',previewUserIds:[]}),
    {headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(path.startsWith(featurePrefix)){
    if(path===towelDownload&&env.APP_ENV!=='test')return new Response(null,{status:404});
    const status=await project().fetch(new Request(new URL(ARCADE_STATUS,url)));
    if(!status.ok)return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});
    if(!(await status.json()).feature)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
    const asset=await (path.endsWith('.mp3')?audioAsset(request,env.ASSETS):env.ASSETS.fetch(request));
    const response=new Response(asset.body,asset);
    if(path===towelDownload&&asset.ok)response.headers.set('Content-Disposition','attachment; filename="Jokers-Circus-Yakyuken-Youran-finale.png"');
    response.headers.set('Cache-Control',asset.ok&&/^\/arcade\/feature\/assets\/[\w.-]+-[\w-]{8}\.[a-z0-9]+$/.test(path)?
      'private, max-age=31536000, immutable':'no-store');
    return response;
  }
  const entry=path==='/'?(arcadeLobby(url,env)?lobbyPath:'/index.html'):
    path==='/arcade/slot'?'/index.html':['/privacy','/terms'].includes(path)?path+'.html':null;
  if(!entry)return null;
  url.pathname=entry;url.search='';
  const asset=await env.ASSETS.fetch(new Request(url,request));
  const response=new Response(asset.body,asset);
  response.headers.set('Cache-Control','no-store');
  return response;
}
