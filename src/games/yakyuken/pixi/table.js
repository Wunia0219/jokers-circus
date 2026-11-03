import {Container,FillGradient,Graphics} from 'pixi.js';

export function createTable(layout) {
  const {x,y,rx,ry} = layout.table,group = new Container({label:'casino-table'});
  group.eventMode = 'none';
  const g = new Graphics();
  g.ellipse(x,y+20,rx+10,ry+10).fill({color:0x000000,alpha:.6});
  g.ellipse(x,y,rx,ry).fill(0x291a21).stroke({color:0x130b13,width:12});
  g.ellipse(x,y-10,rx-10,ry-15).fill(0x501e31).stroke({color:0x9d693e,width:3});
  g.ellipse(x,y-18,rx-25,ry-28).fill(0x9b6d3c);
  g.ellipse(x,y-21,rx-32,ry-33).fill(0x281c25);
  const felt = new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x173b33},{offset:.35,color:0x102e2c},{offset:1,color:0x081c22}]});
  g.ellipse(x,y-24,rx-40,ry-40).fill(felt).stroke({color:0xd0a665,width:2});
  g.ellipse(x,y-24,rx-56,ry-54).stroke({color:0xd1b16e,width:1,alpha:.25});
  // Restrained felt grain and stitched rail, all rendered by Pixi Graphics.
  for(let i=0;i<95;i++){
    const angle=Math.PI*1.12 + i/94*Math.PI*.76;
    const px=x+Math.cos(angle)*(rx-19),py=y-10+Math.sin(angle)*(ry-19);
    g.moveTo(px-2,py).lineTo(px+2,py).stroke({color:0xd1a46b,width:1,alpha:.25});
  }
  const grain=new Graphics(),top=y-ry,visible=Math.max(layout.h-top,1);
  for(let i=0;i<220;i++){
    const px=(i*97%1601)/1600*layout.w,py=top+24+(i*67%997)/997*visible;
    if(((px-x)/(rx-60))**2+((py-y+24)/(ry-60))**2<1)grain.circle(px,py,.65).fill({color:0xb6c4a6,alpha:.045});
  }
  group.addChild(g,grain);
  return group;
}
