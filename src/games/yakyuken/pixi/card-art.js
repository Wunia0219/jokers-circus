import {Container,Sprite} from 'pixi.js';
import {label} from '../../../ui/pixi/ui.js';
import {TABLE_MOVE_NAMES} from './layout.js';

function surface(texture){
  const art=new Sprite(texture);art.anchor.set(.5);art.width=156;art.height=214;art.eventMode='none';return art;
}

export function createCardFront(move,_index,textures){
  const group=new Container({label:`card-front:${move}`});group.addChild(surface(textures[move]));
  const title=label(TABLE_MOVE_NAMES[move],23,0xffe6b1,{fontWeight:'600',dropShadow:{color:0x19090d,blur:2,distance:1,alpha:.9}});
  title.y=76;group.addChild(title);return group;
}

export function createCardBack(textures){
  const group=new Container({label:'card-back'});group.addChild(surface(textures.back));return group;
}
