import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {build} from 'vite';
import {discordTestBuildOptions} from '../game/discord-test-build.js';
import {createActivityHandler} from '../../server/http/app-handler.js';
import {PlaytestService,discordTestPlayer,slotTestState} from '../../cloud/yakyuken-playtest-core.js';
import {TEST_GUILD,TEST_CHANNEL} from '../../cloud/discord-test-auth.js';
import {launchBrowser} from './helpers/browser.js';

const output='test-results/discord-test-activity',clientId='100000000000000003',port=4203,origin='http://127.0.0.1:'+port;
mkdirSync(output,{recursive:true});const dist=resolve(output,'dist');
await build(discordTestBuildOptions(dist,clientId));
const docs=new Map(),services=new Map(),sessions=new Map(),users={A:'100000000000000111',B:'100000000000000112'};
function service(who){
  if(services.has(who))return services.get(who);const values=new Map(),player=discordTestPlayer(TEST_GUILD,users[who]);
  const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:async fn=>fn(storage)};
  const repository={read:async()=>structuredClone(docs.get(who)),mutate:async(_,fn)=>{const state=fn(structuredClone(docs.get(who)));docs.set(who,structuredClone(state));return state;}};
  const s=new PlaytestService({player,repository,storage,entropy:{getRandomValues:v=>{v[0]=0;}}});services.set(who,s);return s;
}
const staticHandler=createActivityHandler({distDir:dist});
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,origin),json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname==='/__host'){
    const who=url.searchParams.get('who')==='B'?'B':'A',platform=url.searchParams.get('platform')==='mobile'?'mobile':'desktop';
    res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><html><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style><iframe sandbox="allow-pointer-lock allow-scripts allow-same-origin allow-forms"></iframe><script>window.__commands=[];window.__links=[];window.__openAllowed=true;window.addEventListener('message',event=>{if(event.source!==document.querySelector('iframe').contentWindow||!Array.isArray(event.data))return;const [opcode,payload]=event.data;if(opcode===2)return;__commands.push(opcode===0?'HANDSHAKE':payload.cmd);if(opcode===0&&__commands.filter(x=>x==='HANDSHAKE').length>1)return;const reply=frame=>event.source.postMessage([1,frame],location.origin);if(opcode===0)return reply({cmd:'DISPATCH',evt:'READY',nonce:null,data:{v:1,config:{api_endpoint:'//discord.com/api',environment:'test'}}});let data=null;if(payload.cmd==='OPEN_EXTERNAL_LINK'){__links.push(payload.args.url);data={opened:window.__openAllowed};}if(payload.cmd==='AUTHORIZE')data={code:'code-${who}'};if(payload.cmd==='AUTHENTICATE')data={access_token:'fixture-token',user:{id:'${users[who]}',username:'tester-${who}',discriminator:'0',public_flags:0,global_name:'測試者 ${who}',avatar:null},scopes:['identify','guilds.members.read'],expires:'2099-01-01T00:00:00Z',application:{id:'${clientId}',name:'fixture',description:''}};reply({cmd:payload.cmd,evt:null,nonce:payload.nonce,data});});document.querySelector('iframe').src='/?frame_id=fixture-frame&instance_id=fixture-instance&platform=${platform}&guild_id=${TEST_GUILD}&channel_id=${TEST_CHANNEL}&location_id=fixture-location&discord_shim=1&mobile_app_version=300.0';</script>`);return;
  }
  if(url.pathname.startsWith('/api/')){
    try{
      let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
      if(url.pathname==='/api/token'){
        assert.equal(body.guildId,TEST_GUILD);const who=body.code==='code-B'?'B':'A',token=randomBytes(32).toString('base64url');sessions.set(token,who);
        return json(200,{access_token:'fixture-token',session:{token,userId:users[who],guildId:TEST_GUILD,environment:'test',discordTest:true,walletEpoch:'discord-test-v1'}});
      }
      const who=sessions.get(req.headers.authorization?.replace(/^Bearer /,''));if(!who)return json(401,{error:'Login required'});if(url.searchParams.has('player'))return json(403,{error:'No player override'});
      if(url.pathname==='/api/session')return json(200,{guild:TEST_GUILD,user:users[who],player:discordTestPlayer(TEST_GUILD,users[who]),name:'測試者 '+who});
      const s=service(who),action=url.pathname.split('/').at(-1);
      if(['wallet','state'].includes(action)){const data=await s.stateView();data.wallet.name='測試者 '+who;return json(200,action==='wallet'?{state:slotTestState(data.wallet)}:data);}
      if(action==='checkin'&&!body.requestId)body.requestId='slot-daily-'+new Date(Date.now()+8*3600000).toISOString().slice(0,10);
      const data=await s.execute(action,body);data.wallet.name='測試者 '+who;
      return json(200,['/api/spin','/api/checkin'].includes(url.pathname)?{state:slotTestState(data.wallet),...(data.round?{round:data.round}:{})}:data);
    }catch(error){return json(error.status||500,{error:error.message,...(error.code?{code:error.code,retryAfterMs:error.retryAfterMs}:{})});}
  }
  if(url.pathname==='/')req.url='/discord-test-shell.html'+url.search;
  else if(url.pathname==='/slot/')req.url='/index.html'+url.search;
  if(new URL(req.url,origin).pathname==='/discord-test-shell.html'){
    const write=res.writeHead;res.writeHead=function(status,headers){headers['Content-Security-Policy']+="; frame-src 'self'";return write.call(this,status,headers);};
  }
  return staticHandler(req,res);
});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});
let browser;const errors=[],checks=[];
try{
  browser=await launchBrowser();
  for(const mobile of [false,true]){
    const who=mobile?'B':'A',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    let failedAtlasAttempts=0;
    await page.route(/\/assets\/win-018-[^/]+\.webp$/,route=>{failedAtlasAttempts++;return failedAtlasAttempts===1?route.fulfill({status:503,contentType:'text/plain',body:'isolated transient image failure'}):route.continue();});
    const recoveredAtlas=page.waitForResponse(r=>/\/assets\/win-018-[^/]+\.webp$/.test(r.url())&&r.status()===200,{timeout:60000});
    await page.goto(origin+'/__host?who='+who+'&platform='+(mobile?'mobile':'desktop'));
    const element=await page.waitForSelector('iframe'),shell=await element.contentFrame();const game=await shell.waitForSelector('#game:not([hidden])'),frame=await game.contentFrame(),phase=value=>frame.waitForFunction(value=>document.querySelector('canvas')?.dataset.phase===value&&document.querySelector('canvas').dataset.changing!=='true',value);
    await phase('games');assert.ok((await page.evaluate(()=>__commands)).includes('AUTHENTICATE'));
    await frame.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase('characters');
    await frame.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase('selecting');assert.equal(docs.get(who).balance,9000);
    for(let i=0;i<2;i++){
      if(i){await frame.getByRole('button',{name:'下一局',exact:true}).click();await phase('selecting');}
      const hand=frame.getByRole('button',{name:'選擇拳頭',exact:true}),confirm=frame.getByRole('button',{name:'確認出牌',exact:true});
      if(mobile){await hand.tap();await confirm.tap();}else{await hand.click();await confirm.click();}await phase('confirmed');
    }
    assert.equal(docs.get(who).balance,11500);await frame.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame.getByRole('button',{name:'回顧終幕 CG',exact:true}).click();
    await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).click();
    await page.waitForFunction(()=>__links.length===1);const link=await page.evaluate(()=>__links[0]);
    assert.equal(link,'https://jokers-circus-gallery.pages.dev/cg/yakyuken/dealer/finale');
    const downloadPage=await context.newPage();await downloadPage.goto(origin+'/cg-download.html?stage=2');
    const downloadEvent=downloadPage.waitForEvent('download');await downloadPage.getByRole('link',{name:'下載圖片',exact:true}).click();assert.equal((await downloadEvent).suggestedFilename(),'Jokers-Circus-Yakyuken-Dealer-finale.png');await downloadPage.close();
    await frame.getByRole('button',{name:'關閉視窗',exact:true}).click();await page.screenshot({path:output+'/'+who+'-yakyuken.png'});
    await frame.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase('games');
    await frame.getByRole('button',{name:'選擇老虎機',exact:true}).click();await frame.waitForFunction(()=>document.querySelector('#spin')?.disabled===false);
    await recoveredAtlas;assert.equal(failedAtlasAttempts,2,'one transient atlas failure is retried once');assert.equal(new URL(frame.url()).pathname,'/slot/');assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1,'persistent shell retains one live SDK connection across games');for(const [key,value] of Object.entries({discord_shim:'1',location_id:'fixture-location',mobile_app_version:'300.0'}))assert.equal(new URL(frame.url()).searchParams.get(key),value);assert.equal(new URL(frame.url()).searchParams.get('channel_id'),TEST_CHANNEL);assert.equal((await frame.locator('#balance').textContent()).replaceAll(',',''),'11500');
    await frame.locator('#daily-checkin').click();await frame.getByRole('button',{name:/領取.*戲籌/}).click();await frame.waitForFunction(()=>document.querySelector('#balance')?.textContent.replaceAll(',','')==='12000');await frame.locator('#close-dialog').click();
    const settlement=page.waitForResponse(r=>r.url().includes('/api/spin'));await frame.locator('#spin').click();const spin=await (await settlement).json();
    await frame.waitForFunction(()=>document.querySelector('#spin')?.disabled===false&&document.querySelector('#spin').getAttribute('aria-label')!=='快速停止');
    assert.equal(docs.get(who).balance,spin.state.balance);await page.screenshot({path:output+'/'+who+'-slot.png'});
    await frame.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase('games');await frame.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase('characters');
    assert.equal(docs.get(who).balance,spin.state.balance);assert.equal(docs.get(who).checkin.receipt.cycleDay,1);
    await frame.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame.getByRole('button',{name:'回顧終幕 CG',exact:true}).click();
    await page.evaluate(()=>{__openAllowed=false;});await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).click();await page.waitForFunction(()=>__links.length===2);
    await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).waitFor({state:'visible'});await page.evaluate(()=>{__openAllowed=true;});
    await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).click();await page.waitForFunction(()=>__links.length===3);
    assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1);
    await frame.evaluate(()=>location.reload());await phase('games');assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1);
    await page.reload();
    const reloadedShell=await (await page.waitForSelector('iframe')).contentFrame(),reloaded=await (await reloadedShell.waitForSelector('#game:not([hidden])')).contentFrame();await reloaded.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='games');
    checks.push((mobile?'mobile touch':'desktop')+': real SDK handshake/OAuth, scoped identity, Yakyuken reward, sandbox-safe CG external link/download/cancel after round trip, shared slot balance/checkin, persistent SDK and child/host reload');await context.close();
  }
  assert.deepEqual(errors,[]);assert.notEqual(docs.get('A').player,docs.get('B').player);writeFileSync(output+'/report.json',JSON.stringify({ok:true,checks,errors},null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length,output}));
}catch(error){writeFileSync(output+'/failure.json',JSON.stringify({message:error.message,checks,errors},null,2)+'\n');throw error;}
finally{await browser?.close();await new Promise(done=>{server.close(done);server.closeAllConnections();});}
