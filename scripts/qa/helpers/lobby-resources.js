import assert from 'node:assert/strict';

// Run real Pixi allocation and image decoding; only the failure timing is injected.
export async function verifyLobbyResources(browser,origin){
  const checks=[];
  for(const options of [
    {name:'partial-image-failure',failAsset:true,holdAsset:true},
    {name:'abort-during-image',holdAsset:true,abort:true},
    {name:'renderer-failure',failRenderer:true},
    {name:'abort-during-renderer',holdRenderer:true,abort:true},
    {name:'normal-disposal-and-cover'},
  ]){
    const context=await browser.newContext(),page=await context.newPage();
    try{
      await page.addInitScript(options=>{globalThis.lobbyOptions=options;},options);
      await page.route(origin+'/__lobby-resources',route=>route.fulfill({contentType:'text/html',body:
        '<div id="host" style="width:800px;height:600px"></div><script type="module" src="/tests/fixtures/lobby-resources.js"></script>'}));
      await page.goto(origin+'/__lobby-resources');
      await page.waitForFunction(()=>!!globalThis.lobbyFixture);
      if(options.holdAsset||options.holdRenderer){
        await page.waitForFunction(phase=>globalThis.lobbyPhase===phase,options.holdAsset?'asset':'renderer');
        if(options.abort)await page.evaluate(()=>lobbyFixture.abort());
        await page.evaluate(()=>lobbyFixture.release());
      }
      const result=await page.evaluate(()=>lobbyFixture.result);
      assert.equal(result,options.abort?'aborted':options.failAsset?'isolated image failure':options.failRenderer?'isolated renderer failure':'ready');
      if(result==='ready'){
        await page.evaluate(()=>lobbyFixture.loadCover());
        assert.equal((await page.evaluate(()=>lobbyFixture.state())).live,5);
        await page.evaluate(()=>lobbyFixture.abort());
      }
      await page.waitForFunction(()=>lobbyFixture.state().live===0);
      assert.deepEqual(await page.evaluate(()=>lobbyFixture.state()),{live:0,canvas:0,renderer:false});
      checks.push(options.name);
    }finally{await context.close();}
  }
  return checks;
}
