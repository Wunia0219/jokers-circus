import {Container,FillGradient,Graphics,Rectangle,Text} from 'pixi.js';
import {SLOT_UI} from './slot-theme.js';

export const PALETTE=Object.freeze({gold:SLOT_UI.gold,bright:0xffe5b0,cream:SLOT_UI.cream,muted:SLOT_UI.muted,wine:0x5c2f39,navy:0x211426,edge:0xc59a53});
export function label(text,size=13,color=PALETTE.cream,options={}){
  const node=new Text({text,style:{fontFamily:SLOT_UI.font,fontSize:size,fill:color,align:'center',fontWeight:'400',...options}});
  node.anchor.set(.5);node.eventMode='none';return node;
}
export function diamond(x,y,r,color=PALETTE.gold){return new Graphics().poly([x,y-r,x+r,y,x,y+r,x-r,y]).fill(color);}
export function slotIcon(svg,size=20,color=0xead8cb){
  const node=new Graphics().svg(svg.replaceAll('currentColor',`#${color.toString(16).padStart(6,'0')}`));
  node.scale.set(size/24);node.position.set(-size/2,-size/2);node.eventMode='none';return node;
}

export class PixiButton extends Container {
  constructor({text='',subtitle='',width=160,height=44,onPress,primary=false,name=text,fontSize=14,variant=primary?'gold':'panel',icon=null}){
    super({label:`button:${name}`});Object.assign(this,{buttonWidth:width,buttonHeight:height,onPress,variant});
    this.background=new Graphics();this.outline=new Graphics();
    this.caption=label(text,variant==='action'?12:fontSize,variant==='gold'?0xfff0bd:PALETTE.cream,
      variant==='gold' || variant==='action'?{fontFamily:SLOT_UI.serif,fontWeight:'bold'}:{});
    this.subtitle=label(subtitle,variant==='action'?12:12,0xffebc1,{letterSpacing:variant==='action'?0:1});
    if(variant==='gold'){this.caption.y=subtitle?-10:0;this.subtitle.y=16;}
    if(variant==='action'){this.caption.y=23;this.subtitle.y=height/2+11;}
    this.addChild(this.background,this.outline,this.caption,this.subtitle);
    if(icon)this.setIcon(icon);
    this.hitArea=new Rectangle(-width/2,-height/2,width,height);
    this.eventMode='static';this.interactiveChildren=false;this.cursor='pointer';
    this.accessible=true;this.accessibleTitle=name;this.accessibleHint=name;this.accessibleType='button';this.tabIndex=0;
    this.on('pointertap',() => {if(this.enabled!==false)this.onPress?.();});
    this.on('pointerover',() => this.focus(true));this.on('pointerout',() => this.focus(false));
    this.on('mouseover',() => this.focus(true));this.on('mouseout',() => this.focus(false));this.draw();
  }
  draw(){
    const w=this.buttonWidth,h=this.buttonHeight,g=this.background;g.clear();
    if(this.variant==='action'){
      const rim=new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0xffefbb},{offset:.5,color:0xd6a34a},{offset:1,color:0x8a5425}]});
      const red=new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0xe73e35},{offset:.5,color:0xb51f2b},{offset:1,color:0x5f1326}]});
      g.circle(0,5,w/2).fill(0x161024);g.circle(0,0,w/2).fill(rim).stroke({color:0x855322,width:2});
      g.circle(0,-1,w/2-6).fill(red).stroke({color:0xffe5a3,width:2});g.circle(0,-1,w/2-11).stroke({color:0xefa34e,width:1});
      g.roundRect(-15,-27,23,32,3).fill(0xc69543).stroke({color:0x6b381d,width:1});
      g.roundRect(-6,-20,24,32,3).fill(rim).stroke({color:0xffedb1,width:1});
      g.poly([3,-16,10,-7,3,2,-4,-7]).fill(0x9d1730);
      this.outline.clear().circle(0,0,w/2+3).stroke({width:2,color:PALETTE.bright});
    }else if(this.variant==='utility'){
      g.roundRect(-w/2,-h/2,w,h,9).fill({color:0x2b1d2d,alpha:.01});
      this.outline.clear().roundRect(-w/2,-h/2,w,h,9).fill({color:0xe7be71,alpha:.08}).stroke({color:0xe7be71,width:1,alpha:.3});
    }else{
      const gold=this.variant==='gold';
      const gradient=new FillGradient({start:{x:0,y:0},end:{x:1,y:gold ? .1 : 1},colorStops:this.pressed?
        [{offset:0,color:0xf6daa1},{offset:1,color:0xc2934d}]:gold?
        [{offset:0,color:0x6f3e20},{offset:.5,color:0xb77d2d},{offset:1,color:0x764321}]:
        [{offset:0,color:0x352334},{offset:1,color:0x211826}]});
      g.roundRect(-w/2,-h/2,w,h,gold?8:9).fill(gradient).stroke({color:gold?0xc59a53:0xc99b5b,width:1,alpha:gold?1:.35});
      if(gold)g.roundRect(-w/2+3,-h/2+3,w-6,h-6,6).stroke({color:0xfbd38c,width:1,alpha:.22});
      this.outline.clear().roundRect(-w/2-3,-h/2-3,w+6,h+6,10).stroke({width:2,color:PALETTE.bright});
    }
    this.outline.visible=false;
  }
  setIcon(svg){if(this.glyph)this.glyph.destroy();this.glyph=slotIcon(svg);this.addChild(this.glyph);}
  focus(value){this.outline.visible=value && this.enabled!==false;}
  setEnabled(value){this.enabled=value;this.eventMode=value?'static':'none';this.accessible=value;this.alpha=value?1:.5;this.focus(false);}
  setText(text){this.caption.text=text;}
  setSubtitle(text){this.subtitle.text=text;}
  setName(name){
    this.accessibleTitle=this.accessibleHint=name;
    // Pixi v8 copies names when creating its accessibility overlay, not on later renders.
    if(this._accessibleDiv){this._accessibleDiv.title=name;this._accessibleDiv.setAttribute('aria-label',name);}
  }
  setPressed(value){if(this.pressed===value)return;this.pressed=value;this.draw();this.caption.style.fill=value?0x1e1221:PALETTE.cream;}
}
export function panel(width,height){
  const gradient=new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0x352039},{offset:1,color:0x1d1428}]});
  return new Graphics().roundRect(-width/2,-height/2,width,height,14).fill(gradient).stroke({color:0xc79d60,width:1});
}
