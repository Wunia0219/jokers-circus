import test from 'node:test';
import assert from 'node:assert/strict';
import {tableLayout,TABLE_MOVES,resultActionLayout} from '../src/games/yakyuken/pixi/layout.js';
import {Motion} from '../src/games/yakyuken/pixi/motion.js';
import {revealCard} from '../src/games/yakyuken/pixi/card-flip.js';
import {slotChrome,SLOT_UI} from '../src/games/yakyuken/pixi/slot-theme.js';
import {slotHeaderLayout,yakyukenHeaderLayout} from '../src/games/yakyuken/pixi/header-layout.js';
import {lobbyLayout} from '../src/games/yakyuken/pixi/lobby-layout.js';
import {CHARACTERS,canEnterCharacter} from '../src/games/yakyuken/characters.js';

test('finished matches offer two separate, touch-sized actions in the same table lane',()=>{
  for(const [width,height] of [[1255,700],[1255,550],[900,700],[1600,900],[2560,1440],[844,390],[600,420],[768,1024],[390,844],[320,568]]){
    const l=tableLayout(width,height),r=resultActionLayout(l),a=r.primary,b=r.secondary;
    for(const button of [a,b]){assert.ok(button.width>=44&&button.height>=44);assert.ok(button.x-button.width/2>=0&&button.x+button.width/2<=width);assert.ok(button.y-button.height/2>=0&&button.y+button.height/2<height);}
    assert.ok(a.x+a.width/2+8<=b.x-b.width/2||a.y+a.height/2+8<=b.y-b.height/2);
    if(l.status.sideBySide)assert.ok(a.y-a.height/2>=l.status.feltTop,`${width}x${height}: result controls stay on the felt`);
  }
});

test('Pixi table: enlarged player hands and mirrored progress/reveal wings fit around the character',() => {
  for(const [width,height,touch] of [[1600,900,false],[1440,1000,false],[1100,800,false],[390,844,true],[320,568,true],[324,699,true],[360,640,true],[360,740,true],[844,390,true],[600,420,true],[700,500,true],[768,1024,true],[544,680,true],[544,680,false]]){
    const l=tableLayout(width,height,{touch});
    assert.equal(l.contentTop-l.ui.headerHeight,40,'balance has its own row without changing the slot identity/tools geometry');
    assert.equal(TABLE_MOVES.length,3);
    const row=l.playerCards,halfWidth=(84+113*row.perspective*.06)*row.scale,halfHeight=(113*row.perspective+84*.06)*row.scale;
    assert.ok(row.x-row.gap-halfWidth>0 && row.x+row.gap+halfWidth<l.w,`${width}x${height}: rotated player cards fit horizontally`);
    assert.ok(row.y-halfHeight-l.confirmedLift>l.top && row.y+halfHeight<l.h,`${width}x${height}: raised player cards fit vertically`);
    const cardBottom=l.playerCards.y+halfHeight;
    assert.ok(cardBottom*l.scale<height,`${width}x${height}: player cards stay inside the viewport`);
    const visibleActor=Math.min(l.dealer.height,(l.table.y-l.table.ry)-l.dealer.y)*l.scale;
    assert.ok(visibleActor>(height-l.contentTop)*.45,`${width}x${height}: the visible character remains the focus below the balance row`);
    assert.equal(l.ui.deck,undefined);
    if(height<550)assert.equal(l.logo.width,0,'compact landscape keeps the progress wing clear of the logo');
    if(l.stackedControls)assert.ok(cardBottom*l.scale<l.status.y-16,`${width}x${height}: cards clear the result text and bottom action`);
    else assert.ok((row.x+row.gap+halfWidth)*l.scale<l.action.x-l.action.width/2,`${width}x${height}: side action cannot cover a player card`);
    const p=l.progress,d=l.dealerCard;
    assert.ok(Math.abs(p.y-d.y*l.scale)<1e-9,'left progress and right reveal share a centre line');
    assert.ok(Math.abs(p.x+d.x*l.scale-width)<1e-9,'wings mirror about the character');
    assert.ok(Math.abs(p.height-214*d.scale*l.scale)<1e-9,'both wings have the same height');
    assert.ok(p.x+p.width/2<width/2 && d.x*l.scale-p.width/2>width/2,'both wings remain beside the character');
    assert.ok(p.x-p.width/2>=0 && d.x*l.scale+84*d.scale*l.scale<width,'wing borders stay in the viewport');
    assert.ok(p.y-p.height/2-30>l.ui.headerHeight,'wing labels clear the header');
    const selectedTop=(l.playerCards.y-l.confirmedLift-halfHeight)*l.scale;
    assert.ok(selectedTop>p.y+p.height/2,`${width}x${height}: raised player card clears the reveal and score`);
    const oldWidth=Math.max(44,Math.min(104,width*.20,(height-l.ui.headerHeight)*.122));
    assert.ok(row.scale*l.scale*156>oldWidth*1.15,'player cards are visibly larger than the previous layout');
  }
  assert.throws(() => tableLayout(0,900));
});

