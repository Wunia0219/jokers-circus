import {Container,Graphics,Rectangle} from 'pixi.js';
import {TABLE_MOVE_NAMES} from './layout.js';
import {createCardBack,createCardFront} from './card-art.js';
import {revealCard} from './card-flip.js';

export class HandCard extends Container {
  constructor({move,index,owner,onChoose,motion}) {
    super({label:`${owner}-card:${move}`});Object.assign(this,{move,owner,motion});
    this.visual=new Container({label:'card-visual'});
    this.shadow=new Graphics().roundRect(-78,-101,156,214,12).fill({color:0x030609,alpha:.5});
    this.front=createCardFront(move,index);this.back=createCardBack();
    this.highlight=new Graphics().roundRect(-82,-111,164,222,14).stroke({width:3,color:0xffdc89});this.highlight.visible=false;
    this.visual.addChild(this.shadow,this.back,this.front,this.highlight);this.addChild(this.visual);
    this.setFaceUp(owner==='player');
    this.hitArea=new Rectangle(-84,-113,168,226);this.interactiveChildren=false;
    if(owner==='player'){
      this.eventMode='static';this.cursor='pointer';this.accessible=true;
      this.accessibleTitle=`選擇${TABLE_MOVE_NAMES[move]}`;this.accessibleHint=this.accessibleTitle;this.tabIndex=index+1;
      this.on('pointertap',() => onChoose(move));
      const hover=value => {
        if(this.locked)return;this.highlight.visible=value || this.selected;
        void motion.to(this,{y:this.baseY-(this.selected?this.selectedLift:value?this.hoverLift:0)},150);
      };
      this.on('pointerover',() => hover(true));this.on('pointerout',() => hover(false));
      this.on('mouseover',() => hover(true));this.on('mouseout',() => hover(false));
    }else this.eventMode='none';
  }
  place(x,y,scale,angle=0,{selectedLift=24,hoverLift=12}={}) {
    this.position.set(x,y);this.baseY=y;this.scale.set(scale,scale*.84);this.rotation=angle;
    Object.assign(this,{selectedLift,hoverLift});
  }
  setFaceUp(value){this.faceUp=value;this.front.visible=value;this.back.visible=!value;}
  reveal(onReveal=()=>{}) {
    return revealCard({motion:this.motion,scale:this.visual.scale,isValid:() => !this.destroyed,
      showFront:() => {this.setFaceUp(true);onReveal();}});
  }
  choose(value){this.selected=value;this.highlight.visible=value;void this.motion.to(this,{y:this.baseY-(value?this.selectedLift:0)},180);}
  lock(value){this.locked=value;if(this.owner==='player'){this.eventMode=value?'none':'static';this.accessible=!value;}}
}
