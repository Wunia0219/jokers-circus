import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'vite';
import {launchBrowser} from './helpers/browser.js';
import {buildCGGallery} from '../game/build-cg-gallery.js';
import {CG_ART,DEALER_CG} from '../../src/games/yakyuken/cg-catalog.js';
import {securityHeaders,contentSecurityPolicy} from '../../server/http/security-headers.js';

const output='test-results/cg-responsive',origin='http://127.0.0.1:4198';
mkdirSync(output,{recursive:true});
const gallery=await buildCGGallery(),errors=[],checks=[];
const server=await createServer({configFile:false,envDir:false,cacheDir:`${output}/vite-cache`,
  plugins:[{name:'isolated-responsive-cg',transform(code,id){
    if(id.replaceAll('\\','/').endsWith('/src/games/yakyuken/scene.js'))return {code:code.replace('this.host = host;','globalThis.__responsiveScene=this;this.host = host;'),map:null};
  },configureServer(dev){dev.middlewares.use((req,res,next)=>{
    const path=new URL(req.url,origin).pathname,art=DEALER_CG.find(art=>path.replace(/\/$/,'')===art.path);
    const file=art?'/cg-download.html':path.startsWith('/images/yakyuken/dealer/')||path.startsWith('/assets/')?path:null;
    if(!file)return next();
    try{
      const data=readFileSync(gallery+file),type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'text/javascript';
      res.writeHead(200,{...securityHeaders,'Content-Security-Policy':contentSecurityPolicy,'Content-Type':type});res.end(data);
    }catch{next();}
  });}}],server:{host:'127.0.0.1',port:4198,strictPort:true,hmr:false,watch:{ignored:['**/test-results/**']}}});
