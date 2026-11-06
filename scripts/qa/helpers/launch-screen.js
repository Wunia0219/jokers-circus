import assert from 'node:assert/strict';

const gate=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
const variants=['golden-salon','last-spin','curtain-rises'];
const sizes=[[1440,900],[1255,700],[844,390],[390,844],[320,568]];

export async function verifyLaunchScreen({browser,origin,output}){
  const checks=[];
  for(const [index,id] of variants.entries()){
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),token=gate(),wallet=gate(),requests=[];
    try{
      await context.addInitScript(value=>{if(location.pathname==='/')Math.random=()=>value;},(index+.1)/3);
      page.on('request',request=>{if(variants.some(name=>request.url().includes('/assets/'+name+'-')))requests.push(request.url());});
      await page.route('**/api/token',async route=>{await token.promise;await route.continue();});
      await page.route('**/api/playtest/state',async route=>{await wallet.promise;await route.continue();});
      await page.goto(origin+'/__host?who=A&platform=desktop',{waitUntil:'domcontentloaded'});
      const shell=await (await page.waitForSelector('iframe')).contentFrame();
      await shell.waitForSelector('#launch-screen[data-art-state="ready"]');
      assert.equal(await shell.locator('#launch-screen').getAttribute('data-art'),id);
      assert.equal(await shell.locator('.launch-word').innerText(),'LOADING...');assert.equal(await shell.getByRole('progressbar').count(),0);
      assert.equal(await shell.locator('#game').getAttribute('hidden'),'');
      await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'circus:lobby-rendered'},location.origin));
      await shell.evaluate(()=>window.postMessage({type:'circus:lobby-rendered'},location.origin));
      assert.equal(await shell.locator('#launch-screen').getAttribute('data-stage'),'connecting','parent/self messages cannot release the launch screen');
      const before=await shell.locator('.launch-word').boundingBox();
      await shell.waitForFunction(()=>document.querySelector('.launch-wave').getAnimations().some(a=>a.currentTime>100));
      assert.deepEqual(await shell.locator('.launch-word').boundingBox(),before,'only the background wave moves, never the lettering');
      for(const [width,height] of sizes){
        await page.setViewportSize({width,height});
        await shell.waitForFunction(w=>innerWidth===w,width);
        const geometry=await shell.evaluate(()=>{
          const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
          return {art:document.querySelector('#launch-screen').dataset.art,frame:box('.launch-art-frame'),text:box('.launch-word'),scroll:document.documentElement.scrollWidth,viewport:innerWidth};
        });
        assert.equal(geometry.art,id);assert.equal(geometry.scroll,geometry.viewport);
        const {text,frame}=geometry;assert.ok(text.x>=0&&text.right<=width&&text.y>=0&&text.bottom<=height,'loading text remains inside each viewport');
        assert.ok(text.y>=frame.y+frame.height*.82&&text.bottom<=frame.bottom,'loading stays in the artwork dark band');
        await page.screenshot({path:`${output}/launch-${id}-${width}x${height}.png`});
      }
      assert.equal(new Set(requests).size,1,'resize fetches no alternative backgrounds');
      assert.equal(requests.length,1,'the selected background is loaded once');
      token.release();await shell.waitForSelector('#game:not([hidden])');
      assert.equal(await shell.locator('#game').getAttribute('inert'),'');assert.equal(await shell.locator('#launch-screen').count(),1,'OAuth completion alone does not reveal an unprepared lobby');
      await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'circus:lobby-rendered'},location.origin));
      await shell.evaluate(()=>{window.postMessage({type:'circus:lobby-rendered'},location.origin);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      assert.equal(await shell.locator('#launch-screen').getAttribute('data-stage'),'connecting','only the actual child may declare a rendered lobby while its wallet is still blocked');
      wallet.release();
      const child=await (await shell.waitForSelector('#game')).contentFrame();
      await child.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='games');
      await shell.waitForSelector('#launch-screen',{state:'detached'});
      assert.equal(await shell.locator('#game').getAttribute('inert'),null);assert.equal(await shell.locator('#game').getAttribute('aria-hidden'),null);
      assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1);
      checks.push({art:id,viewports:sizes.length,selectedArtRequests:requests.length,renderedLobbyBeforeDismissal:true});
    }finally{token.release();wallet.release();await context.close();}
  }
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),token=gate();
  try{
    await page.route('**/api/token',async route=>{await token.promise;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Isolated unavailable login'})});});
    await page.goto(origin+'/__host?who=A&platform=mobile',{waitUntil:'domcontentloaded'});
    const shell=await (await page.waitForSelector('iframe')).contentFrame();await shell.waitForSelector('#launch-screen[data-art-state="ready"]');
    assert.ok(await shell.locator('.launch-wave').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).animationName==='none')));
    token.release();await shell.waitForSelector('#launch-screen[data-stage="error"]');
    assert.equal(await shell.locator('#launch-screen').getAttribute('data-stage'),'error');assert.equal(await shell.locator('#game').getAttribute('hidden'),'');
    assert.equal(await shell.locator('#launch-screen').getAttribute('aria-busy'),'false');
    await page.screenshot({path:output+'/launch-login-failure.png'});
    assert.match(await shell.locator('.launch-status').innerText(),/關閉活動後重新開啟/);
    await page.unroute('**/api/token');await page.reload({waitUntil:'domcontentloaded'});
    const reloaded=await (await page.waitForSelector('iframe')).contentFrame();await reloaded.waitForSelector('#launch-screen',{state:'detached'});
    checks.push({reducedMotion:true,loginFailureKeepsLobbyBlocked:true,freshLaunchRecovers:true});
  }finally{token.release();await context.close();}
  const fallback=await browser.newContext({viewport:{width:1255,height:700},reducedMotion:'reduce'}),fallbackPage=await fallback.newPage();
  try{
    await fallback.addInitScript(()=>{if(location.pathname==='/')Math.random=()=>.5;});
    await fallbackPage.route('**/assets/last-spin-*.webp',route=>route.abort());
    await fallbackPage.goto(origin+'/__host?who=A&platform=desktop',{waitUntil:'domcontentloaded'});
    const shell=await (await fallbackPage.waitForSelector('iframe')).contentFrame();await shell.waitForSelector('#launch-screen',{state:'detached'});
    const child=await (await shell.waitForSelector('#game:not([hidden])')).contentFrame();await child.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='games');
    checks.push({decorativeArtFailureStillEntersReadyLobby:true});
  }finally{await fallback.close();}
  return checks;
}
