import test from 'node:test';
import assert from 'node:assert/strict';
import {RewardPresentation,REWARD_SHOWCASE_MS,REWARD_COUNT_MS,REWARD_FADE_MS} from '../src/games/yakyuken/reward-presentation.js';

test('reward holds the credited portion until the final outfit and its reading time complete',()=>{
  const r=new RewardPresentation(),settled={id:'match-1',after:11500,reward:2500};
  assert.equal(r.hold(settled),true);r.tick(10000);
  assert.equal(r.frame(11500).balance,9000);assert.equal(r.frame(11500).visible,false);assert.equal(r.busy,true);
  r.reveal();r.tick(REWARD_SHOWCASE_MS-1);
  assert.equal(r.frame(11500).balance,9000);assert.equal(r.frame(11500).visible,false);
  r.tick(1);assert.equal(r.stage,'counting');assert.equal(r.frame(11500).amount,0);
  r.tick(REWARD_COUNT_MS/2);
  const middle=r.frame(11500);assert.ok(middle.amount>0&&middle.amount<2500);assert.equal(middle.balance,9000+middle.amount);
  r.tick(REWARD_COUNT_MS/2);assert.equal(r.busy,false);assert.equal(r.frame(11500).amount,2500);assert.equal(r.frame(11500).balance,11500);
  assert.deepEqual(settled,{id:'match-1',after:11500,reward:2500},'presentation never changes settlement data');
  r.tick(REWARD_FADE_MS);assert.equal(r.stage,'idle');assert.equal(r.frame(11500).visible,false);
});

test('reward cannot replay a settled match or replace an active count with the same response',()=>{
  const r=new RewardPresentation();r.hold({id:'one',after:11500,reward:2500});r.reveal();r.tick(700);
  const before=r.frame(11500);assert.equal(r.hold({id:'one',after:11500,reward:2500}),false);assert.deepEqual(r.frame(11500),before);
  r.tick(10000);assert.equal(r.frame(11500).balance,11500);assert.equal(r.hold({id:'one',after:11500,reward:2500}),false);
  r.clear();assert.equal(r.hold({id:'two',after:13000,reward:2500}),true);assert.equal(r.frame(13000).balance,10500);
});

test('a slow frame completes counting exactly; later wallet credits remain authoritative',()=>{
  const r=new RewardPresentation();r.hold({id:'one',after:11500,reward:2500});r.reveal();r.tick(REWARD_SHOWCASE_MS+REWARD_COUNT_MS);
  assert.equal(r.stage,'settled');assert.equal(r.frame(12000).balance,12000);assert.equal(r.frame(12000).amount,2500);
  r.tick(10000);assert.equal(r.frame(12000).balance,12000);assert.equal(r.frame(12000).visible,false);
  const late=new RewardPresentation();late.hold({id:'late',after:11500,reward:2500});late.reveal();late.tick(10000);
  assert.equal(late.frame(11500).visible,true,'a stalled frame cannot skip the final gain entirely');assert.equal(late.frame(11500).amount,2500);
});

test('reduced motion still waits for the outfit, then shows a static final gain',()=>{
  const r=new RewardPresentation();r.hold({id:'one',after:11500,reward:2500});r.tick(10000,{reduced:true});assert.equal(r.stage,'holding');
  r.reveal();r.tick(REWARD_SHOWCASE_MS-1,{reduced:true});assert.equal(r.frame(11500).balance,9000);
  r.tick(1,{reduced:true});const frame=r.frame(11500,{reduced:true});assert.equal(frame.balance,11500);assert.equal(frame.amount,2500);assert.equal(frame.lift,0);assert.equal(frame.visible,true);
});

test('invalid awards cannot mask the wallet, and closing the presentation discards only visual state',()=>{
  const r=new RewardPresentation();
  for(const award of [{id:'x',after:100,reward:2500},{id:'x',after:11500,reward:0},{id:'x',after:NaN,reward:2500},{id:'x',after:11500,reward:1.5}])assert.equal(r.hold(award),false);
  assert.equal(r.frame(11500).balance,11500);r.hold({id:'valid',after:11500,reward:2500});r.clear();assert.equal(r.frame(11500).balance,11500);assert.equal(r.busy,false);
});
