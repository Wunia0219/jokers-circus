import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {buildArcadeRelease} from '../build/arcade-release.js';
import {TEST_DISCORD_APP} from '../build/production-boundary.js';
import {arcadeAsset,arcadeLobby,arcadeStatus} from '../../cloud/arcade-routes.js';
import {secureResponse} from '../../server/http/security-headers.js';
import {WalletStore} from '../../server/wallet/wallet.js';
import {duelView} from '../../server/wallet/duel-settlement.js';
import {launchBrowser} from './helpers/browser.js';

const output=resolve('test-results/arcade-release'),dist=resolve(output,'dist');
const clientId=TEST_DISCORD_APP,guild='100000000000000001',user='100000000000000002';
const session={token:'isolated-session',guildId:guild,userId:user,environment:'test'};
const env={DISCORD_CLIENT_ID:clientId,ARCADE_RELEASE_ENABLED:'false'};
let mode={slot:'open',feature:'hidden',revision:0};
const state={get:()=>mode};
const watchers=new Set();
function setMode(changes){
  mode={...mode,...changes,revision:mode.revision+1};
  for(const send of watchers)send(Response.json(arcadeStatus(state)));
}
const project=()=>({fetch:()=>Response.json(arcadeStatus(state))});
const port=4206,origin='http://127.0.0.1:'+port;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp',
  '.json':'application/json','.mp3':'audio/mpeg','.wav':'audio/wav'};
env.ASSETS={fetch(request){
  const {pathname}=new URL(request.url),filename=resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(dist+(process.platform==='win32'?'\\':'/')))return new Response(null,{status:404});
  try{return new Response(request.method==='HEAD'?null:readFileSync(filename),{headers:{'Content-Type':types[extname(filename)]??'application/octet-stream'}});}
  catch{return new Response(null,{status:404});}
}};

const host=(platform)=>`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style>
  <iframe title="Discord 活動" sandbox="allow-pointer-lock allow-scripts allow-same-origin allow-forms"></iframe>
  <script>
    const frame=document.querySelector('iframe');window.handshakes=0;
    window.addEventListener('message',event=>{
      if(event.source!==frame.contentWindow||!Array.isArray(event.data))return;
      const [opcode,payload]=event.data;
      const reply=frameData=>event.source.postMessage([1,frameData],location.origin);
      if(opcode===0){
        window.handshakes++;
        return reply({cmd:'DISPATCH',evt:'READY',nonce:null,data:{v:1,config:{api_endpoint:'//discord.com/api',environment:'test'}}});
      }
      if(opcode!==1)return;
      let data=null;
      if(payload.cmd==='AUTHORIZE')data={code:'fixture-code'};
      if(payload.cmd==='AUTHENTICATE')data={access_token:'fixture-token',user:{id:'${user}',username:'fixture',discriminator:'0',public_flags:0},
        scopes:['identify','guilds.members.read'],expires:'2099-01-01T00:00:00Z',application:{id:'${clientId}',name:'fixture',description:''}};
      reply({cmd:payload.cmd,evt:null,nonce:payload.nonce,data});
    });
    frame.src='/?frame_id=fixture&instance_id=fixture-instance&platform=${platform}&guild_id=${guild}&discord_shim=1';
  </script>`;

