import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {build} from 'vite';
import {discordTestBuildOptions} from '../game/discord-test-build.js';
import {createActivityHandler} from '../../server/http/app-handler.js';
import {PlaytestService,discordTestPlayer,slotTestState,slotTestCheckinResult} from '../../cloud/yakyuken-playtest-core.js';
import {TEST_GUILD,TEST_CHANNEL} from '../../cloud/discord-test-auth.js';
import {launchBrowser} from './helpers/browser.js';
import {verifyLaunchScreen} from './helpers/launch-screen.js';
import {verifySlotAtlasRecovery} from './helpers/slot-atlas-recovery.js';
import {setGameSafeArea,yakyukenHeaderBounds,assertSameGameHeader} from './helpers/game-safe-area.js';

const output='test-results/discord-test-activity',clientId='100000000000000003',port=4203,origin='http://127.0.0.1:'+port;
mkdirSync(output,{recursive:true});const dist=resolve(output,'dist');
const buildOptions=discordTestBuildOptions(dist,clientId);
buildOptions.plugins.push({name:'isolated-player-scene',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/games/yakyuken/scene.js'))return {code:code.replace('this.host = host;','globalThis.__playerScene=this;this.host = host;'),map:null};}});
await build(buildOptions);
const shipped=readdirSync(dist+'/assets'),approvedArt=JSON.parse(readFileSync('art/launch-screen/approved-assets.json','utf8')).images;
assert.ok(!shipped.some(file=>/\.png$/i.test(file)),'review PNGs never ship as runtime assets');
for(const art of approvedArt){
  const file=shipped.find(name=>name.startsWith(art.id+'-')&&name.endsWith('.webp'));assert.ok(file,'each approved launch painting ships as WebP');
  assert.equal(createHash('sha256').update(readFileSync(dist+'/assets/'+file)).digest('hex'),art.outputSha256,'runtime bytes match the verified approved artwork');
}
const docs=new Map(),services=new Map(),sessions=new Map(),users={A:'100000000000000111',B:'100000000000000112'},financial=[];
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
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style><iframe sandbox="allow-pointer-lock allow-scripts allow-same-origin allow-forms"></iframe><script>window.__commands=[];window.__orientations=[];window.__links=[];window.__openAllowed=true;window.addEventListener('message',event=>{if(event.source!==document.querySelector('iframe').contentWindow||!Array.isArray(event.data))return;const [opcode,payload]=event.data;if(opcode===2)return;__commands.push(opcode===0?'HANDSHAKE':payload.cmd);if(opcode===0&&__commands.filter(x=>x==='HANDSHAKE').length>1)return;const reply=frame=>event.source.postMessage([1,frame],location.origin);if(opcode===0)return reply({cmd:'DISPATCH',evt:'READY',nonce:null,data:{v:1,config:{api_endpoint:'//discord.com/api',environment:'test'}}});let data=null;if(payload.cmd==='SET_ORIENTATION_LOCK_STATE')__orientations.push(payload.args);if(payload.cmd==='OPEN_EXTERNAL_LINK'){__links.push(payload.args.url);data={opened:window.__openAllowed};}if(payload.cmd==='AUTHORIZE')data={code:'code-${who}'};if(payload.cmd==='AUTHENTICATE')data={access_token:'fixture-token',user:{id:'${users[who]}',username:'tester-${who}',discriminator:'0',public_flags:0,global_name:'測試者 ${who}',avatar:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},scopes:['identify','guilds.members.read'],expires:'2099-01-01T00:00:00Z',application:{id:'${clientId}',name:'fixture',description:''}};reply({cmd:payload.cmd,evt:null,nonce:payload.nonce,data});});document.querySelector('iframe').src='/?frame_id=fixture-frame&instance_id=fixture-instance&platform=${platform}&guild_id=${TEST_GUILD}&channel_id=${TEST_CHANNEL}&location_id=fixture-location&discord_shim=1&mobile_app_version=300.0';</script>`);return;
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
      if(req.method==='POST')financial.push({who,action});
      if(['wallet','state'].includes(action)){const data=await s.stateView();data.wallet.name='測試者 '+who;return json(200,action==='wallet'?{state:slotTestState(data.wallet)}:data);}
      if(action==='checkin'&&!body.requestId)body.requestId='slot-daily-'+new Date(Date.now()+8*3600000).toISOString().slice(0,10);
      const data=await s.execute(action,body);data.wallet.name='測試者 '+who;
      if(url.pathname==='/api/checkin')return json(200,slotTestCheckinResult(data));
      return json(200,url.pathname==='/api/spin'?{state:slotTestState(data.wallet),round:data.round}:data);
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
let browser;const errors=[],checks=[],atlasRecovery=[];let launch=[];
try{
  browser=await launchBrowser();
  launch=await verifyLaunchScreen({browser,origin,output});
  assert.deepEqual(financial,[],'launching and viewing the lobby does not begin a paid match or claim rewards');
  for(const mobile of [false,true]){
    const who=mobile?'B':'A',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.route('https://cdn.discordapp.com/avatars/**',route=>route.fulfill({status:200,contentType:'image/webp',body:readFileSync('images/lobby/yakyuken-cover-v3.webp')}));
    await page.goto(origin+'/__host?who='+who+'&platform='+(mobile?'mobile':'desktop'));
    const element=await page.waitForSelector('iframe'),shell=await element.contentFrame();const game=await shell.waitForSelector('#game:not([hidden])'),frame=await game.contentFrame(),phase=value=>frame.waitForFunction(value=>document.querySelector('canvas')?.dataset.phase===value&&document.querySelector('canvas').dataset.changing!=='true',value);
    await phase('games');assert.ok((await page.evaluate(()=>__commands)).includes('AUTHENTICATE'));
    await frame.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase('characters');
    assert.equal(await frame.evaluate(()=>window.__playerScene.layout.ui.width),mobile?390:1440,'mobile fixture uses a real phone viewport');
    if(mobile){
      for(const [width,height,insets] of [
        [390,844,{top:48,right:0,bottom:16,left:0}],
        [375,812,{top:64,right:12,bottom:24,left:8}],
        [844,390,{top:20,right:40,bottom:12,left:36}],
        [390,844,{top:null,right:null,bottom:null,left:null}],
      ]){
        await page.setViewportSize({width,height});await setGameSafeArea(shell,frame,insets);
        const bounds=await yakyukenHeaderBounds(frame);
        for(const box of Object.values(bounds))assert.ok(box.x>=(insets.left??0)-1&&box.y>=(insets.top??0)-1&&box.x+box.width<=width-(insets.right??0)+1&&box.y+box.height<=height-(insets.bottom??0)+1,'header stays clear of every safe-area edge');
      }
      // Late inset changes have no viewport resize event to trigger propagation.
      await setGameSafeArea(shell,frame,{top:48,right:0,bottom:16,left:0});
    }
    const yakyukenHeader=await yakyukenHeaderBounds(frame);
    const playerView=(target=frame)=>target.evaluate(()=>{const s=window.__playerScene,b=s.balanceGroup.getBounds();return {name:s.playerNameCaption.text,uid:s.playerIdCaption.text,balance:s.balanceNumber.text,portrait:!!s.hud.getChildByLabel('discord-avatar-image',true),balanceTop:b.y,balanceBottom:b.y+b.height,header:s.layout.ui.headerHeight,contentTop:s.layout.contentTop};});
    await frame.waitForFunction(()=>!!window.__playerScene?.avatarTexture);
    const identity=await playerView();assert.equal(identity.name,'測試者 '+who);assert.equal(identity.uid,'ID '+users[who]);assert.equal(identity.portrait,true);assert.equal(identity.balance,'10,000');assert.ok(identity.balanceTop>=identity.header&&identity.balanceBottom<=identity.contentTop);
    const operationsBeforeCheckin=financial.length;
    const checkinButton=frame.locator('#daily-checkin');
    const checkinCopy=await checkinButton.innerText();
    assert.equal(checkinCopy,'週簽到・第 1 天\n可領 500 戲籌');
    if(mobile)await checkinButton.tap();else await checkinButton.click();
    const checkin=frame.getByRole('dialog',{name:'週簽到',exact:true});
    assert.equal(await checkin.getByRole('listitem').count(),7);
    assert.equal(await checkin.locator('[aria-current="step"]').count(),1);
    assert.equal(financial.length,operationsBeforeCheckin,'viewing check-in never claims the reward');
    assert.equal((await playerView()).balance,identity.balance);
    await page.screenshot({path:output+'/'+who+'-checkin.png'});
    const close=checkin.getByRole('button',{name:'關閉視窗',exact:true});
    if(mobile)await close.tap();else await close.click();
    await checkin.waitFor({state:'hidden'});
    const lobbyPoint=await frame.evaluate(()=>{
      const scene=window.__playerScene,canvas=scene.app.canvas.getBoundingClientRect(),bounds=scene.lobbyButton.getBounds();
      const x=canvas.x+bounds.x+bounds.width/2,y=canvas.y+bounds.y+bounds.height/2;
      return {x,y,hit:document.elementFromPoint(x,y)?.getAttribute('aria-label')};
    });
    assert.equal(lobbyPoint.hit,'返回遊戲大廳','the rendered lobby icon must hit its own DOM button after closing check-in');
    if(mobile)await page.touchscreen.tap(lobbyPoint.x,lobbyPoint.y);else await page.mouse.click(lobbyPoint.x,lobbyPoint.y);
    await phase('games');
    assert.equal(await checkin.isVisible(),false);
    await frame.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase('characters');
    await page.screenshot({path:output+'/'+who+'-identity-selection.png'});
    await frame.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase('selecting');assert.equal(docs.get(who).balance,9000);
    assert.equal((await playerView()).balance,'9,000');await page.screenshot({path:output+'/'+who+'-identity-table.png'});
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
    atlasRecovery.push({device:mobile?'mobile':'desktop',...await verifySlotAtlasRecovery(page,async()=>{
      await frame.getByRole('button',{name:'選擇老虎機',exact:true}).click();await frame.waitForFunction(()=>document.querySelector('#spin')?.disabled===false);
    })});
    assert.equal(new URL(frame.url()).pathname,'/slot/');assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1,'persistent shell retains one live SDK connection across games');for(const [key,value] of Object.entries({discord_shim:'1',location_id:'fixture-location',mobile_app_version:'300.0'}))assert.equal(new URL(frame.url()).searchParams.get(key),value);assert.equal(new URL(frame.url()).searchParams.get('channel_id'),TEST_CHANNEL);assert.equal((await frame.locator('#balance').textContent()).replaceAll(',',''),'11500');
    assert.equal(await frame.locator('#player-name').textContent(),identity.name);assert.equal(await frame.locator('#player-id').textContent(),identity.uid);await frame.locator('.player-avatar-image:not([hidden])').waitFor();
    const slotHeader=await frame.evaluate(()=>{
      const bounds=selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
      return {checkin:bounds('.daily-checkin'),tools:bounds('.player-tools')};
    });
    assertSameGameHeader(yakyukenHeader,slotHeader);
    assert.equal(await checkinButton.innerText(),checkinCopy);
    await checkinButton.click();await frame.getByRole('button',{name:/領取.*戲籌/}).click();await frame.waitForFunction(()=>document.querySelector('#balance')?.textContent.replaceAll(',','')==='12000');
    await frame.getByText('簽到完成！500 戲籌已加入餘額。',{exact:true}).waitFor();
    await frame.locator('#close-dialog').click();
    const claimedCopy=await checkinButton.innerText();
    const settlement=page.waitForResponse(r=>r.url().includes('/api/spin'));await frame.locator('#spin').click();const spin=await (await settlement).json();
    await frame.waitForFunction(()=>document.querySelector('#spin')?.disabled===false&&document.querySelector('#spin').getAttribute('aria-label')!=='快速停止');
    assert.equal(docs.get(who).balance,spin.state.balance);await page.screenshot({path:output+'/'+who+'-slot.png'});
    await frame.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase('games');await frame.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase('characters');
    assert.equal(docs.get(who).balance,spin.state.balance);assert.equal(docs.get(who).checkin.receipt.cycleDay,1);
    assert.equal(await checkinButton.innerText(),claimedCopy);
    await checkinButton.click();
    assert.equal(await checkin.locator('.checkin-day.is-complete').count(),1,'Yakyuken shows the check-in claimed in slots');
    assert.equal(await checkin.getByRole('button',{name:'今日獎勵已領取'}).isDisabled(),true);
    await checkin.getByRole('button',{name:'關閉視窗',exact:true}).click();
    await frame.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame.getByRole('button',{name:'回顧終幕 CG',exact:true}).click();
    await page.evaluate(()=>{__openAllowed=false;});await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).click();await page.waitForFunction(()=>__links.length===2);
    await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).waitFor({state:'visible'});await page.evaluate(()=>{__openAllowed=true;});
    await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).click();await page.waitForFunction(()=>__links.length===3);
    assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1);
    await frame.evaluate(()=>location.reload());await phase('games');assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1);
    await page.reload();
    const reloadedShell=await (await page.waitForSelector('iframe')).contentFrame(),reloaded=await (await reloadedShell.waitForSelector('#game:not([hidden])')).contentFrame();await reloaded.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='games');
    const afterReloadPhase=value=>reloaded.waitForFunction(value=>document.querySelector('canvas')?.dataset.phase===value,value);
    await reloaded.getByRole('button',{name:'選擇野球拳',exact:true}).click();await afterReloadPhase('characters');
    const beforeEntry=docs.get(who).balance;
    assert.equal((await playerView(reloaded)).balance,beforeEntry.toLocaleString('en-US'));
    await reloaded.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await afterReloadPhase('selecting');
    assert.equal(docs.get(who).balance,beforeEntry-1000);assert.equal((await playerView(reloaded)).balance,(beforeEntry-1000).toLocaleString('en-US'));
    const active=docs.get(who).activeId,leaveCount=financial.filter(call=>call.who===who&&call.action==='leave').length;
    await reloaded.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await reloaded.getByRole('button',{name:'確認離開',exact:true}).waitFor();
    await page.keyboard.press('1');assert.equal(await reloaded.locator('canvas').getAttribute('data-selected'),'');
    await page.screenshot({path:output+'/'+who+'-leave-confirmation.png'});
    await page.setViewportSize({width:320,height:568});await reloaded.waitForFunction(()=>window.__playerScene.layout.ui.width===320);
    const confirmBounds=await reloaded.getByRole('button',{name:'確認離開',exact:true}).boundingBox();assert.ok(confirmBounds.x>=0&&confirmBounds.y>=0&&confirmBounds.x+confirmBounds.width<=320&&confirmBounds.y+confirmBounds.height<=568);
    assert.equal((await playerView(reloaded)).uid,'ID '+users[who]);assert.equal((await playerView(reloaded)).portrait,true);
    await page.screenshot({path:output+'/'+who+'-leave-small.png'});
    await reloaded.getByRole('button',{name:'繼續遊戲',exact:true}).click();assert.equal(docs.get(who).balance,beforeEntry-1000);assert.equal(docs.get(who).records.find(r=>r.id===active).status,'playing');assert.equal(financial.filter(call=>call.who===who&&call.action==='leave').length,leaveCount);
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
    await reloaded.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();
    await reloaded.getByRole('button',{name:'確認離開',exact:true}).click();await afterReloadPhase('games');
    assert.equal(docs.get(who).balance,beforeEntry-1000);assert.equal(docs.get(who).records.find(r=>r.id===active).status,'left');assert.equal(financial.filter(call=>call.who===who&&call.action==='leave').length,leaveCount+1);
    await reloaded.getByRole('button',{name:'選擇野球拳',exact:true}).click();await afterReloadPhase('characters');
    await reloaded.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await afterReloadPhase('selecting');
    assert.equal(docs.get(who).balance,beforeEntry-2000);assert.notEqual(docs.get(who).activeId,active);
    checks.push((mobile?'mobile touch':'desktop')+': real SDK handshake/OAuth, scoped identity, Yakyuken reward, sandbox-safe CG external link/download/cancel after round trip, shared slot balance/checkin, persistent SDK and child/host reload');await context.close();
  }
  assert.deepEqual(errors,[]);assert.notEqual(docs.get('A').player,docs.get('B').player);writeFileSync(output+'/report.json',JSON.stringify({ok:true,checks,launch,atlasRecovery,errors},null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length,launchChecks:launch.length,output}));
}catch(error){writeFileSync(output+'/failure.json',JSON.stringify({message:error.message,checks,errors,atlasRecovery:error.atlasRecovery||atlasRecovery},null,2)+'\n');throw error;}
finally{await browser?.close();await new Promise(done=>{server.close(done);server.closeAllConnections();});}
