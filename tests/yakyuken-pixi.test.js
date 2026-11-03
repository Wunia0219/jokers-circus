import test from 'node:test';
import assert from 'node:assert/strict';
import {tableLayout,TABLE_MOVES} from '../src/games/yakyuken/pixi/layout.js';
import {Motion} from '../src/games/yakyuken/pixi/motion.js';
import {demoDuel} from '../src/games/yakyuken/pixi/demo-duel.js';
import {revealCard} from '../src/games/yakyuken/pixi/card-flip.js';
import {slotChrome,SLOT_UI} from '../src/games/yakyuken/pixi/slot-theme.js';
import {slotHeaderLayout} from '../src/games/yakyuken/pixi/header-layout.js';
import {lobbyLayout} from '../src/games/yakyuken/pixi/lobby-layout.js';
import {CHARACTERS,canEnterCharacter} from '../src/games/yakyuken/characters.js';

test('Pixi table: both rows fit a smaller table, with a prominent character and no control deck',() => {
  for(const [width,height,touch] of [[1600,900,false],[1440,1000,false],[390,844,true],[320,568,true],[844,390,true],[768,1024,true],[544,680,true],[544,680,false]]){
    const l=tableLayout(width,height,{touch});
    assert.equal(TABLE_MOVES.length,3);
    for(const row of [l.dealerCards,l.playerCards]){
      const halfWidth=84*row.scale,halfHeight=113*row.scale*.84;
      assert.ok(row.x-row.gap-halfWidth>0 && row.x+row.gap+halfWidth<l.w,`${width}x${height}: horizontal card bounds`);
      assert.ok(row.y-halfHeight>l.top && row.y+halfHeight<l.h,`${width}x${height}: vertical card bounds`);
    }
    const cardBottom=l.playerCards.y+113*l.playerCards.scale*.84+6;
    assert.ok(cardBottom*l.scale<height,`${width}x${height}: player cards stay inside the viewport`);
    assert.ok(l.dealer.height*l.scale*.44>(height-l.ui.headerHeight)*.45,`${width}x${height}: character remains the focus`);
    assert.equal(l.ui.deck,undefined);
    if(l.ui.mobile)assert.ok(cardBottom*l.scale<l.action.y-l.action.height/2,`${width}x${height}: cards clear the standalone action`);
    assert.ok(l.dealerCards.scale<l.playerCards.scale,'far cards preserve depth');
    const farBottom=l.dealerCards.y+113*l.dealerCards.scale*.84;
    const selectedTop=l.playerCards.y-l.confirmedLift-113*l.playerCards.scale*.84;
    assert.ok(selectedTop>=farBottom,`${width}x${height}: confirmed player card must not cover dealer cards`);
  }
  assert.throws(() => tableLayout(0,900));
});

test('Pixi shared chrome: retains the slot header and font families without a bottom deck',()=>{
  const desktop=slotChrome(1600,900),phone=slotChrome(390,844,true);
  assert.equal(desktop.headerHeight,80);assert.equal(desktop.deck,undefined);
  assert.equal(phone.headerHeight,132);assert.equal(phone.deck,undefined);
  assert.deepEqual(SLOT_UI.font,['Noto Sans TC','sans-serif']);assert.equal(SLOT_UI.utilitySize,48);
  assert.equal(SLOT_UI.bodySize,13);assert.equal(SLOT_UI.dialogTitleSize,19);
});

test('Pixi lobby: two game choices and five character positions fit desktop and narrow viewports',()=>{
  for(const [width,height] of [[1600,900],[390,844],[320,568],[844,390],[768,1024],[544,680]]){
    const {headerHeight}=slotChrome(width,height),l=lobbyLayout(width,height,headerHeight);
    assert.equal(l.games.length,2);assert.equal(l.character.slots.length,5);
    for(const r of l.character.slots)assert.ok(r.y-r.height/2>=headerHeight,'character controls clear the game header');
    for(const r of l.games)assert.ok(Math.abs(r.width/r.height-1.5)<1e-9,'generated cover and lettering keep their 3:2 proportions');
    for(const r of [...l.games,...l.character.slots]){
      assert.ok(r.width>=44 && r.height>=44,'interactive choices retain touch targets');
      assert.ok(r.x-r.width/2>=0 && r.x+r.width/2<=width);
      assert.ok(r.y-r.height/2>=0 && r.y+r.height/2<=height);
    }
    assert.ok(l.character.art.height>0);
    assert.ok(l.character.enterY+22<=height);
  }
  assert.equal(CHARACTERS.length,5);assert.equal(CHARACTERS.filter(c=>c.enabled).length,1);
  assert.equal(canEnterCharacter('dealer'),true);
  for(const id of ['guest-1','guest-4','unknown',null])assert.equal(canEnterCharacter(id),false);
});

test('Pixi card flip: back stays visible until edge-on, then only the selected face is revealed',async()=>{
  const motion=new Motion(),scale={x:1};let faceUp=false,shownAt;
  const pending=revealCard({motion,scale,showFront:()=>{faceUp=true;shownAt=scale.x;}});
  motion.tick(100);assert.equal(faceUp,false);assert.ok(scale.x>.035);
  motion.tick(50);await Promise.resolve();assert.equal(faceUp,true);assert.ok(Math.abs(shownAt-.035)<1e-9);
  motion.tick(180);assert.equal(await pending,true);assert.equal(scale.x,1);
});

test('Pixi card flip: a disposed card cannot reveal late, and reduced motion leaves no collapsed face',async()=>{
  const motion=new Motion(),scale={x:1};let alive=true,shown=0;
  const canceled=revealCard({motion,scale,showFront:()=>shown++,isValid:()=>alive});alive=false;motion.tick(150);
  assert.equal(await canceled,false);assert.equal(shown,0);
  motion.reduced=true;const immediate={x:1};
  assert.equal(await revealCard({motion,scale:immediate,showFront:()=>shown++}),true);
  assert.equal(immediate.x,1);assert.equal(shown,1);
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


test('shared header controls and UI-only checkin fit 320px through desktop without overlap',()=>{
  for(const [width,height] of [[320,568],[390,844],[544,680],[768,1024],[844,390],[1600,900]]){
    const h=slotHeaderLayout(width,height),c=h.checkin;
    assert.ok(c.x>=0 && c.x+c.width<=width);
    assert.ok(c.y>=0 && c.y+c.height<=slotChrome(width,height).headerHeight);
    h.centers.forEach((x,i)=>{
      assert.ok(x-24>=0 && x+24<=width);
      if(i)assert.ok(x-h.centers[i-1]>=48,'48px controls never overlap');
    });
    if(!h.narrow)assert.ok(c.x+c.width+12<=h.toolsX);
  }
});