const legacy=resolve(output,'legacy'),oldAsset='/assets/legacy-fixture-12345678.js';
const oldLobby='/arcade/assets/legacy-lobby-12345678.js',oldFeature='/arcade/feature/assets/legacy-game-12345678.js';
for(const [path,content] of [[oldAsset,'slot'],[oldLobby,'lobby'],[oldFeature,'game']]){
  const filename=resolve(legacy,'.'+path);
  mkdirSync(dirname(filename),{recursive:true});
  writeFileSync(filename,`/* retained old ${content} bundle */`);
}
await buildArcadeRelease({clientId,target:'test',outDir:dist,legacy,logLevel:'warn'});
const wallet=new WalletStore({filename:':memory:',environment:'test',guildIds:[guild]});
const spinAccepted=Promise.withResolvers(),releaseSpin=Promise.withResolvers();
const secondSpinAccepted=Promise.withResolvers(),releaseSecondSpin=Promise.withResolvers();
const featureStateRequested=Promise.withResolvers(),releaseFeatureState=Promise.withResolvers();
let spins=0,featureRequests=0;
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,origin);
  let response;
  try{
    if(url.pathname==='/__host')response=new Response(host(url.searchParams.get('platform')==='mobile'?'mobile':'desktop'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
    else if(url.pathname==='/game-entry.json'&&env.ARCADE_RELEASE_ENABLED==='false')response=Response.json({mode:'open',previewUserIds:[]});
    else if(url.pathname==='/api/token')response=Response.json({access_token:'fixture-token',session});
    else if(url.pathname==='/api/arcade'){
      response=url.searchParams.get('after')!==String(mode.revision)?Response.json(arcadeStatus(state)):
        await new Promise(resolve=>{
          const end=()=>send(new Response(null,{status:204}));
          const send=value=>{clearTimeout(timer);watchers.delete(send);res.off('close',end);resolve(value);};
          const timer=setTimeout(end,12000);
          watchers.add(send);res.once('close',end);
        });
    }
    else if(url.pathname.startsWith('/api/')){
      if(req.headers.authorization!=='Bearer '+session.token)response=Response.json({error:'Login required'},{status:401});
      else if(url.pathname==='/api/wallet')response=Response.json({state:wallet.state(guild,user)});
      else if(url.pathname==='/api/spin'){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const {bet,requestId}=JSON.parse(Buffer.concat(chunks).toString());
        const result=wallet.spin(guild,user,bet,requestId);spins++;
        if(spins===1){spinAccepted.resolve(result);await releaseSpin.promise;}
        if(spins===2){secondSpinAccepted.resolve(result);await releaseSecondSpin.promise;}
        response=Response.json(result);
      }else if(url.pathname==='/api/feature/state'&&mode.feature!=='hidden'){
        featureStateRequested.resolve();await releaseFeatureState.promise;
        const account=wallet.state(guild,user);
        response=Response.json({...duelView({guild,user,balance:account.balance,revision:account.revision},account,'test'),
          admissionOpen:mode.featureMaintenance!=='maintenance'});
      }else response=Response.json({error:'Unknown fixture route'},{status:404});
    }else{
      const request=new Request(url,{method:req.method,headers:req.headers});
      if(url.pathname.startsWith('/arcade/feature/'))featureRequests++;
      response=secureResponse(await arcadeAsset(request,env,project)??await env.ASSETS.fetch(request),{sameOriginFrame:arcadeLobby(url,env)});
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
let browser;
const inspect=async(page,platform)=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/__host?platform='+platform);
  return page.frameLocator('iframe[title="Discord 活動"]');
};
try{
  browser=await launchBrowser();
  const old=await browser.newPage({viewport:{width:1280,height:800}}),oldGame=await inspect(old,'desktop');
  await oldGame.locator('#spin:enabled').waitFor({timeout:45000});
  await oldGame.locator('#spin').click();
  const original=await spinAccepted.promise;
  assert.match(await oldGame.locator('#game-status').innerText(),/轉動中/);
  env.ARCADE_RELEASE_ENABLED='true';
  releaseSpin.resolve();
  await oldGame.locator('#spin:enabled').waitFor({timeout:30000});
  assert.equal(spins,1);
  assert.equal(wallet.state(guild,user).history[0].id,original.round.id);
  assert.match(await (await old.request.get(origin+oldAsset)).text(),/retained old slot bundle/);
  assert.match(await (await old.request.get(origin+oldLobby)).text(),/retained old lobby bundle/);

  const desktop=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const desktopLobby=await inspect(desktop,'desktop');
  await desktopLobby.locator('#launch-screen').waitFor({state:'detached'});
  const desktopCard=desktopLobby.getByRole('button',{name:'選擇老虎機',exact:true});
  await desktopCard.waitFor();
  assert.equal(await desktopLobby.getByRole('button',{name:'進入遊戲',exact:true}).count(),0);
  await desktop.screenshot({path:resolve(output,'lobby-desktop.png')});
  await desktopCard.click();
  await desktopLobby.frameLocator('#arcade-game').locator('#spin:enabled').waitFor({timeout:45000});
  await desktop.close();

  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const requests=[];
  page.on('request',request=>requests.push(request.url()));
  page.on('pageerror',error=>console.error(error));
  page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
  const lobby=await inspect(page,'mobile');
  const slotCard=lobby.getByRole('button',{name:'選擇老虎機',exact:true});
  const featureCard=lobby.getByRole('button',{name:'選擇野球拳',exact:true});
  await lobby.locator('#launch-screen').waitFor({state:'detached'});
  await slotCard.waitFor({timeout:30000});
  assert.equal(await lobby.locator('#feature-status').textContent(),'即將揭曉');
  assert.equal(await featureCard.count(),0);
  assert.equal(await lobby.getByRole('button',{name:'進入遊戲',exact:true}).count(),0);
  assert.equal(featureRequests,0);
  assert.ok(!requests.some(url=>/feature\/|yakyuken|cg-download/i.test(url)));
  for(const path of ['/arcade/feature/play.html','/arcade/%66eature/cover.webp','/arcade/feature/cover.webp',oldFeature])
    assert.equal((await page.request.get(origin+path)).status(),404,path);
  const checkLayout=()=>slotCard.evaluate(node=>{
    const bounds=node.getBoundingClientRect();
    return bounds.left>=0&&bounds.right<=innerWidth&&bounds.height>=44;
  });
  assert.ok(await checkLayout());
  await page.screenshot({path:resolve(output,'lobby-mobile.png')});
  await page.setViewportSize({width:844,height:390});
  assert.ok(await checkLayout());
  await page.setViewportSize({width:390,height:844});
  await slotCard.tap();
  const game=lobby.frameLocator('#arcade-game');
  await game.locator('#spin:enabled').waitFor({timeout:45000});
  await game.getByRole('button',{name:'返回遊戲大廳',exact:true}).tap();
  await slotCard.waitFor();
  setMode({feature:'open'});
  await lobby.locator('body').evaluate(()=>dispatchEvent(new Event('focus')));
  await featureCard.waitFor();
  assert.equal(await lobby.locator('#feature-status').textContent(),'野球拳');
  assert.match(await (await page.request.get(origin+oldFeature)).text(),/retained old game bundle/);
  await featureCard.tap();
  await featureStateRequested.promise;
  await lobby.getByRole('progressbar',{name:'遊戲載入進度',exact:true}).waitFor();
  assert.equal(await game.getByText('正在準備野球拳…',{exact:true}).count(),0);
  assert.equal(await game.locator('#yakyuken-app').textContent(),'');
  releaseFeatureState.resolve();
  await game.locator('canvas[data-phase="characters"]').waitFor({timeout:45000});
  await lobby.getByRole('progressbar',{name:'遊戲載入進度',exact:true}).waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.handshakes),1,'child game shares the original Discord connection');
  const notice=lobby.getByRole('heading',{name:'維護中',exact:true});
  const back=lobby.getByRole('button',{name:'返回大廳',exact:true});
  setMode({featureMaintenance:'maintenance'});
  await notice.waitFor({timeout:5000});
  assert.equal(await lobby.locator('#arcade-game').getAttribute('src'),null);
  await back.tap();
  await slotCard.waitFor();
  assert.equal(await lobby.locator('#feature-status').textContent(),'維護中');
  assert.equal(await featureCard.count(),0);
  await slotCard.tap();
  await game.locator('#spin:enabled').waitFor({timeout:45000});
  await game.locator('#spin').tap();
  const interrupted=await secondSpinAccepted.promise;
  setMode({slot:'maintenance'});
  await notice.waitFor({timeout:5000});
  assert.equal(await lobby.locator('#arcade-game').getAttribute('src'),null);
  await back.tap();
  assert.equal(await slotCard.count(),0);
  releaseSecondSpin.resolve();
  setMode({slot:'open'});
  await lobby.locator('body').evaluate(()=>dispatchEvent(new Event('focus')));
  await slotCard.tap();
  await game.locator('#spin:enabled').waitFor({timeout:45000});
  const retryResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/spin');
  await game.getByRole('button',{name:'旋轉一次',exact:true}).tap();
  assert.equal((await (await retryResponse).json()).round.id,interrupted.round.id);
  await game.getByRole('button',{name:'旋轉一次',exact:true}).waitFor({timeout:45000});
  assert.equal(spins,3);
  assert.equal(wallet.state(guild,user).history.length,2);
  assert.equal(wallet.state(guild,user).history[0].id,interrupted.round.id);
  mkdirSync(output,{recursive:true});
  writeFileSync(resolve(output,'report.json'),JSON.stringify({ok:true,oldSpinSurvived:true,hiddenAssetGate:true,
    retainedLegacyAssets:true,mobileReveal:true,portraitAndLandscape:true,sharedDiscordConnection:true,
    singleEntryLoader:true,liveMaintenance:true,interruptedSpinRecovered:true},null,2)+'\n');
  console.log('Arcade rollout, branded loading, live maintenance and original spin recovery verified.');
}finally{
  releaseSpin.resolve();
  releaseSecondSpin.resolve();
  releaseFeatureState.resolve();
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  wallet.close();
}
