import {Container, Graphics, Rectangle} from 'pixi.js';
import {handIcon} from '../icons.js';
import {label, PALETTE} from './ui.js';
import {TABLE_MOVE_NAMES} from './layout.js';

export class HandCard extends Container {
  constructor({move,index,owner,onChoose,motion}) {
    super({label:`${owner}-card:${move}`});
    Object.assign(this,{move,owner,motion});
    this.shadow = new Graphics().roundRect(-78,-100,156,214,12).fill({color:0x030609,alpha:.4});
    this.face = new Graphics().roundRect(-78,-107,156,214,11).fill(0xf2dfbd).stroke({width:3,color:0xc59a55});
    this.face.roundRect(-70,-99,140,198,7).stroke({width:1,color:0xa07a46,alpha:.8});
    this.face.moveTo(-53,-58).lineTo(53,-58).stroke({width:1,color:0xb2915a,alpha:.45});
    this.face.moveTo(-53,61).lineTo(53,61).stroke({width:1,color:0xb2915a,alpha:.45});
    this.highlight = new Graphics().roundRect(-83,-112,166,224,14).stroke({width:3,color:0xffda81});this.highlight.visible = false;
    const glyph = new Graphics().svg(handIcon(move).replaceAll('currentColor','#622338'));
    glyph.position.set(-43,-44);glyph.scale.set(1.34);
    const title = label(TABLE_MOVE_NAMES[move],24,0x5a2332,{fontWeight:'bold'});title.y = 79;
    const english = label(move.toUpperCase(),11,0x977044,{letterSpacing:2});english.y = -75;
    const number = label(['I','II','III'][index],17,0x642334);number.position.set(-57,-83);
    const inverse = label(['I','II','III'][index],17,0x642334);inverse.position.set(57,84);inverse.rotation = Math.PI;
    this.addChild(this.shadow,this.face,glyph,english,title,number,inverse,this.highlight);
    this.hitArea = new Rectangle(-84,-113,168,226);this.interactiveChildren = false;
    if (owner === 'player') {
      this.eventMode = 'static';this.cursor = 'pointer';this.accessible = true;
      this.accessibleTitle = `選擇${TABLE_MOVE_NAMES[move]}`;this.accessibleHint = this.accessibleTitle;this.tabIndex = index + 1;
      this.on('pointertap',() => onChoose(move));
      const hover = value => {
        if(this.locked)return;
        this.highlight.visible = value || this.selected;
        void motion.to(this,{y:this.baseY - (this.selected?24:value?12:0)},150);
      };
      this.on('pointerover',() => hover(true));this.on('pointerout',() => hover(false));
      this.on('mouseover',() => hover(true));this.on('mouseout',() => hover(false));
    } else this.eventMode = 'none';
  }
  place(x,y,scale,angle = 0) {this.position.set(x,y);this.baseY = y;this.scale.set(scale,scale*.84);this.rotation = angle;}
  choose(value) {this.selected = value;this.highlight.visible = value;void this.motion.to(this,{y:this.baseY - (value?24:0)},180);}
  lock(value) {this.locked = value;if(this.owner === 'player'){this.eventMode = value?'none':'static';this.accessible = !value;}}
}
