import assert from 'node:assert/strict';

export async function verifyYakyukenPrefetch({page,holdHand,dropHandResponse,handRequests,serverWallet,otherHand,output}){
  const requestStarted=async gate=>{
    let timer;
    try{await Promise.race([gate.started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Expected hand request did not start')),30000);})]);}
    finally{clearTimeout(timer);}
  };
  const scene=()=>page.evaluate(()=>{
    const s=window.__rewardScene;
    return {phase:s.phase,front:s.dealerCards[0]?.faceUp,stage:s.dealerStage,balance:s.balanceNumber.text,
      pose:s.pose,pending:s.wallet.pending,enabled:s.confirmButton.enabled,reward:s.rewardPresentation.stage,
      ticket:s.wallet.nextHand,round:s.completedRounds};
  });
  const selecting=()=>page.waitForFunction(()=>window.__rewardScene.phase==='selecting'&&!window.__rewardScene.entering);
  const confirmed=()=>page.waitForFunction(()=>{const s=window.__rewardScene;return s.phase==='confirmed'&&!s.changing&&!s.rewardPresentation.busy;});
  const choose=()=>page.getByRole('button',{name:'選擇拳頭',exact:true}).click();
  const confirm=()=>page.getByRole('button',{name:'確認出牌',exact:true}).click();
  await page.setViewportSize({width:375,height:812});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await selecting();
  const before=serverWallet().balance;
  assert.equal((await scene()).ticket.index,0);assert.equal((await scene()).ticket.outcome,'win');
  await page.emulateMedia({reducedMotion:'no-preference'});await choose();
  await page.getByRole('button',{name:'確認出牌',exact:true}).waitFor();
  await page.evaluate(()=>{const s=window.__rewardScene;s.motion.finish();s.app.stop();});
  const gate=holdHand();await confirm();await requestStarted(gate);
  const planned=await page.evaluate(()=>[...window.__rewardScene.motion.tasks].map(t=>t.duration).sort((a,b)=>a-b));
  assert.deepEqual(planned,[150,240,280],'player lift, dealer lift and flip begin together, before the blocked settlement');
  assert.equal(serverWallet().records[0].wins,0);
  await page.evaluate(async()=>{const s=window.__rewardScene;s.motion.tick(150);await Promise.resolve();s.app.render();});
  assert.equal((await scene()).front,true,'dealer face is visible at the close-half deadline');
  const opening=await page.evaluate(()=>[...window.__rewardScene.motion.tasks].find(t=>t.target===window.__rewardScene.dealerCards[0].visual.scale)?.duration);
  assert.equal(opening,180);
  await page.evaluate(async()=>{const s=window.__rewardScene;s.motion.tick(180);await Promise.resolve();s.app.render();});
  await page.waitForFunction(()=>window.__rewardScene.phase==='confirming');
  const revealed=await scene();assert.equal(revealed.front,true);assert.equal(revealed.stage,'shown');
  assert.equal(revealed.balance,before.toLocaleString('en-US'));assert.equal(revealed.pose,0);assert.equal(revealed.enabled,false);assert.equal(revealed.reward,'idle');
  const count=handRequests.length;await page.keyboard.press('Enter');assert.equal(handRequests.length,count,'repeated input cannot submit another hand');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>window.__rewardScene.layout.ui.width===390);
  await page.evaluate(()=>{const s=window.__rewardScene;s.pause();s.resume();s.app.stop();});
  assert.equal((await scene()).front,true);assert.equal((await scene()).round,1);assert.equal(handRequests.length,count);
  await page.screenshot({path:output+'/prefetch-before-settlement.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__rewardScene.app.start());
  gate.release();await confirmed();assert.equal((await scene()).ticket.index,1);assert.equal(serverWallet().balance,before);

  await page.getByRole('button',{name:'下一拳',exact:true}).click();await selecting();
  dropHandResponse();await choose();await confirm();
  await page.waitForFunction(()=>window.__rewardScene.phase==='retrying');
  const uncertain=await scene(),original=handRequests.at(-1);
  assert.equal(uncertain.front,true);assert.equal(uncertain.pose,1);assert.equal(uncertain.reward,'idle');
  assert.equal(uncertain.balance,before.toLocaleString('en-US'));assert.equal(uncertain.pending.body.handIndex,1);
  assert.equal(serverWallet().balance,before+2500);
  await page.getByRole('button',{name:'重試上一拳',exact:true}).click();await confirmed();
  assert.deepEqual(handRequests.at(-1),original,'retry retains the move, index and request ID');
  assert.equal(serverWallet().balance,before+2500);assert.equal((await scene()).balance,(before+2500).toLocaleString('en-US'));

  await page.getByRole('button',{name:'再次挑戰',exact:true}).click();await selecting();
  // Negative control: without an authoritative next-hand packet, no result may
  // be invented while the request is blocked (also covers pre-deploy matches).
  await page.evaluate(()=>{window.__rewardScene.wallet.nextHand=null;});
  const missing=holdHand();await choose();await confirm();await requestStarted(missing);
  assert.equal((await scene()).phase,'requesting');assert.equal((await scene()).front,false);
  missing.release();await confirmed();
  await page.getByRole('button',{name:'下一拳',exact:true}).click();await selecting();
  const stale=(await scene()).ticket,paidBalance=serverWallet().balance;
  await otherHand(stale);assert.equal(serverWallet().balance,paidBalance+2500);
  await choose();await confirm();await page.getByRole('button',{name:'重新同步',exact:true}).waitFor();
  assert.equal((await scene()).pending,null,'a definitive stale-ticket rejection is not a new pending throw');
  await page.getByRole('button',{name:'重新同步',exact:true}).click();
  await page.waitForFunction(()=>window.__rewardScene.screen==='characters'&&!window.__rewardScene.settling);
  assert.equal(serverWallet().balance,paidBalance+2500,'resync charges no fee and awards no second prize');
  return 'prefetched hand flips in the planned 330ms before settlement; delayed response, resize/background, missing packet, original retry and stale-device conflict retain authoritative money';
}
