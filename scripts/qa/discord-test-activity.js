import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {build} from 'vite';
import {discordTestBuildOptions} from '../build/discord-test.js';
import {createActivityHandler} from '../../server/http/app-handler.js';
import {PlaytestService,discordTestPlayer,slotTestState,slotTestCheckinResult} from '../../cloud/yakyuken-playtest-core.js';
import {TEST_GUILD,TEST_CHANNEL} from '../../cloud/discord-test-auth.js';
import {launchBrowser} from './helpers/browser.js';
import {createQaTimings} from './helpers/qa-timings.js';
import {createQaScreenshots} from './helpers/qa-screenshots.js';
import {verifyLaunchScreen} from './helpers/launch-screen.js';
import {verifySlotAtlasRecovery} from './helpers/slot-atlas-recovery.js';
import {assertMusicContinuity} from './helpers/music-continuity.js';
import {setGameSafeArea,yakyukenHeaderBounds,assertSameGameHeader} from './helpers/game-safe-area.js';

const output='test-results/discord-test-activity',clientId='100000000000000003',port=4203,origin='http://127.0.0.1:'+port;
mkdirSync(output,{recursive:true});const dist=resolve(output,'dist');
const timing=createQaTimings(output+'/timings.json');
const screenshots=createQaScreenshots({timing});
const musicContinuity=[];
const screenshot=(page,options)=>screenshots.capture(page,options.path);
const buildOptions=discordTestBuildOptions(dist,clientId);
buildOptions.plugins.push({name:'isolated-player-scene',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/games/yakyuken/scene.js'))return {code:code.replace('this.host = host;','globalThis.__playerScene=this;this.host = host;'),map:null};}});
await build(buildOptions);
timing.mark('build');
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
let browser,activePage;const errors=[],checks=[],atlasRecovery=[];let launch=[];
try{
  browser=await launchBrowser();
  timing.mark('browser-start');
  launch=await verifyLaunchScreen({browser,origin,output,timing,screenshots});
  timing.mark('launch-complete');
  assert.deepEqual(financial,[],'launching and viewing the lobby does not begin a paid match or claim rewards');
  for(const mobile of [false,true]){
    const who=mobile?'B':'A',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    activePage=page;
    await context.addInitScript(()=>{
      const NativeAudio=window.Audio;
      window.__musicPlayers=[];
      // Playwright evaluation may itself mark the window activated. Model the
      // block with trusted native input instead of the window's sticky bit.
      const gesture=event=>{
        if(!event.isTrusted)return;
        const owner=['/yakyuken-preview.html','/slot/'].includes(location.pathname)?parent:window;
        owner.__musicGesture=true;
      };
      for(const type of ['pointerup','touchend','keydown'])document.addEventListener(type,gesture,true);
      window.Audio=function(source){
        const media=new NativeAudio(source);
        if(String(source).includes('circus-background-optimized')){
          const trace={media,pauses:0,blocked:0,advances:0,positionWrites:0,empties:0};
          __musicPlayers.push(trace);
          media.addEventListener('pause',()=>trace.pauses++);
          let lastTime=media.currentTime;
          media.addEventListener('timeupdate',()=>{if(!media.paused&&media.currentTime!==lastTime)trace.advances++;lastTime=media.currentTime;});
          media.addEventListener('emptied',()=>trace.empties++);
          const position=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');
          Object.defineProperty(media,'currentTime',{get(){return position.get.call(this);},set(value){trace.positionWrites++;position.set.call(this,value);}});
          const play=media.play.bind(media);
          media.play=()=>{
            if(!window.__musicGesture){
              trace.blocked++;
              return Promise.reject(new DOMException('Fixture requires a real gesture','NotAllowedError'));
            }
            return play();
          };
        }
        return media;
      };
      window.Audio.prototype=NativeAudio.prototype;
    });
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.route('https://cdn.discordapp.com/avatars/**',route=>route.fulfill({status:200,contentType:'image/webp',body:readFileSync('images/lobby/yakyuken-cover-v3.webp')}));
    await page.goto(origin+'/__host?who='+who+'&platform='+(mobile?'mobile':'desktop'));
    const element=await page.waitForSelector('iframe'),shell=await element.contentFrame();const game=await shell.waitForSelector('#game:not([hidden])'),frame=await game.contentFrame(),phase=value=>frame.waitForFunction(value=>document.querySelector('canvas')?.dataset.phase===value&&document.querySelector('canvas').dataset.changing!=='true',value);
    await phase('games');await shell.waitForSelector('#game:not([inert])');
    timing.mark(who+'/lobby-ready');
    assert.ok((await page.evaluate(()=>__commands)).includes('AUTHENTICATE'));
    const lobbyMusic=frame.getByRole('button',{name:'背景音樂',exact:true});
    const musicState=()=>shell.evaluate(()=>{const [{media,pauses,blocked}]=__musicPlayers;return {count:__musicPlayers.length,time:media.currentTime,paused:media.paused,volume:media.volume,pauses,blocked};});
    const musicProgress=async()=>({...await musicState(),...await shell.evaluate(()=>{const t=__musicPlayers[0];return {advances:t.advances,positionWrites:t.positionWrites,empties:t.empties,source:t.media.currentSrc,duration:t.media.duration};})});
    const verifyLobbyMusic=async()=>{
      await lobbyMusic.waitFor();
      const layout=await lobbyMusic.evaluate(button=>{
        const b=button.getBoundingClientRect(),host=document.querySelector('#yakyuken-app').getBoundingClientRect();
        const {logoWidth,games}=__playerScene.lobbyLayout;
        return {width:b.width,height:b.height,inside:b.x>=host.x&&b.y>=host.y&&b.right<=host.right&&b.bottom<=host.bottom,
          outsideLogo:b.x>=host.x+(host.width+logoWidth)/2,outsideCards:games.every(card=>b.bottom<=host.y+card.y-card.height/2)};
      });
      assert.deepEqual(layout,{width:48,height:48,inside:true,outsideLogo:true,outsideCards:true});
    };
    await verifyLobbyMusic();
    assert.equal(await lobbyMusic.getAttribute('aria-pressed'),'true');
    assert.deepEqual(await musicState(),{count:1,time:0,paused:true,volume:.16,pauses:0,blocked:1});
    await screenshot(page,{path:output+'/'+who+'-lobby-music.png'});
    const chooseYakyuken=frame.getByRole('button',{name:'選擇野球拳',exact:true});
    if(mobile)await chooseYakyuken.tap();else await chooseYakyuken.click();
    await phase('characters');
    await frame.waitForFunction(()=>window.__playerScene.audio.background.context?.state==='running');
    await shell.waitForFunction(()=>!__musicPlayers[0].media.paused&&__musicPlayers[0].media.currentTime>0);
    assert.equal(await lobbyMusic.isVisible(),false);
    assert.equal(await frame.evaluate(()=>__musicPlayers.length),0,'Yakyuken leaves music playback in the shell');
    const beforeBackground=await musicState();
    await shell.evaluate(()=>{
      window.__fixtureHidden=true;
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__fixtureHidden});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await shell.waitForFunction(()=>__musicPlayers[0].media.paused);
    assert.ok((await musicState()).time>=beforeBackground.time);
    await shell.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await shell.waitForFunction(time=>!__musicPlayers[0].media.paused&&__musicPlayers[0].media.currentTime>time,beforeBackground.time);
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
    await screenshot(page,{path:output+'/'+who+'-checkin.png'});
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
    await screenshot(page,{path:output+'/'+who+'-identity-selection.png'});
    let releaseEntry;
    const entryHeld=new Promise(resolve=>{releaseEntry=resolve;});
    const holdEntry=async route=>{await entryHeld;await route.continue();};
    await page.route('**/api/playtest/begin',holdEntry);
    try{
      const start=frame.getByRole('button',{name:'進入野球拳試玩',exact:true});
      await Promise.all([page.waitForRequest('**/api/playtest/begin'),mobile?start.tap():start.click()]);
      await frame.getByRole('progressbar',{name:'野球拳載入進度',exact:true}).waitFor();
      const loading=await frame.evaluate(()=>{
        const {entryOverlay,app,entries}=window.__playerScene;
        const logo=entryOverlay.content.getChildByLabel('yakyuken-loading-logo');
        return {stage:app.canvas.dataset.entryStage,progress:entryOverlay.target,visible:entryOverlay.content.visible,
          logo:logo.width>0&&logo.height>0,status:entryOverlay.status.text,entries};
      });
      assert.deepEqual(loading,{stage:'loading',progress:24,visible:true,logo:true,status:'正在確認入場…',entries:0});
      assert.equal(await frame.getByRole('button',{name:'確認出牌',exact:true}).count(),0);
      await screenshot(page,{path:output+'/'+who+'-yakyuken-entry-wait.png'});
    }finally{releaseEntry();await page.unroute('**/api/playtest/begin',holdEntry);}
    await phase('selecting');assert.equal(docs.get(who).balance,9000);
    timing.mark(who+'/identity-checkin-entry');
    await frame.getByRole('progressbar',{name:'野球拳載入進度',exact:true}).waitFor({state:'detached'});
    assert.equal((await playerView()).balance,'9,000');await screenshot(page,{path:output+'/'+who+'-identity-table.png'});
    await frame.evaluate(()=>{
      const context=window.__playerScene.audio.background.context;
      const createSample=context.createBufferSource.bind(context),createTone=context.createOscillator.bind(context);
      window.__tableSounds={samples:0,tones:0};
      context.createBufferSource=()=>{window.__tableSounds.samples++;return createSample();};
      context.createOscillator=()=>{window.__tableSounds.tones++;return createTone();};
    });
    for(let i=0;i<2;i++){
      if(i){await frame.getByRole('button',{name:'下一拳',exact:true}).click();await phase('selecting');}
      const hand=frame.getByRole('button',{name:'選擇拳頭',exact:true}),confirm=frame.getByRole('button',{name:'確認出牌',exact:true});
      if(mobile)await hand.tap();else await hand.click();
      assert.deepEqual(await frame.evaluate(()=>window.__tableSounds),{samples:i,tones:0},'selection leaves the background track alone');
      if(mobile)await confirm.tap();else await confirm.click();
      await phase('confirmed');
      assert.deepEqual(await frame.evaluate(()=>window.__tableSounds),{samples:i+1,tones:0},'each hand plays only one paper flip');
    }
    assert.equal(docs.get(who).balance,11500);await frame.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame.getByRole('button',{name:'回顧終幕 CG',exact:true}).click();
    timing.mark(who+'/yakyuken-rounds');
    await frame.getByRole('button',{name:'下載高畫質去背 PNG',exact:true}).click();
    await page.waitForFunction(()=>__links.length===1);const link=await page.evaluate(()=>__links[0]);
    assert.equal(link,'https://jokers-circus-gallery.pages.dev/cg/yakyuken/dealer/finale');
    const downloadPage=await context.newPage();await downloadPage.goto(origin+'/cg-download.html?stage=2');
    const downloadEvent=downloadPage.waitForEvent('download');await downloadPage.getByRole('link',{name:'下載圖片',exact:true}).click();assert.equal((await downloadEvent).suggestedFilename(),'Jokers-Circus-Yakyuken-Dealer-finale.png');await downloadPage.close();
    await frame.getByRole('button',{name:'關閉視窗',exact:true}).click();await screenshot(page,{path:output+'/'+who+'-yakyuken.png'});
    await frame.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase('games');
    timing.mark(who+'/cg-download');
    const beforeSlotMusic=await musicProgress();
    atlasRecovery.push({device:mobile?'mobile':'desktop',...await verifySlotAtlasRecovery(page,async()=>{
      let releaseWallet;
      const walletHeld=new Promise(resolve=>{releaseWallet=resolve;});
      const holdWallet=async route=>{await walletHeld;await route.continue();};
      await page.route('**/api/wallet',holdWallet);
      try{
        await frame.getByRole('button',{name:'選擇老虎機',exact:true}).click();
        await frame.locator('#loading-track').waitFor();
        await frame.waitForFunction(()=>{const image=document.querySelector('.loading-logo img');return image?.complete&&image.naturalWidth>0;});
        assert.ok(Number(await frame.locator('#loading-track').getAttribute('aria-valuenow'))<100);
        assert.equal((await musicState()).paused,false,'music continues while the slot wallet is still loading');
        await screenshot(page,{path:output+'/'+who+'-slot-entry-wait.png'});
      }finally{releaseWallet();await page.unroute('**/api/wallet',holdWallet);}
      await frame.waitForFunction(()=>document.querySelector('#spin')?.disabled===false);
    })});
    await shell.waitForFunction(advances=>__musicPlayers[0].advances>advances,beforeSlotMusic.advances);
    const inSlotMusic=await musicProgress();
    timing.mark(who+'/slot-entry-recovery');
    musicContinuity.push({who,before:beforeSlotMusic,after:inSlotMusic});
    assertMusicContinuity(beforeSlotMusic,inSlotMusic);
    assert.equal(await frame.evaluate(()=>__musicPlayers.length),0,'slot leaves music playback in the shell');
    assert.equal(await frame.locator('#music').getAttribute('aria-pressed'),'true');
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
    timing.mark(who+'/slot-checkin-spin');
    assert.equal(docs.get(who).balance,spin.state.balance);await screenshot(page,{path:output+'/'+who+'-slot.png'});
    if(mobile)await frame.locator('#music').tap();else await frame.locator('#music').click();
    assert.equal(await frame.locator('#music').getAttribute('aria-pressed'),'false');
    assert.equal(await frame.locator('#sound').getAttribute('aria-pressed'),'true','music is independent of effects');
    const mutedAt=(await musicState()).time;
    await frame.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase('games');
    await verifyLobbyMusic();
    assert.equal(await lobbyMusic.getAttribute('aria-pressed'),'false');
    assert.equal((await musicState()).paused,true);
    await chooseYakyuken.click();await phase('characters');
    await frame.getByRole('button',{name:'開啟音樂',exact:true}).waitFor();
    assert.equal((await musicState()).paused,true,'entering Yakyuken cannot override the mute');
    await frame.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase('games');
    if(mobile)await lobbyMusic.tap();else{await lobbyMusic.focus();await page.keyboard.press('Enter');}
    await shell.waitForFunction(time=>!__musicPlayers[0].media.paused&&__musicPlayers[0].media.currentTime>time,mutedAt);
    await chooseYakyuken.click();await phase('characters');
    await frame.getByRole('button',{name:'關閉音樂',exact:true}).waitFor();
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
    timing.mark(who+'/round-trip-music-cg');
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
    await screenshot(page,{path:output+'/'+who+'-leave-confirmation.png'});
    await page.setViewportSize({width:320,height:568});await reloaded.waitForFunction(()=>window.__playerScene.layout.ui.width===320);
    const confirmBounds=await reloaded.getByRole('button',{name:'確認離開',exact:true}).boundingBox();assert.ok(confirmBounds.x>=0&&confirmBounds.y>=0&&confirmBounds.x+confirmBounds.width<=320&&confirmBounds.y+confirmBounds.height<=568);
    assert.equal((await playerView(reloaded)).uid,'ID '+users[who]);assert.equal((await playerView(reloaded)).portrait,true);
    await screenshot(page,{path:output+'/'+who+'-leave-small.png'});
    await reloaded.getByRole('button',{name:'繼續遊戲',exact:true}).click();assert.equal(docs.get(who).balance,beforeEntry-1000);assert.equal(docs.get(who).records.find(r=>r.id===active).status,'playing');assert.equal(financial.filter(call=>call.who===who&&call.action==='leave').length,leaveCount);
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
    await reloaded.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();
    await reloaded.getByRole('button',{name:'確認離開',exact:true}).click();await afterReloadPhase('games');
    assert.equal(docs.get(who).balance,beforeEntry-1000);assert.equal(docs.get(who).records.find(r=>r.id===active).status,'left');assert.equal(financial.filter(call=>call.who===who&&call.action==='leave').length,leaveCount+1);
    await reloaded.getByRole('button',{name:'選擇野球拳',exact:true}).click();await afterReloadPhase('characters');
    await reloaded.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await afterReloadPhase('selecting');
    assert.equal(docs.get(who).balance,beforeEntry-2000);assert.notEqual(docs.get(who).activeId,active);
    timing.mark(who+'/reload-leave-reentry');
    checks.push((mobile?'mobile touch':'desktop')+': persistent soundtrack and mute across games, real SDK handshake/OAuth, scoped identity, Yakyuken reward, sandbox-safe CG external link/download/cancel after round trip, shared slot balance/checkin, persistent SDK and child/host reload');await context.close();
  }
  assert.deepEqual(errors,[]);assert.notEqual(docs.get('A').player,docs.get('B').player);writeFileSync(output+'/report.json',JSON.stringify({ok:true,checks,launch,atlasRecovery,musicContinuity,errors,screenshotMode:screenshots.mode},null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length,launchChecks:launch.length,output,screenshotMode:screenshots.mode}));
}catch(error){
  timing.mark('failure');
  writeFileSync(output+'/failure.json',JSON.stringify({message:error.message,checks,errors,musicContinuity,atlasRecovery:error.atlasRecovery||atlasRecovery},null,2)+'\n');
  if(activePage&&!activePage.isClosed())await screenshots.failure(activePage,output+'/failure.png');
  throw error;
}
finally{await browser?.close();await new Promise(done=>{server.close(done);server.closeAllConnections();});}
