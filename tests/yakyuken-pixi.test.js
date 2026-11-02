import test from 'node:test';
import assert from 'node:assert/strict';
import {tableLayout,TABLE_MOVES} from '../src/games/yakyuken/pixi/layout.js';
import {Motion} from '../src/games/yakyuken/pixi/motion.js';
import {demoDuel} from '../src/games/yakyuken/pixi/demo-duel.js';

test('Pixi table: both rows remain inside the viewport and player cards stay above the action rail',() => {
  for(const [width,height] of [[1600,900],[1440,1000],[390,844],[320,568],[844,390],[768,1024],[544,680]]){
    const l=tableLayout(width,height);
    assert.equal(TABLE_MOVES.length,3);
    for(const row of [l.dealerCards,l.playerCards]){
      const halfWidth=84*row.scale,halfHeight=113*row.scale*.84;
      assert.ok(row.x-row.gap-halfWidth>0 && row.x+row.gap+halfWidth<l.w,`${width}x${height}: horizontal card bounds`);
      assert.ok(row.y-halfHeight>l.top && row.y+halfHeight<l.h,`${width}x${height}: vertical card bounds`);
    }
    const cardBottom=l.playerCards.y+113*l.playerCards.scale*.84+6;
    assert.ok(cardBottom<l.h-(l.portrait?210:118),`${width}x${height}: player cards clear the action rail`);
    assert.ok(l.dealerCards.scale<l.playerCards.scale,'far cards preserve depth');
    const farBottom=l.dealerCards.y+113*l.dealerCards.scale*.84;
    const selectedTop=l.playerCards.y-32-113*l.playerCards.scale*.84;
    assert.ok(selectedTop>=farBottom,`${width}x${height}: confirmed player card must not cover dealer cards`);
  }
  assert.throws(() => tableLayout(0,900));
});

test('Pixi motion: actual elapsed time completes a movement even after a slow frame',async () => {
  const motion=new Motion(),object={x:0};const completed=motion.to(object,{x:20},200);
  motion.tick(20);assert.ok(object.x>0 && object.x<20);
  motion.tick(500);assert.equal(await completed,true);assert.equal(object.x,20);assert.equal(motion.tasks.size,0);
});

test('Pixi motion: replacement resolves the canceled operation; pause/dispose cannot leave a pending animation',async () => {
  const motion=new Motion(),object={x:0};
  const old=motion.to(object,{x:10},100),next=motion.to(object,{x:30},100);
  assert.equal(await old,false);motion.finish();assert.equal(await next,true);assert.equal(object.x,30);
  const closing=motion.to(object,{x:40},100);motion.destroy();assert.equal(await closing,true);
  assert.equal(await motion.to(object,{x:90}),false);assert.equal(object.x,40);
});

test('Pixi motion: background suspension also finishes the next step of an awaited sequence',async () => {
  const motion=new Motion(),object={x:0};
  const sequence=(async () => {await motion.to(object,{x:10},100);await motion.to(object,{x:20},100);})();
  motion.suspended=true;motion.finish();await sequence;
  assert.equal(object.x,20);assert.equal(motion.tasks.size,0);
});

test('Pixi demonstration: the dealer rotates independently of player choice and resolves all nine matchups',() => {
  const expected=[['scissors',{rock:'win',scissors:'draw',paper:'loss'}],['rock',{rock:'draw',scissors:'loss',paper:'win'}],['paper',{rock:'loss',scissors:'win',paper:'draw'}]];
  expected.forEach(([dealer,outcomes],index) => {
    for(const [player,outcome] of Object.entries(outcomes)){
      assert.deepEqual(demoDuel(index,player),{player,dealer,outcome});
      assert.deepEqual(demoDuel(index+3,player),{player,dealer,outcome});
    }
  });
  assert.throws(() => demoDuel(-1,'rock'));assert.throws(() => demoDuel(0,'invalid'));
});
