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

async function scenario({id, mode='maintenance', mobile=false, holdSpin=false, lostResponse=false, live=false}) {
  const viewport=mobile?{width:390,height:844}:{width:1280,height:800};
  const context=await browser.newContext({viewport,isMobile:mobile,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[], requests={token:0,wallet:0,spin:0}, spinIds=[];
  page.on('pageerror',error=>errors.push(error.message));
  const state=freshState();
  let releaseSpin, spinSent, revision=0;
  const watchers=new Set(),watching=Promise.withResolvers();
  const entry=()=>({mode,previewUserIds:live?[]:[ownerId],...(live?{revision}:{})});
  const sent=new Promise(done=>{spinSent=done;});
  const hold=holdSpin?new Promise(done=>{releaseSpin=done;}):null;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/qa-parent')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'});
    if(url.pathname===entryPath){
      if(live&&url.searchParams.get('after')===String(revision)){
        await new Promise(resolve=>{watchers.add(resolve);watching.resolve();});
      }
      return route.fulfill({json:entry(),headers:{'Cache-Control':'no-store'}});
    }
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
      spinIds.push(requestId);
      spinSent();
      await hold;
      if(lostResponse&&requests.spin===1)return route.abort();
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
      if(opcode===2){window.activityClose=payload.code;return;}
      if(opcode!==1)return;
      const auth={access_token:'qa-token',user:{id,username:'preview-tester',discriminator:'0',public_flags:0,global_name:'測試玩家',avatar:null},scopes:['identify','guilds.members.read'],expires:'2099-01-01T00:00:00Z',application:{id:'123456789012345678',name:'test',description:''}};
      const data=payload.cmd==='AUTHORIZE'?{code:'qa-code'}:payload.cmd==='AUTHENTICATE'?auth:null;
      reply({cmd:payload.cmd,evt:null,nonce:payload.nonce,data});
    });
    frame.src=`/?frame_id=qa-frame&instance_id=qa-instance&platform=${mobile?'mobile':'desktop'}&guild_id=${guildId}`;
    document.body.append(frame);
  },{id,guildId,mobile});
  const view=await (await page.waitForSelector('iframe')).contentFrame();
  return {page,view,context,requests,errors,sent,releaseSpin,spinIds,watching:watching.promise,setMode:value=>{
    mode=value;revision++;
    for(const resolve of watchers)resolve();
    watchers.clear();
  }};
}

async function maintenance({view},name='維修中'){
  await view.getByRole('heading',{name,exact:true}).waitFor();
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
    if(lostResponse){
      await active.view.getByRole('heading',{name:'連線不太穩',exact:true}).waitFor();
      assert.equal(await active.view.evaluate(key=>sessionStorage.getItem(key),pendingKey),pending);
      await active.view.evaluate(()=>location.reload());
      await active.view.waitForFunction(()=>document.querySelector('#game-status')?.textContent.startsWith('上一局的結果仍待確認'));
      assert.equal(await active.view.locator('#auto-spin').isEnabled(),false);
      await active.view.locator('#spin').click();
    }
    await maintenance(active);
    assert.equal(active.requests.spin,lostResponse?2:1);
    assert.ok(active.spinIds.every(id=>id===JSON.parse(pending).requestId));
    assert.equal(await active.view.evaluate(key=>sessionStorage.getItem(key),pendingKey),null);
    assert.deepEqual(active.errors,[]);
    await active.context.close();
  }
  const closed=await scenario({id:playerId,live:true});
  await maintenance(closed,'維護中');
  assert.deepEqual(closed.requests,{token:0,wallet:0,spin:0});
  await closed.view.getByRole('button',{name:'返回 Discord',exact:true}).click();
  await closed.page.waitForFunction(()=>window.activityClose===1000);
  assert.deepEqual(closed.requests,{token:0,wallet:0,spin:0});
  await closed.context.close();

  const live=await scenario({id:playerId,mode:'open',live:true,holdSpin:true,lostResponse:true});
  await live.view.getByRole('button',{name:'旋轉一次',exact:true}).click();
  await live.sent;
  await live.watching;
  live.setMode('maintenance');
  await maintenance(live,'維護中');
  await live.view.locator('#canvas-host canvas').waitFor({state:'detached'});
  assert.equal(await live.view.locator('#auto-spin').getAttribute('aria-pressed'),'false');
  assert.equal(live.requests.spin,1);
  live.releaseSpin();
  live.setMode('open');
  await live.view.evaluate(()=>location.reload());
  const recovered=live.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/spin');
  await live.view.getByRole('button',{name:'旋轉一次',exact:true}).click();
  await recovered;
  assert.equal(live.requests.spin,2);
  assert.equal(live.spinIds[0],live.spinIds[1]);
  assert.deepEqual(live.errors,[]);
  live.setMode('maintenance');
  await live.context.close();
  console.log('Verified legacy maintenance and live slot interruption, Discord exit, and original request recovery.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
