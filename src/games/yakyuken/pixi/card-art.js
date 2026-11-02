import {Container,FillGradient,Graphics} from 'pixi.js';
import {label} from './ui.js';
import {TABLE_MOVE_NAMES} from './layout.js';

const gradient=(a,b,c)=>new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:a},{offset:.48,color:b},{offset:1,color:c}]});
const GOLD=()=>gradient(0xffedaf,0xd6a34c,0x80501f);

function gem(x,y,r=7) {
  const g=new Graphics().poly([x,y-r,x+r,y,x,y+r,x-r,y]).fill(0x86152c).stroke({color:0xf9d68b,width:1});
  g.poly([x,y-r,x+r,y,x,y]).fill(0xe65859);g.poly([x-r,y,x,y,x,y+r]).fill(0xb32839);return g;
}

function frame(back=false) {
  const g=new Graphics().roundRect(-78,-107,156,214,12).fill(GOLD()).stroke({width:1,color:0xffe2a0});
  g.roundRect(-73,-102,146,204,9).fill(0x472126).stroke({width:1,color:0x845125});
  g.roundRect(-69,-98,138,196,7).fill(gradient(back?0x6c2037:0x30233f,back?0x381529:0x17192d,0x111226)).stroke({width:1.5,color:0xe5b663});
  g.roundRect(-63,-92,126,184,5).stroke({width:1,color:0xf7d78a,alpha:.42});
  for(const direction of [-1,1]){
    g.moveTo(direction*70,-84).bezierCurveTo(direction*51,-107,direction*38,-92,direction*55,-86)
      .bezierCurveTo(direction*67,-82,direction*56,-70,direction*49,-80).stroke({color:0xffd483,width:2});
    g.moveTo(direction*70,84).bezierCurveTo(direction*51,107,direction*38,92,direction*55,86)
      .bezierCurveTo(direction*67,82,direction*56,70,direction*49,80).stroke({color:0xe5b663,width:2});
  }
  return g;
}

function glove(move) {
  const group=new Container(),g=new Graphics(),ivory=gradient(0xfff7dc,0xe8cd91,0xa67c38);
  if(move==='rock'){
    g.moveTo(-22,25).lineTo(-33,2).bezierCurveTo(-37,-8,-30,-17,-22,-15)
      .lineTo(-20,-29).bezierCurveTo(-20,-39,-10,-42,-4,-35)
      .bezierCurveTo(1,-43,13,-40,15,-33).bezierCurveTo(23,-38,31,-28,28,-19)
      .lineTo(28,3).lineTo(19,25).closePath().fill(ivory).stroke({color:0x7a4a24,width:2});
    g.moveTo(-21,-14).lineTo(-18,0).moveTo(-7,-31).lineTo(-6,-8)
      .moveTo(7,-30).lineTo(8,-7).moveTo(21,-24).lineTo(21,-5).stroke({color:0xa77a39,width:1.5});
    g.moveTo(23,8).bezierCurveTo(11,4,2,-1,5,-8).bezierCurveTo(8,-15,25,-8,29,-3).stroke({color:0x88552b,width:2});
  } else if(move==='scissors'){
    g.moveTo(-18,25).lineTo(-29,8).bezierCurveTo(-36,-4,-28,-14,-18,-5)
      .lineTo(-33,-44).bezierCurveTo(-38,-56,-24,-61,-19,-49).lineTo(-3,-15)
      .lineTo(7,-52).bezierCurveTo(10,-64,25,-59,21,-46).lineTo(12,-12)
      .bezierCurveTo(27,-27,39,-11,27,5).lineTo(20,25).closePath().fill(ivory).stroke({color:0x7a4a24,width:2});
    g.moveTo(25,3).bezierCurveTo(12,0,3,-8,8,-14).bezierCurveTo(11,-18,19,-15,24,-11)
      .moveTo(-21,1).lineTo(-11,12).moveTo(-5,-15).lineTo(0,-3).stroke({color:0xa77a39,width:1.5});
  } else {
    g.moveTo(-19,26).lineTo(-36,0).bezierCurveTo(-45,-12,-35,-22,-28,-11).lineTo(-20,0)
      .lineTo(-24,-41).bezierCurveTo(-26,-53,-13,-55,-12,-42).lineTo(-8,-15)
      .lineTo(-8,-51).bezierCurveTo(-8,-63,6,-63,6,-50).lineTo(6,-15)
      .lineTo(11,-47).bezierCurveTo(13,-60,27,-56,24,-43).lineTo(20,-12)
      .lineTo(29,-35).bezierCurveTo(34,-47,46,-40,41,-28).lineTo(29,8).lineTo(20,26).closePath().fill(ivory).stroke({color:0x7a4a24,width:2});
    g.moveTo(-16,5).bezierCurveTo(-5,-1,13,-1,21,5).moveTo(-9,12).lineTo(13,12)
      .moveTo(-8,-15).lineTo(-7,-7).moveTo(6,-15).lineTo(6,-7).moveTo(20,-12).lineTo(18,-5).stroke({color:0xa77a39,width:1.5});
  }
  g.roundRect(-23,23,46,22,4).fill(gradient(0xae3141,0x68172e,0x38142a)).stroke({color:0xf6cd7a,width:2});
  g.moveTo(-20,29).lineTo(20,29).stroke({color:0xffe2a0,width:1});group.addChild(g,gem(0,36,5));
  return group;
}

