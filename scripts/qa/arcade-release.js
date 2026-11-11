import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {buildArcadeRelease} from '../build/arcade-release.js';
import {arcadeAsset,arcadeLobby,arcadeStatus} from '../../cloud/arcade-routes.js';
import {secureResponse} from '../../server/http/security-headers.js';
import {WalletStore} from '../../server/wallet/wallet.js';
import {duelView} from '../../server/wallet/duel-settlement.js';
import {launchBrowser} from './helpers/browser.js';

const output=resolve('test-results/arcade-release'),dist=resolve(output,'dist');
const clientId='100000000000000003',guild='100000000000000001',user='100000000000000002';
const session={token:'isolated-session',guildId:guild,userId:user,environment:'test'};
const env={DISCORD_CLIENT_ID:clientId,ARCADE_RELEASE_ENABLED:'false'};
let mode={slot:'open',feature:'hidden',revision:0};
const state={get:()=>mode};
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
mkdirSync(resolve(legacy,'assets'),{recursive:true});
writeFileSync(resolve(legacy,'.'+oldAsset),'/* retained old slot bundle */');
await buildArcadeRelease({clientId,outDir:dist,legacy,logLevel:'warn'});
const wallet=new WalletStore({filename:':memory:',environment:'test',guildIds:[guild]});
const spinAccepted=Promise.withResolvers(),releaseSpin=Promise.withResolvers();
let spins=0,featureRequests=0;
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,origin);
  let response;
  try{
    if(url.pathname==='/__host')response=new Response(host(url.searchParams.get('platform')==='mobile'?'mobile':'desktop'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
    else if(url.pathname==='/game-entry.json'&&env.ARCADE_RELEASE_ENABLED==='false')response=Response.json({mode:'open',previewUserIds:[]});
    else if(url.pathname==='/api/token')response=Response.json({access_token:'fixture-token',session});
    else if(url.pathname==='/api/arcade')response=Response.json(arcadeStatus(state));
    else if(url.pathname.startsWith('/api/')){
      if(req.headers.authorization!=='Bearer '+session.token)response=Response.json({error:'Login required'},{status:401});
      else if(url.pathname==='/api/wallet')response=Response.json({state:wallet.state(guild,user)});
      else if(url.pathname==='/api/spin'){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const {bet,requestId}=JSON.parse(Buffer.concat(chunks).toString());
        const result=wallet.spin(guild,user,bet,requestId);spins++;
        spinAccepted.resolve(result);await releaseSpin.promise;
        response=Response.json(result);
      }else if(url.pathname==='/api/feature/state'&&mode.feature!=='hidden'){
        const account=wallet.state(guild,user);
        response=Response.json({...duelView({guild,user,balance:account.balance,revision:account.revision},account,'test'),
          admissionOpen:mode.feature==='open'});
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

  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const requests=[];
  page.on('request',request=>requests.push(request.url()));
  const lobby=await inspect(page,'mobile');
  await lobby.locator('#slot:enabled').waitFor({timeout:30000});
  assert.equal(await lobby.locator('#feature-title').innerText(),'即將揭曉');
  assert.equal(await lobby.locator('#feature').isVisible(),false);
  assert.equal(featureRequests,0);
  assert.ok(!requests.some(url=>/feature\/|yakyuken|cg-download/i.test(url)));
  for(const path of ['/arcade/feature/play.html','/arcade/%66eature/cover.webp','/arcade/feature/cover.webp'])
    assert.equal((await page.request.get(origin+path)).status(),404,path);
  const checkLayout=()=>lobby.locator('.cards').evaluate(node=>{
    const bounds=node.getBoundingClientRect();
    return bounds.left>=0&&bounds.right<=innerWidth&&[...node.querySelectorAll('button:not([hidden])')].every(button=>button.getBoundingClientRect().height>=44);
  });
  assert.equal(await checkLayout(),true);
  await page.setViewportSize({width:844,height:390});
  assert.equal(await checkLayout(),true);
  await page.setViewportSize({width:390,height:844});
  await lobby.locator('#slot').tap();
  const game=lobby.frameLocator('#arcade-game');
  await game.locator('#spin:enabled').waitFor({timeout:45000});
  await game.getByRole('button',{name:'返回遊戲大廳',exact:true}).tap();
  await lobby.locator('#slot:enabled').waitFor();
  mode={...mode,feature:'open',revision:1};
  await lobby.locator('body').evaluate(()=>dispatchEvent(new Event('focus')));
  await lobby.locator('.card.revealed #feature:enabled').waitFor();
  assert.equal(await lobby.locator('#feature-title').innerText(),'野球拳');
  await lobby.locator('#feature').tap();
  await game.locator('canvas[data-phase="characters"]').waitFor({timeout:45000});
  assert.equal(await page.evaluate(()=>window.handshakes),1,'child game shares the original Discord connection');
  await game.getByRole('button',{name:'返回遊戲大廳',exact:true}).tap();
  await lobby.locator('#feature:enabled').waitFor();
  mode={...mode,feature:'paused',slot:'maintenance',revision:2};
  await lobby.locator('body').evaluate(()=>dispatchEvent(new Event('focus')));
  await lobby.getByRole('button',{name:'暫停開放 · 續局／紀錄',exact:true}).waitFor();
  assert.equal(await lobby.locator('#slot').isDisabled(),true);
  await lobby.locator('#feature').tap();
  await game.locator('canvas[data-phase="characters"]').waitFor({timeout:45000});
  assert.match(await game.locator('canvas').getAttribute('aria-label'),/暫停新場次/);
  assert.equal(await game.getByRole('button',{name:'進入野球拳',exact:true}).count(),0);
  assert.equal(spins,1);
  mkdirSync(output,{recursive:true});
  writeFileSync(resolve(output,'report.json'),JSON.stringify({ok:true,oldSpinSurvived:true,hiddenAssetGate:true,
    mobileReveal:true,portraitAndLandscape:true,sharedDiscordConnection:true,independentPause:true},null,2)+'\n');
  console.log('Arcade rollout, hidden assets, same-session reveal and pause verified.');
}finally{
  releaseSpin.resolve();
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  wallet.close();
}
