import {Container, FillGradient, Graphics, Rectangle, Text} from 'pixi.js';

export const PALETTE = Object.freeze({gold:0xe9c580,bright:0xffe2a5,cream:0xf8ebd5,muted:0xc1b199,wine:0x5a1d31,navy:0x10172c,edge:0x93693b});
export function label(text,size = 22,color = PALETTE.cream,options = {}) {
  const node = new Text({text,style:{fontFamily:['Georgia','Microsoft JhengHei','serif'],fontSize:size,fill:color,align:'center',...options}});
  node.anchor.set(.5);node.eventMode = 'none';return node;
}
export function diamond(x,y,r,color = PALETTE.gold) {
  return new Graphics().poly([x,y-r,x+r,y,x,y+r,x-r,y]).fill(color);
}

export class PixiButton extends Container {
  constructor({text,width = 230,height = 58,onPress,primary = false,name = text,fontSize = 22}) {
    super({label:`button:${name}`});
    Object.assign(this,{buttonWidth:width,buttonHeight:height,primary,onPress});
    this.background = new Graphics();this.outline = new Graphics();
    this.caption = label(text,fontSize,primary?0x321a20:PALETTE.cream);
    this.addChild(this.background,this.outline,this.caption);
    this.hitArea = new Rectangle(-width / 2,-height / 2,width,height);
    this.eventMode = 'static';this.interactiveChildren = false;this.cursor = 'pointer';
    this.accessible = true;this.accessibleTitle = name;this.accessibleHint = name;this.accessibleType = 'button';this.tabIndex = 0;
    this.on('pointertap',() => {if(this.enabled !== false)this.onPress?.();});
    this.on('pointerover',() => this.focus(true));this.on('pointerout',() => this.focus(false));
    this.on('mouseover',() => this.focus(true));this.on('mouseout',() => this.focus(false));
    this.draw();
  }
  draw() {
    const w = this.buttonWidth,h = this.buttonHeight;
    const gradient = new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:this.primary?
      [{offset:0,color:0xffdf9b},{offset:.5,color:0xd7a85c},{offset:1,color:0xb17a39}]:
      [{offset:0,color:0x492a34},{offset:1,color:0x1c1725}]});
    this.background.clear().roundRect(-w/2,-h/2+4,w,h,8).fill({color:0x08070d,alpha:.55});
    this.background.roundRect(-w/2,-h/2,w,h,8).fill(gradient).stroke({width:1.5,color:PALETTE.edge});
    this.background.roundRect(-w/2+5,-h/2+5,w-10,h-10,5).stroke({width:1,color:PALETTE.gold,alpha:.3});
    this.outline.clear().roundRect(-w/2-3,-h/2-3,w+6,h+6,10).stroke({width:2,color:PALETTE.bright});this.outline.visible = false;
  }
  focus(value) { this.outline.visible = value && this.enabled !== false; }
  setEnabled(value) {this.enabled = value;this.eventMode = value?'static':'none';this.accessible = value;this.alpha = value?1:.44;this.focus(false);}
  setText(text) {this.caption.text = text;}
}

export function panel(width,height) {
  const gradient = new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x34212e},{offset:1,color:0x131523}]});
  const g = new Graphics().roundRect(-width/2,-height/2,width,height,16).fill(gradient).stroke({color:PALETTE.edge,width:2});
  g.roundRect(-width/2+10,-height/2+10,width-20,height-20,10).stroke({color:PALETTE.gold,width:1,alpha:.3});
  return g;
}
