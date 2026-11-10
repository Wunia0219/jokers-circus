import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createActivityServer} from '../../server/http/app.js';
import {createRound, freshState} from '../../src/game/index.js';
import {launchBrowser} from './helpers/browser.js';

const out='test-results/game-entry';
await mkdir(out,{recursive:true});
const server=createActivityServer({distDir:resolve(process.argv[2]||'dist')});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
const origin=`http://127.0.0.1:${server.address().port}`;
const guildId='223456789012345678', ownerId='323456789012345678', playerId='423456789012345678';
const entryPath='/game-entry.json';
let browser;

async function scenario({id, mode='maintenance', mobile=false, holdSpin=false, lostResponse=false}) {
  const viewport=mobile?{width:390,height:844}:{width:1280,height:800};
  const context=await browser.newContext({viewport,isMobile:mobile,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[], requests={token:0,wallet:0,spin:0};
  page.on('pageerror',error=>errors.push(error.message));
  const state=freshState();
  let releaseSpin, spinSent;
  const sent=new Promise(done=>{spinSent=done;});
  const hold=holdSpin?new Promise(done=>{releaseSpin=done;}):null;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/qa-parent')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'});
    if(url.pathname===entryPath)return route.fulfill({json:{mode,previewUserIds:[ownerId]},headers:{'Cache-Control':'no-store'}});
    if(url.pathname==='/api/token'){
      requests.token++;
      return route.fulfill({json:{access_token:'qa-token',session:{token:'qa-session',guildId,userId:id}}});
    }
    if(url.pathname==='/api/wallet'){
      requests.wallet++;
      return route.fulfill({json:{state}});
    }
    if(url.pathname==='/api/spin'){
      requests.spin++;
      const {bet,requestId}=route.request().postDataJSON();
      spinSent();
      await hold;
      if(lostResponse)return route.abort();
      const update=createRound(state,bet,[0,1,2,3,4],requestId);
      return route.fulfill({json:update});
    }
    return route.continue();
  });
  if(!id){await page.goto(origin);return {page,view:page,context,requests,errors};}
  await page.goto(origin+'/qa-parent');
  await page.evaluate(({id,guildId,mobile})=>{
    const frame=document.createElement('iframe');
    frame.style.cssText='display:block;width:100vw;height:100vh;border:0';
    addEventListener('message',event=>{
      if(event.source!==frame.contentWindow||event.origin!==location.origin||!Array.isArray(event.data))return;
      const [opcode,payload]=event.data;
      const reply=value=>event.source.postMessage([1,value],location.origin);
      if(opcode===0)return reply({cmd:'DISPATCH',evt:'READY',nonce:null,data:{v:1,config:{api_endpoint:'//discord.com/api',environment:'test'}}});
      if(opcode!==1)return;
      const auth={access_token:'qa-token',user:{id,username:'preview-tester',discriminator:'0',public_flags:0,global_name:'測試玩家',avatar:null},scopes:['identify','guilds.members.read'],expires:'2099-01-01T00:00:00Z',application:{id:'123456789012345678',name:'test',description:''}};
      const data=payload.cmd==='AUTHORIZE'?{code:'qa-code'}:payload.cmd==='AUTHENTICATE'?auth:null;
      reply({cmd:payload.cmd,evt:null,nonce:payload.nonce,data});
    });
    frame.src=`/?frame_id=qa-frame&instance_id=qa-instance&platform=${mobile?'mobile':'desktop'}&guild_id=${guildId}`;
    document.body.append(frame);
  },{id,guildId,mobile});
  const view=await (await page.waitForSelector('iframe')).contentFrame();
  return {page,view,context,requests,errors,sent,releaseSpin,setMode:value=>{mode=value;}};
}

async function maintenance({view}){
  await view.getByRole('heading',{name:'維修中'}).waitFor();
  await view.waitForFunction(()=>document.querySelector('.maintenance-notice img')?.naturalWidth===640);
  assert.equal(await view.locator('#app').isVisible(),false);
  assert.equal(await view.locator('#app').evaluate(app=>app.inert),true);
}

try{
  browser=await launchBrowser();
  const guest=await scenario({mobile:true});
  await maintenance(guest);
  assert.deepEqual(guest.requests,{token:0,wallet:0,spin:0});
  assert.equal(await guest.view.locator('#canvas-host canvas').count(),0);
  await guest.page.screenshot({path:out+'/mobile.png',animations:'disabled'});
  assert.deepEqual(guest.errors,[]);
  await guest.context.close();

  const player=await scenario({id:playerId});
  await maintenance(player);
  assert.deepEqual(player.requests,{token:1,wallet:0,spin:0});
  assert.equal(await player.view.locator('#canvas-host canvas').count(),0);
  await player.page.screenshot({path:out+'/desktop.png',animations:'disabled'});
  player.setMode('open');
  await player.view.getByRole('button',{name:'重新檢查'}).click();
  await player.view.waitForFunction(()=>document.querySelector('#spin')?.disabled===false);
  assert.equal(player.requests.wallet,1);
  assert.deepEqual(player.errors,[]);
  await player.context.close();

  const preview=await scenario({id:ownerId});
  await preview.view.waitForFunction(()=>document.querySelector('#spin')?.disabled===false);
  assert.deepEqual(preview.requests,{token:1,wallet:1,spin:0});
  assert.deepEqual(preview.errors,[]);
  await preview.context.close();

  for(const lostResponse of [false,true]){
    const active=await scenario({id:playerId,mode:'open',holdSpin:true,lostResponse});
    await active.view.waitForFunction(()=>document.querySelector('#spin')?.disabled===false);
    await active.view.locator('#auto-spin').click();
    await active.sent;
    const pendingKey=`kemet-pending:${guildId}:${playerId}`;
    const pending=await active.view.evaluate(key=>sessionStorage.getItem(key),pendingKey);
    assert.ok(JSON.parse(pending).requestId);
    active.setMode('maintenance');
    await active.view.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await active.view.waitForFunction(()=>document.querySelector('#auto-spin')?.disabled===true);
    assert.equal(await active.view.locator('.maintenance-screen').count(),0);
    assert.equal(await active.view.locator('#spin').isEnabled(),true,'quick stop remains available while the round is pending');
    await active.view.locator('#spin').click();
    active.releaseSpin();
    await maintenance(active);
    assert.equal(active.requests.spin,1);
    assert.equal(await active.view.evaluate(key=>sessionStorage.getItem(key),pendingKey),lostResponse?pending:null);
    assert.equal(await active.view.getByText('上一局的結果仍待確認。',{exact:false}).count(),Number(lostResponse));
    assert.deepEqual(active.errors,[]);
    await active.context.close();
  }
  console.log('Verified guest and Discord player maintenance, owner preview, reopening, and preserved request identity after a lost response.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