export function createCardFront(move,index) {
  const group=new Container({label:`card-front:${move}`});group.addChild(frame());
  const curtains=new Graphics();
  curtains.moveTo(-62,-91).lineTo(62,-91).bezierCurveTo(42,-67,22,-80,0,-72)
    .bezierCurveTo(-22,-80,-42,-67,-62,-91).closePath().fill(gradient(0xc32f3f,0x77152d,0x390f23)).stroke({color:0xe5bd72,width:1});
  curtains.moveTo(-60,-90).bezierCurveTo(-40,-75,-24,-82,0,-74).bezierCurveTo(24,-82,40,-75,60,-90).stroke({color:0xffd580,width:2});
  const halo=new Graphics().ellipse(0,-1,50,57).fill({color:0xd9a446,alpha:.08}).stroke({color:0xc3995a,alpha:.2,width:1});
  const hand=glove(move);hand.position.set(0,-4);hand.scale.set(.88);
  const plate=new Graphics().roundRect(-49,61,98,28,5).fill(gradient(0x785132,0x3e2836,0x2c2034)).stroke({color:0xd5ab66,width:1});
  const title=label(TABLE_MOVE_NAMES[move],18,0xffe4a9,{fontWeight:'500'});title.y=75;
  const english=label(move.toUpperCase(),10,0xf5d28c,{fontFamily:['Georgia','serif'],fontWeight:'bold',letterSpacing:1.4});english.y=-54;
  group.addChild(halo,curtains,hand,plate,title,english,gem(0,-90,7),gem(-69,0,5),gem(69,0,5));
  const number=label(String(index+1),10,0xf5d28c,{fontFamily:['Georgia','serif']});number.position.set(-55,79);group.addChild(number);
  return group;
}

export function createCardBack() {
  const group=new Container({label:'card-back'});group.addChild(frame(true));
  const lattice=new Graphics();
  for(let y=-66;y<=66;y+=22)for(let x=-44;x<=44;x+=22){
    lattice.poly([x,y-10,x+10,y,x,y+10,x-10,y]).stroke({color:0xe5b866,width:.65,alpha:.18});
  }
  const crest=new Graphics().poly([0,-64,45,0,0,64,-45,0]).fill(gradient(0xc6994e,0x68402c,0x30182c)).stroke({color:0xffde94,width:2});
  crest.poly([0,-52,34,0,0,52,-34,0]).fill(0x30162b).stroke({color:0xf3c778,width:1});
  crest.moveTo(-30,-21).bezierCurveTo(-44,-43,-25,-44,-13,-29).bezierCurveTo(-14,-60,8,-61,9,-29)
    .bezierCurveTo(29,-54,45,-37,28,-20).stroke({color:0xe7bd72,width:4});
  for(const [x,y] of [[-33,-34],[0,-48],[33,-34]])crest.circle(x,y,4).fill(GOLD());
  const monogram=label('J',48,0xffdfa0,{fontFamily:['Georgia','serif'],fontWeight:'bold'});monogram.y=3;
  const flourishes=new Graphics();
  for(const direction of [-1,1]){
    flourishes.moveTo(0,73).bezierCurveTo(direction*27,53,direction*60,78,direction*37,86).stroke({color:0xe5b866,width:1.5});
    flourishes.moveTo(0,-73).bezierCurveTo(direction*27,-53,direction*60,-78,direction*37,-86).stroke({color:0xe5b866,width:1.5});
  }
  group.addChild(lattice,crest,monogram,flourishes,gem(0,58,6),gem(0,-78,6));return group;
}
