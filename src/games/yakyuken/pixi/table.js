import {Container,FillGradient,Graphics} from 'pixi.js';
import {diamond,label,PALETTE} from './ui.js';

export function createTable(layout) {
  const {x,y,rx,ry} = layout.table,group = new Container({label:'casino-table'});
  group.eventMode = 'none';
  const g = new Graphics();
  g.ellipse(x,y+20,rx+10,ry+10).fill({color:0x000000,alpha:.6});
  g.ellipse(x,y,rx,ry).fill(0x291a21).stroke({color:0x130b13,width:12});
  g.ellipse(x,y-10,rx-10,ry-15).fill(0x501e31).stroke({color:0x9d693e,width:3});
  g.ellipse(x,y-18,rx-25,ry-28).fill(0x9b6d3c);
  g.ellipse(x,y-21,rx-32,ry-33).fill(0x281c25);
  const felt = new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x23483e},{offset:.28,color:0x1a3a34},{offset:1,color:0x0a2327}]});
  g.ellipse(x,y-24,rx-40,ry-40).fill(felt).stroke({color:0xd0a665,width:2});
  g.ellipse(x,y-24,rx-56,ry-54).stroke({color:0xd1b16e,width:1,alpha:.25});
  // Restrained felt grain and stitched rail, all rendered by Pixi Graphics.
  for(let i=0;i<95;i++){
    const angle=Math.PI*1.12 + i/94*Math.PI*.76;
    const px=x+Math.cos(angle)*(rx-19),py=y-10+Math.sin(angle)*(ry-19);
    g.moveTo(px-2,py).lineTo(px+2,py).stroke({color:0xd1a46b,width:1,alpha:.25});
  }
  group.addChild(g);
  const brand = label('JOKER’S CIRCUS',layout.portrait?27:31,PALETTE.gold,{letterSpacing:6});
  brand.position.set(layout.w*.18,layout.playerCards.y);brand.alpha = .15;
  const subtitle = label('命 運 牌 桌',layout.portrait?20:19,PALETTE.gold,{letterSpacing:6});
  subtitle.position.set(brand.x,brand.y+34);subtitle.alpha = .19;
  if(!layout.portrait)group.addChild(brand,subtitle);else{brand.destroy();subtitle.destroy();}
  const side = layout.portrait?300:530;
  for(const direction of [-1,1]){
    const detail = new Graphics();
    detail.moveTo(x+direction*side,layout.dealerCards.y-20).lineTo(x+direction*(side-70),layout.dealerCards.y-20).stroke({color:PALETTE.gold,width:1,alpha:.27});
    group.addChild(detail,diamond(x+direction*side,layout.dealerCards.y-20,5,0xa9814d));
  }
  return group;
}
