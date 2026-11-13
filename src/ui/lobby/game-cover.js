import {Graphics,Sprite} from 'pixi.js';
import {label,PALETTE,PixiButton} from '../pixi/ui.js';

function outline(width,height,inset=0){
  const x=width/2-inset,y=height/2-inset,c=Math.max(8,width*.034);
  return [-x+c,-y,x-c,-y,x,-y+c,x,y-c,x-c,y,-x+c,y,-x,y-c,-x,-y+c];
}

// The illustration includes its title and frame: preserve the entire 3:2 asset.
export function createGameCover({texture,frameTexture,name,area,onPress,status}){
  const {width,height}=area;
  const button=new PixiButton({name:`選擇${name}`,width,height,onPress});
  button.position.set(area.x,area.y);
  button.background.clear();
  const art=new Sprite({texture,anchor:.5,eventMode:'none',label:`cover:${name}`});
  art.width=width;art.height=height;
  const mask=new Graphics().poly(outline(width,height)).fill(0xffffff);mask.eventMode='none';
  button.addChildAt(art,1);button.addChildAt(mask,2);art.mask=mask;
  button.outline.clear().poly(outline(width,height,1)).fill({color:0xffe8ae,alpha:.04}).stroke({color:0xffedc4,width:2,alpha:.9});
  button.outline.visible=false;
  if(frameTexture){
    const frame=new Sprite({texture:frameTexture,anchor:.5,eventMode:'none'});
    frame.width=width;frame.height=height;
    const rim=new Graphics().poly(outline(width,height)).fill(0xffffff)
      .poly(outline(width,height,width*.024)).cut();
    rim.eventMode='none';
    button.addChild(frame,rim);frame.mask=rim;
  }
  if(status){
    const caption=label(status,Math.max(13,Math.min(24,width*.067)),PALETTE.cream,{fontWeight:'600'});
    const y=onPress?height*.36:0;
    const shade=new Graphics().roundRect(-caption.width/2-12,y-caption.height/2-5,caption.width+24,caption.height+10,6)
      .fill({color:0x211426,alpha:.86});
    shade.eventMode='none';caption.y=y;
    button.addChild(shade,caption);
  }
  if(!onPress){button.setEnabled(false);button.alpha=1;}
  return button;
}
