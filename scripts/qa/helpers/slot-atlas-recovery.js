import assert from 'node:assert/strict';

// Install the failure and response observer immediately around slot entry.
// Time spent in the lobby, Yakyuken or CG downloads does not consume this wait.
export async function verifySlotAtlasRecovery(page,enterSlot){
  const asset=/\/assets\/win-018-[^/]+\.webp$/;
  let attempts=0;
  const responses=[],started=performance.now();
  const onResponse=response=>{if(asset.test(response.url()))responses.push({status:response.status(),elapsedMs:Math.round(performance.now()-started)});};
  const route=intercept=>{attempts++;return attempts===1?intercept.fulfill({status:503,contentType:'text/plain',body:'isolated transient image failure'}):intercept.continue();};
  await page.route(asset,route);page.on('response',onResponse);
  try{
    await Promise.all([
      page.waitForResponse(response=>asset.test(response.url())&&response.status()===200,{timeout:60000}),
      Promise.resolve().then(enterSlot),
    ]);
    assert.equal(attempts,2,'one transient atlas failure is retried once');
    assert.deepEqual(responses.map(response=>response.status),[503,200],'the injected failure must recover successfully');
    return {attempts,responses};
  }catch(error){error.atlasRecovery={attempts,responses};throw error;}
  finally{page.off('response',onResponse);await page.unroute(asset,route);}
}