test('tall phones keep the head and shoulder gestures clear of the raised side cards',()=>{
  for(const [width,height] of [[360,800],[375,812],[390,844],[393,852],[412,915],[432,932],[375,1000],[430,1000],[375,1200]]){
    const l=tableLayout(width,height),p=l.progress,actorHeight=l.dealer.height*l.scale,actorTop=l.dealer.y*l.scale;
    assert.ok(actorHeight<=width*2.15,'portrait magnification is limited by phone width');
    assert.ok(p.y+p.height/2+9<actorTop+actorHeight*.10,'both card bottoms clear the shoulder/hand area');
    assert.ok(p.x+p.width/2<width/2-actorHeight*.115,'left card clears the protected head area');
    assert.ok(width-p.x-p.width/2>width/2+actorHeight*.115,'right card clears the protected head area');
    const visibleActor=Math.min(actorHeight,(l.table.y-l.table.ry)*l.scale-actorTop);
    assert.ok(visibleActor>(height-l.contentTop)*.45,'width fitting still gives the character enough visible height below the balance row');
  }
  const a=tableLayout(390,844),b=tableLayout(391,845);
  assert.ok(Math.abs(a.dealer.height*a.scale-b.dealer.height*b.scale)<5);
  assert.ok(Math.abs(a.progress.y-b.progress.y)<2,'nearby phone sizes do not jump between layouts');
});

test('wide tables scale the actor, wings and hand as a single composition across Discord window sizes',()=>{
  const ratios=[];
  for(const [width,height] of [[1255,700],[1255,550],[900,700],[999,700],[1000,700],[1001,700],[1200,600],[1600,900],[1920,1080],[2560,1440],[844,390]]){
    const l=tableLayout(width,height),s=l.scale,actor=l.dealer.height*s,card=l.playerCards.scale*s;
    assert.equal(l.mode,'wide');assert.equal(l.stackedControls,false);
    ratios.push([actor/card,l.progress.width/card,(l.playerCards.y-(l.table.y-l.table.ry))*s/card]);
    assert.ok(l.action.y+l.action.height/2<height);
  }
  for(const row of ratios)row.forEach((value,i)=>assert.ok(Math.abs(value-ratios[0][i])<1e-8,'relative artwork scale and table spacing remain constant'));
  assert.equal(tableLayout(390,844).mode,'narrow');
  assert.equal(tableLayout(768,1024).mode,'narrow');
});

test('Pixi Yakyuken chrome: slot-sized header preserves readable typography without a bottom deck',()=>{
  const desktop=slotChrome(1600,900),phone=slotChrome(390,844,true);
  assert.equal(desktop.headerHeight,80);assert.equal(desktop.deck,undefined);
  assert.equal(phone.headerHeight,132);assert.equal(phone.deck,undefined);
  assert.deepEqual(SLOT_UI.font,['Noto Sans TC','sans-serif']);assert.equal(SLOT_UI.utilitySize,48);
  assert.equal(SLOT_UI.bodySize,13);assert.equal(SLOT_UI.dialogTitleSize,19);
});

test('desktop content grows with available space and stays continuous across nearby viewport sizes',()=>{
  let previous;
  for(const width of [1000,1100,1400,1499,1500,1600,1920,2560]){
    const height=Math.round(width*9/16),table=tableLayout(width,height),menu=lobbyLayout(width,height,table.ui.headerHeight).character;
    assert.ok(table.selectedLift*table.scale>=20,'selected card has a clear lift before confirmation');
    assert.ok(table.confirmedLift>=table.selectedLift,'confirmation cannot lower the selected card');
    assert.ok(menu.enterY+menu.buttonHeight/2<height);
    assert.ok(menu.panel.x+menu.panel.width/2<=width);
    if(width>=1920){
      assert.ok(table.progress.width>=300,'large desktop side panels use the available room');
      assert.ok(menu.slots[0].width>=130 && menu.buttonWidth>=400,'selection controls enlarge with the scene');
    }
    if(previous){
      assert.ok(table.progress.width>=previous.wing,'a larger screen cannot shrink the wings');
      if(width-previous.width===1){
        assert.ok(Math.abs(table.progress.width/previous.wing-1)<.003);
        assert.ok(Math.abs(menu.slots[0].width/previous.slot-1)<.003);
      }
    }
    previous={width,wing:table.progress.width,slot:menu.slots[0].width};
  }
});

test('Yakyuken shares slot avatar, checkin and five 48px tools at every viewport, without a logo',()=>{
  for(const [width,height] of [[320,568],[390,844],[544,680],[768,1024],[844,390],[1600,900]]){
    const h=yakyukenHeaderLayout(width,height);
    assert.deepEqual(h,slotHeaderLayout(width,height));
    assert.equal(h.headerHeight,slotChrome(width,height).headerHeight);
    assert.equal(h.centers.length,5);assert.equal(h.logoWidth,0);
    assert.ok(h.toolsY>=0 && h.toolsY+h.toolsHeight<=h.headerHeight);
    assert.ok(h.left+h.avatarSize+8<h.checkin.x,'identity stays separate from checkin');
    h.centers.forEach((x,i)=>{
      assert.ok(x-24>=0 && x+24<=width);
      if(i)assert.ok(x-h.centers[i-1]>=56,'48px controls retain at least 8px clear gaps');
    });
  }
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
