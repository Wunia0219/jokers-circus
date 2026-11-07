import assert from 'node:assert/strict';
import {Common} from '@discord/embedded-app-sdk';

const gate=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
const variants=['golden-salon','last-spin','curtain-rises'];
const sizes=[[1440,900],[1920,1080],[2560,1080],[1024,768],[844,390],[568,320],
  [768,1024],[650,650],[430,932],[390,844],[375,812],[320,568],[280,800],[1440,900]];
// Key features measured on the portrait masters as normalized image coordinates.
const portraitSubjects={
  'golden-salon':[.10,.16,.90,.63],
  'last-spin':[.18,.17,.94,.72],
  'curtain-rises':[.14,.135,.91,.62],
};

async function verifyLetterRipple(shell){
  const observed=await shell.evaluate(async()=>{
    const letters=[...document.querySelectorAll('.launch-letter')],animations=letters.map(el=>el.getAnimations()[0]);
    if(animations.some(a=>!a))return {count:letters.length,animated:false};
    const saved=animations.map(a=>a.currentTime),timings=animations.map(a=>a.effect.getTiming());
    animations.forEach(a=>a.pause());await Promise.all(animations.map(a=>a.ready));
    const duration=Number(timings[0].duration),until=Math.max(...timings.map(t=>t.delay))+duration/2;
    const peaks=letters.map(()=>({y:0,time:0}));
    for(let time=0;time<=until;time+=duration/100){
      animations.forEach(a=>{a.currentTime=time;});
      letters.forEach((el,i)=>{const y=new DOMMatrix(getComputedStyle(el).transform).m42;if(y<peaks[i].y)peaks[i]={y,time};});
    }
    animations.forEach((a,i)=>{a.currentTime=saved[i];a.play();});
    return {count:letters.length,animated:true,delays:timings.map(t=>t.delay),peaks};
  });
  assert.equal(observed.count,10);assert.equal(observed.animated,true);
  observed.peaks.forEach((peak,i)=>{
    assert.ok(peak.y<-1&&peak.y>-20,'each letter and dot visibly rises by a restrained amount');
    if(i){assert.ok(observed.delays[i]>observed.delays[i-1]);assert.ok(peak.time>observed.peaks[i-1].time,'the wave crest travels from L through all three dots in order');}
  });
  return observed;
}

