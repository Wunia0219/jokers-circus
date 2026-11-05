import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'vite';
import {launchBrowser} from './helpers/browser.js';
import {buildCGGallery} from '../game/build-cg-gallery.js';
import {DEALER_CG} from '../../src/games/yakyuken/cg-catalog.js';
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
  const context=await browser.newContext({viewport:{width:1255,height:700},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/yakyuken-preview.html');
  await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=()=>page.evaluate(()=>{const body=window.__responsiveScene.modalRoot.children.find(n=>n.label==='archive-dialog'),b=body.hitArea,p=body.getGlobalPosition();return {x:p.x+b.x,y:p.y+b.y,width:b.width,height:b.height};});
  const sizes=[[1255,700],[1255,550],[900,700],[999,700],[1001,700],[1600,900],[1920,1080],[2560,1440],[844,390],[768,1024],[544,680],[390,844],[320,568]];
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await frame();
    await page.getByRole('button',{name:'選擇剪刀',exact:true}).click();await frame();
    const controls=await page.evaluate(()=>{
      const s=window.__responsiveScene,b=s.confirmButton.getBounds(),d=s.statusDetail.getBounds();
      return {caption:s.confirmButton.caption.width,buttonWidth:s.confirmButton.buttonWidth,detailBottom:d.y+d.height,buttonTop:b.y};
    });
    assert.ok(controls.caption<=controls.buttonWidth-20,'button caption fits even in short landscape windows');
    assert.ok(controls.detailBottom<controls.buttonTop,'status never overlaps the confirm button');
    await page.screenshot({path:`${output}/table-${width}x${height}.png`});
    await page.getByRole('button',{name:'CG 收藏',exact:true}).click();await frame();
    const collection=await bounds();
    await page.screenshot({path:`${output}/collection-${width}x${height}.png`});
    await page.getByRole('button',{name:'回顧邀你入局 CG',exact:true}).click();await frame();
    assert.deepEqual(await bounds(),collection,'opening an artwork preserves the exact panel frame');
    await page.screenshot({path:`${output}/viewer-${width}x${height}.png`});
    await page.getByRole('button',{name:'返回 CG 收藏',exact:true}).click();await frame();
    assert.deepEqual(await bounds(),collection,'return preserves the same frame');
    await page.getByRole('button',{name:'關閉視窗',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__responsiveScene.selected),'scissors','gallery navigation and resizing preserve selected card');
    checks.push({width,height,collection});
  }
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