let browser;
try{
  await server.listen();browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1255,height:700},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
  const slot=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  slot.on('pageerror',error=>errors.push(error.message));
  await slot.goto(origin+'/?lobby=preview');
  await slot.getByRole('button',{name:'遊戲規則',exact:true}).click();
  await slot.locator('dialog.rules-dialog[open]').waitFor();
  await page.goto(origin+'/yakyuken-preview.html');
  await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=()=>page.evaluate(()=>{const body=window.__responsiveScene.modalRoot.children.find(n=>n.label==='archive-dialog'),b=body.hitArea,p=body.getGlobalPosition();return {x:p.x+b.x,y:p.y+b.y,width:b.width,height:b.height};});
  const roleTab=name=>page.getByRole('button',{name:new RegExp(`^${name}收藏，`)});
  const chrome=async(label)=>{
    const rules=await slot.evaluate(()=>{
      const rect=selector=>{const {x,y,width,height}=document.querySelector(selector).getBoundingClientRect();return {x,y,width,height};};
      const dialog=document.querySelector('.rules-dialog');
      return {frame:rect('.rules-dialog'),header:rect('.rules-dialog .dialog-head'),close:rect('#close-dialog'),title:rect('#dialog-title'),logo:rect('.rules-logo'),tab:rect('.rules-tabs button'),radius:parseFloat(getComputedStyle(dialog).borderTopLeftRadius)};
    });
    const collection=await page.evaluate(()=>{
      const s=window.__responsiveScene,body=s.modalRoot.getChildByLabel('archive-dialog',true),offset=s.host.getBoundingClientRect(),hit=body.hitArea,p=body.getGlobalPosition();
      const rect=(n)=>{const {x,y,width,height}=n.getBounds();return {x:x+offset.x,y:y+offset.y,width,height};};
      return {frame:{x:hit.x+p.x+offset.x,y:hit.y+p.y+offset.y,width:hit.width,height:hit.height},header:rect(body.getChildByLabel('programme-header')),
        close:rect(body.children.find(n=>n.accessibleTitle==='關閉視窗')),title:rect(body.getChildByLabel('programme-title')),logo:rect(body.getChildByLabel('collection-brand-logo')),tab:rect(body.getChildByLabel('gallery-tab:dealer'))};
    });
    const near=(part,props,tolerance=1)=>{
      for(const key of props)assert.ok(Math.abs(collection[part][key]-rules[part][key])<=tolerance,`${label}: ${part}.${key} (${collection[part][key]}) matches rules (${rules[part][key]})`);
    };
    near('frame',['x','y','width','height']);near('header',['x','y','width','height']);near('close',['x','y','width','height']);near('title',['x'],1.5);near('tab',['x','width','height']);
    assert.ok(collection.logo.y>=collection.header.y+collection.header.height,`${label}: logo follows the title band`);
    if(rules.frame.height>=430||rules.frame.width>=601){near('logo',['x','y','width','height'],1.5);near('tab',['y'],1.5);}
    return {rules,collection};
  };
  const tileGeometry=()=>page.evaluate(()=>{
    const tiles=window.__responsiveScene.modalRoot.getChildByLabel('archive-dialog',true).children.filter(n=>n.label?.startsWith('gallery-tile:'));
    const rounded=n=>Math.round(n*1000)/1000;
    return tiles.map(tile=>{
      const {x,y,width,height}=tile.getBounds(),image=tile.getChildByLabel('cg-thumbnail');
      return {x:rounded(x),y:rounded(y),width:rounded(width),height:rounded(height),image:image&&{width:rounded(image.width),height:rounded(image.height)}};
    });
  });
  const viewerGeometry=()=>page.evaluate(()=>{
    const body=window.__responsiveScene.modalRoot.getChildByLabel('archive-dialog',true);
    const rect=node=>{const {x,y,width,height}=node.getBounds();return {x,y,width,height};};
    return {image:rect(body.getChildByLabel('unlocked-cg-art')),title:rect(body.getChildByLabel('cg-viewer-title')),controls:body.children.filter(n=>n.accessible).map(n=>({
      name:n.accessibleTitle,caption:n.caption.text,...rect(n),
    }))};
  });
  const assertViewerButtons=({controls,title},width,height)=>{
    const close=controls.find(b=>b.name==='關閉視窗'),download=controls.find(b=>b.name==='下載高畫質去背 PNG'),back=controls.find(b=>b.name==='返回 CG 收藏');
    assert.equal(download.caption,'下載原圖');
    assert.ok(close.x-download.x-download.width>=(width<450?16:22)-.01,'download and close have distinct touch areas and a visible gap');
    assert.ok(download.x-back.x-back.width>=16,'download does not crowd the back control');
    if(width>=560&&width/height>=1.22)assert.ok(title.x>=back.x+back.width+7.99&&title.x+title.width<=download.x-7.99,'wide viewer title stays between the controls');
  };
  await page.waitForFunction(()=>window.__responsiveScene.screen==='table'&&!window.__responsiveScene.entryOverlay);
  await page.evaluate(ids=>{const {archive}=window.__responsiveScene;for(const id of ids)archive.unlock(id,0);},Object.keys(CG_ART));
  const sizes=[[1255,700],[1255,550],[900,700],[999,700],[1001,700],[1600,900],[1920,1080],[2560,1440],[844,390],[600,420],[768,1024],[544,680],[390,844],[320,568]];
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await slot.setViewportSize({width,height});await frame();
    await page.getByRole('button',{name:'選擇剪刀',exact:true}).click();await frame();
    const checkFeedback=async()=>{
      const controls=await page.evaluate(()=>{
        const s=window.__responsiveScene,b=s.confirmButton.getBounds(),d=s.statusDetail.getBounds(),t=s.status.getBounds();
        return {caption:s.confirmButton.caption.width,buttonWidth:s.confirmButton.buttonWidth,detailTop:d.y,detailBottom:d.y+d.height,detailRight:d.x+d.width,titleBottom:t.y+t.height,buttonTop:b.y,buttonBottom:b.y+b.height,x:b.x,right:b.x+b.width,unit:s.balanceGroup.getChildByLabel('balance-unit').text};
      });
      assert.equal(controls.unit,'COINS');
      assert.ok(controls.caption<=controls.buttonWidth-20,'button caption fits even in short landscape windows');
      assert.ok(controls.titleBottom<controls.detailTop,'heading and description remain separate');
      assert.ok(controls.detailBottom<controls.buttonTop||controls.detailRight<controls.x,`${width}x${height}: status never overlaps confirm: ${JSON.stringify(controls)}`);
      assert.ok(controls.x>=0&&controls.right<=width&&controls.buttonBottom<height,'enlarged button stays inside the viewport');
      const result=await page.evaluate(()=>{const s=window.__responsiveScene;if(!s.returnButton.visible)return null;const b=s.returnButton.getBounds();return {x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height,width:s.returnButton.buttonWidth,height:s.returnButton.buttonHeight,caption:s.returnButton.caption.width};});
      if(result){
        assert.ok(result.width>=44&&result.height>=44&&result.caption<=result.width-20,'return remains a readable touch control');
        assert.ok(result.x>=0&&result.right<=width&&result.y>=0&&result.bottom<height,'return stays inside the viewport');
        assert.ok(controls.right<=result.x||controls.buttonBottom<=result.y,'retry and return never overlap');
        assert.ok(controls.detailBottom<result.y||controls.detailRight<result.x,'status stays clear of return');
      }
    };
    await checkFeedback();
    await page.screenshot({path:`${output}/table-${width}x${height}.png`});
    const saved=await page.evaluate(()=>{const s=window.__responsiveScene;return {challenge:s.challenge,phase:s.phase,duel:s.duel,handTurn:s.handTurn};});
    await page.evaluate(()=>{const s=window.__responsiveScene;s.phase='requesting';s.updateControls();s.app.render();});await checkFeedback();
    await page.evaluate(()=>{const s=window.__responsiveScene;s.phase='confirming';s.updateControls();s.app.render();});await checkFeedback();
    await page.evaluate(()=>{const s=window.__responsiveScene;s.phase='retrying';s.handTurn={error:'測試雲端連線中斷，請重試原操作，不會重複扣款。'};s.updateControls();s.app.render();});await checkFeedback();
    await page.evaluate(()=>{const s=window.__responsiveScene;s.phase='confirmed';s.duel={dealer:'paper',outcome:'win'};s.challenge={...s.challenge,status:'won',wins:2,reward:2500};s.updateControls();s.app.render();});await checkFeedback();
    await page.screenshot({path:`${output}/complete-${width}x${height}.png`});
    await page.evaluate(()=>{const s=window.__responsiveScene;s.challenge={...s.challenge,status:'lost',wins:0,losses:2,reward:0};s.duel={dealer:'paper',outcome:'loss'};s.updateControls();s.app.render();});await checkFeedback();
    await page.screenshot({path:`${output}/lost-${width}x${height}.png`});
    await page.evaluate(saved=>{const s=window.__responsiveScene;Object.assign(s,saved);s.updateControls();s.app.render();},saved);
    await page.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame();
    const collection=await bounds();
    const parity=await chrome(`${width}x${height}`);
    const cards=await tileGeometry();
    for(const name of ['優然','夏澄','命運荷官']){
      await roleTab(name).click();await frame();
      const other=await tileGeometry();
      assert.deepEqual(other[0].image,cards[0].image,`${width}x${height}: thumbnail sizes are identical across characters`);
      assert.ok(other.every(b=>Math.abs(b.width-cards[0].width)<.01&&Math.abs(b.height-cards[0].height)<.01&&b.height>=43.99));
      if(name==='夏澄'&&[390,1255].includes(width))await page.screenshot({path:`${output}/xiache-grid-${width}x${height}.png`});
    }
    await page.screenshot({path:`${output}/collection-${width}x${height}.png`});
    if([320,390,844,1255].includes(width))await slot.screenshot({path:`${output}/rules-${width}x${height}.png`});
    await page.getByRole('button',{name:'回顧邀你入局 CG',exact:true}).click();await frame();
    const full=await bounds();assert.ok(Math.abs(full.x)<.01&&Math.abs(full.y)<.01&&full.width===width&&full.height===height,'the viewer uses the full app frame');
    const viewer=await viewerGeometry();assertViewerButtons(viewer,width,height);
    const {image,controls}=viewer,wide=width>=560&&width/height>=1.22;
    const artWidth=width-2*(wide?62:width<450?10:16),artHeight=height-56-(wide?8:62);
    assert.ok(Math.abs(image.height-Math.min(artHeight,artWidth*1.5))<1&&Math.abs(image.width/image.height-2/3)<.001,'full art is fitted to the largest available rectangle without crop');
    for(const b of controls){
      assert.ok(b.x>=-.01&&b.y>=-.01&&b.x+b.width<=width+.01&&b.y+b.height<=height+.01&&b.height>=43.99);
      assert.ok(b.x+b.width<=image.x||image.x+image.width<=b.x||b.y+b.height<=image.y||image.y+image.height<=b.y,`${b.name} clears the art`);
    }
    await page.screenshot({path:`${output}/viewer-${width}x${height}.png`});
    await page.getByRole('button',{name:'返回 CG 收藏',exact:true}).click();await frame();
    assert.deepEqual(await bounds(),collection,'return preserves the same frame');
    await page.getByRole('button',{name:'關閉視窗',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__responsiveScene.selected),'scissors','gallery navigation and resizing preserve selected card');
    checks.push({width,height,collection,card:cards[0],art:image,parity});
  }
  for(const {width,height,insets} of [{width:390,height:844,insets:{top:48,right:2,bottom:34,left:6}},{width:844,height:390,insets:{top:0,right:34,bottom:21,left:47}},{width:568,height:320,insets:{top:0,right:0,bottom:0,left:0}}]){
    await page.setViewportSize({width,height});await slot.setViewportSize({width,height});
    for(const p of [page,slot])await p.evaluate(sides=>{for(const [side,n] of Object.entries(sides))document.documentElement.style.setProperty(`--discord-safe-area-inset-${side}`,`${n}px`);},insets);
    await frame();await page.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame();
    checks.push({width,height,insets,parity:await chrome(`${width}x${height} inset`)});
    await page.getByRole('button',{name:'回顧邀你入局 CG',exact:true}).tap();await frame();
    const usableWidth=width-insets.left-insets.right,usableHeight=height-insets.top-insets.bottom;
    assertViewerButtons(await viewerGeometry(),usableWidth,usableHeight);
    await page.getByRole('button',{name:'關閉視窗',exact:true}).click();
  }
  await page.setViewportSize({width:320,height:568});await frame();
  await page.evaluate(count=>{for(let i=1;i<count;i++)window.__responsiveScene.archive.unlock('guest-2',i);},CG_ART['guest-2'].length);
  await page.getByRole('button',{name:'CG 收藏',exact:true}).tap();await roleTab('夏澄').tap();await frame();
  const firstPage=await tileGeometry();assert.ok(firstPage.length<6);
  const nextPage=page.getByRole('button',{name:'CG 收藏下一頁',exact:true}),finale=page.getByRole('button',{name:'回顧夏澄終幕 CG',exact:true});
  while(await nextPage.count()){
    await nextPage.tap();await frame();
    const current=await tileGeometry();assert.ok(current.every(card=>card.width===firstPage[0].width&&card.height===firstPage[0].height&&card.image.width===firstPage[0].image.width));
  }
  await finale.tap();
  await page.screenshot({path:`${output}/xiache-viewer-320x568.png`});
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'上一張已解鎖 CG',exact:true}).tap();
  await page.keyboard.press('Escape');await frame();
  assert.deepEqual(await tileGeometry(),firstPage,'returning from the viewer restores the page of the current stage');
  checks.push({touchPagination:true,firstPageCapacity:firstPage.length});
  for(const [width,height] of [[390,844],[1255,700]]){
    await page.setViewportSize({width,height});
    for(const art of DEALER_CG){
      await page.goto(origin+art.path);await page.locator('#art').waitFor({state:'visible'});
      assert.equal(await page.locator('h1').textContent(),art.name);
      assert.doesNotMatch(await page.locator('body').innerText(),/PNG|透明|長按|Discord|原始尺寸/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const event=page.waitForEvent('download');await page.getByRole('link',{name:'下載圖片',exact:true}).click();const download=await event;
      assert.equal(download.suggestedFilename(),art.filename);
      assert.deepEqual(readFileSync(await download.path()),readFileSync(`public/downloads/yakyuken/dealer-stage-${art.index}.png`));
      await page.screenshot({path:`${output}/download-${width}-${art.slug}.png`});
    }
    checks.push({width,height,downloads:3});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/report.json`,JSON.stringify({ok:true,checks,errors},null,2));
  console.log(JSON.stringify({ok:true,viewports:sizes.length,downloads:6,errors}));
}finally{await browser?.close();await server.close();}