export async function verifyLaunchScreen({browser,origin,output}){
  const checks=[];
  for(const [index,id] of variants.entries()){
    const startsPortrait=index%2===1;
    const viewport=startsPortrait?{width:390,height:844}:{width:1440,height:900};
    const context=await browser.newContext({viewport}),page=await context.newPage(),token=gate(),wallet=gate(),requests=[];
    try{
      await context.addInitScript(value=>{if(location.pathname==='/')Math.random=()=>value;},(index+.1)/3);
      page.on('request',request=>{
        if(variants.some(name=>new RegExp('/assets/(?:portrait-)?'+name+'-').test(request.url())))requests.push(request.url());
      });
      await page.route('**/api/token',async route=>{await token.promise;await route.continue();});
      await page.route('**/api/playtest/state',async route=>{await wallet.promise;await route.continue();});
      await page.goto(origin+'/__host?who=A&platform='+(startsPortrait?'mobile':'desktop'),{waitUntil:'domcontentloaded'});
      const shell=await (await page.waitForSelector('iframe')).contentFrame();
      await shell.waitForSelector('#launch-screen[data-art-state="ready"]');
      assert.equal(await shell.locator('#launch-screen').getAttribute('data-art'),id);
      const portraitPath='/assets/portrait-'+id+'-',landscapePath='/assets/'+id+'-';
      assert.equal(requests.length,1,'first paint requests only the active orientation');
      assert.ok(requests[0].includes(startsPortrait?portraitPath:landscapePath));
      const {UNLOCKED,PORTRAIT}=Common.OrientationLockStateTypeObject;
      const orientationArgs=state=>({lock_state:state,picture_in_picture_lock_state:state,grid_lock_state:state});
      await page.waitForFunction(()=>__orientations.length===1);
      assert.deepEqual(await page.evaluate(()=>__orientations),[orientationArgs(UNLOCKED)]);
      assert.equal(await shell.locator('.launch-word').innerText(),'LOADING...');assert.equal(await shell.getByRole('progressbar').count(),0);
      assert.equal(await shell.locator('#game').getAttribute('hidden'),'');
      await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'circus:lobby-rendered'},location.origin));
      await shell.evaluate(()=>window.postMessage({type:'circus:lobby-rendered'},location.origin));
      assert.equal(await shell.locator('#launch-screen').getAttribute('data-stage'),'connecting','parent/self messages cannot release the launch screen');
      const before=await shell.locator('.launch-word').boundingBox();
      await shell.waitForFunction(()=>document.querySelector('.launch-wave').getAnimations().some(a=>a.currentTime>100));
      const ripple=index===0?await verifyLetterRipple(shell):null;
      assert.deepEqual(await shell.locator('.launch-word').boundingBox(),before,'individual letters move without shifting the word layout');
      for(const [width,height] of sizes){
        const portrait=width<=height;
        const safeBottom=width===375?34:0;
        await shell.evaluate(bottom=>document.documentElement.style.setProperty('--discord-safe-area-inset-bottom',bottom+'px'),safeBottom);
        await page.setViewportSize({width,height});
        await shell.waitForFunction(({width,height,path})=>{
          const image=document.querySelector('.launch-art');
          return innerWidth===width&&innerHeight===height&&image.complete&&!image.hidden&&image.naturalWidth&&image.currentSrc.includes(path);
        },{width,height,path:portrait?portraitPath:landscapePath});
        const geometry=await shell.evaluate(()=>{
          const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
          const glyphs=[...document.querySelectorAll('.launch-letter')].map(el=>el.getBoundingClientRect());
          const image=document.querySelector('.launch-art');
          const position=getComputedStyle(image).objectPosition.split(' ').map(value=>parseFloat(value)/100);
          return {art:document.querySelector('#launch-screen').dataset.art,frame:box('.launch-art-frame'),image:[image.naturalWidth,image.naturalHeight],position,text:{x:Math.min(...glyphs.map(r=>r.x)),y:Math.min(...glyphs.map(r=>r.y)),right:Math.max(...glyphs.map(r=>r.right)),bottom:Math.max(...glyphs.map(r=>r.bottom))},scroll:document.documentElement.scrollWidth,viewport:innerWidth};
        });
        assert.equal(geometry.art,id);assert.equal(geometry.scroll,geometry.viewport);
        const {text,frame}=geometry;assert.ok(text.x>=0&&text.right<=width&&text.y>=0&&text.bottom<=height-safeBottom,'loading text remains inside each viewport and safe area');
        assert.ok(text.y>=frame.y+frame.height*.82&&text.bottom<=frame.bottom,'loading stays in the artwork dark band');
        assert.ok(frame.x>=-1&&frame.y>=-1&&frame.right<=width+1&&frame.bottom<=height+1);
        const [iw,ih]=geometry.image,scale=Math.max(frame.width/iw,frame.height/ih);
        const visibleX=frame.width/(scale*iw),visibleY=frame.height/(scale*ih);
        if(portrait){
          const [left,top,right,bottom]=portraitSubjects[id];
          const croppedX=(1-visibleX)*geometry.position[0],croppedY=(1-visibleY)*geometry.position[1];
          assert.ok(left>=croppedX&&right<=croppedX+visibleX&&top>=croppedY&&bottom<=croppedY+visibleY,'portrait crop keeps the character and key props visible');
        }else assert.ok(Math.min(visibleX,visibleY)>.995,'landscape keeps the original composition');
        await page.screenshot({path:`${output}/launch-${id}-${width}x${height}.png`});
      }
      assert.equal(new Set(requests).size,2,'resizing only loads both orientations of the selected painting');
      token.release();await shell.waitForSelector('#game:not([hidden])');
      assert.equal(await shell.locator('#game').getAttribute('inert'),'');assert.equal(await shell.locator('#launch-screen').count(),1,'OAuth completion alone does not reveal an unprepared lobby');
      await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'circus:lobby-rendered'},location.origin));
      await shell.evaluate(()=>{window.postMessage({type:'circus:lobby-rendered'},location.origin);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      assert.equal(await shell.locator('#launch-screen').getAttribute('data-stage'),'connecting','only the actual child may declare a rendered lobby while its wallet is still blocked');
      assert.equal(await page.evaluate(()=>__orientations.length),1,'orientation stays unlocked while the lobby is still loading');
      wallet.release();
      const child=await (await shell.waitForSelector('#game')).contentFrame();
      await child.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='games');
      await shell.waitForSelector('#launch-screen',{state:'detached'});
      if(startsPortrait){
        await page.waitForFunction(()=>__orientations.length===2);
        assert.deepEqual(await page.evaluate(()=>__orientations),[orientationArgs(UNLOCKED),orientationArgs(PORTRAIT)]);
      }else assert.deepEqual(await page.evaluate(()=>__orientations),[orientationArgs(UNLOCKED)]);
      assert.equal(await shell.locator('#game').getAttribute('inert'),null);assert.equal(await shell.locator('#game').getAttribute('aria-hidden'),null);
      assert.equal((await page.evaluate(()=>__commands)).filter(x=>x==='HANDSHAKE').length,1);
      checks.push({art:id,viewports:new Set(sizes.map(size=>size.join('x'))).size,selectedArtRequests:requests.length,renderedLobbyBeforeDismissal:true,...(ripple?{letterRipple:ripple}:{})});
    }finally{token.release();wallet.release();await context.close();}
  }
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),token=gate();
  try{
    await page.route('**/api/token',async route=>{await token.promise;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Isolated unavailable login'})});});
    await page.goto(origin+'/__host?who=A&platform=mobile',{waitUntil:'domcontentloaded'});
    const shell=await (await page.waitForSelector('iframe')).contentFrame();await shell.waitForSelector('#launch-screen[data-art-state="ready"]');
    assert.ok(await shell.locator('.launch-wave').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).animationName==='none')));
    assert.ok(await shell.locator('.launch-letter').evaluateAll(elements=>elements.length===10&&elements.every(el=>getComputedStyle(el).animationName==='none'&&getComputedStyle(el).transform==='none')));
    token.release();await shell.waitForSelector('#launch-screen[data-stage="error"]');
    assert.equal(await shell.locator('#launch-screen').getAttribute('data-stage'),'error');assert.equal(await shell.locator('#game').getAttribute('hidden'),'');
    assert.equal(await shell.locator('#launch-screen').getAttribute('aria-busy'),'false');
    await page.screenshot({path:output+'/launch-login-failure.png'});
    assert.match(await shell.locator('.launch-status').innerText(),/關閉活動後重新開啟/);
    await page.unroute('**/api/token');await page.reload({waitUntil:'domcontentloaded'});
    const reloaded=await (await page.waitForSelector('iframe')).contentFrame();await reloaded.waitForSelector('#launch-screen',{state:'detached'});
    checks.push({reducedMotion:true,loginFailureKeepsLobbyBlocked:true,freshLaunchRecovers:true});
  }finally{token.release();await context.close();}
  const fallback=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),fallbackPage=await fallback.newPage();
  try{
    await fallback.addInitScript(()=>{if(location.pathname==='/')Math.random=()=>.5;});
    await fallbackPage.route('**/assets/portrait-last-spin-*.webp',route=>route.abort());
    await fallbackPage.goto(origin+'/__host?who=A&platform=desktop',{waitUntil:'domcontentloaded'});
    const shell=await (await fallbackPage.waitForSelector('iframe')).contentFrame();await shell.waitForSelector('#launch-screen',{state:'detached'});
    const child=await (await shell.waitForSelector('#game:not([hidden])')).contentFrame();await child.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='games');
    checks.push({decorativeArtFailureStillEntersReadyLobby:true});
  }finally{await fallback.close();}
  return checks;
}
