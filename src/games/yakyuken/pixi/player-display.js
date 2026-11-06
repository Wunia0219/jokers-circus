import {Container,Graphics,Sprite,Texture} from 'pixi.js';
import {discordAvatarUrl} from '../../../platform/discord-avatar.js';
import {label,PALETTE} from './ui.js';
import {BALANCE_ROW_HEIGHT} from './slot-theme.js';

export function playerIdentity(scene){
  const user=scene.activity?.user;
  return {name:user?(user.global_name||user.username):(scene.wallet?.wallet.name||'訪客玩家'),
    detail:user?`ID ${user.id}`:scene.wallet?'測試帳號':'進度保存在這台裝置'};
}

// Own one portrait per scene; resizing reuses it without restarting the round.
export function loadPlayerPortrait(scene){
  const url=discordAvatarUrl(scene.activity?.user);if(!url)return;
  const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';
  image.onload=()=>{if(scene.disposed)return;scene.avatarTexture=Texture.from(image);scene.renderAvatar?.();};
  image.onerror=()=>{};
  scene.abort.signal.addEventListener('abort',()=>{image.onload=image.onerror=null;image.src='';},{once:true});
  image.src=url;
}

export function attachPortrait(scene,avatar,size,fallback){
  scene.renderAvatar=()=>{
    if(avatar.destroyed||!scene.avatarTexture||avatar.getChildByLabel('discord-avatar-image'))return;
    fallback.visible=false;
    const image=new Sprite({texture:scene.avatarTexture,anchor:.5,label:'discord-avatar-image'}),diameter=size-6;
    image.scale.set(diameter/Math.min(image.texture.width,image.texture.height));
    const mask=new Graphics().circle(0,0,diameter/2).fill(0xffffff);mask.eventMode='none';image.eventMode='none';
    avatar.addChild(image,mask);image.mask=mask;
  };
  scene.renderAvatar();
}

export function buildBalance(scene,hud,width,headerHeight){
  const w=Math.min(244,width-32),group=new Container({label:'player-balance',eventMode:'none'});
  group.position.set(width/2,headerHeight+BALANCE_ROW_HEIGHT/2);hud.addChild(group);
  group.addChild(new Graphics().roundRect(-w/2,-17,w,34,5).fill({color:0x211a24,alpha:.72})
    .moveTo(-w/2+14,16).lineTo(w/2-14,16).stroke({color:0xd6af6b,width:1,alpha:.45})
    .moveTo(-w/2+91,-8).lineTo(-w/2+91,8).stroke({color:0xd6af6b,width:1,alpha:.25}));
  const caption=label('COINS',13,PALETTE.gold,{fontFamily:['Georgia','serif'],fontWeight:'bold',letterSpacing:2});caption.label='balance-unit';caption.anchor.x=0;caption.x=-w/2+14;group.addChild(caption);
  const number=label('',25,PALETTE.bright,{fontFamily:['Georgia','serif'],fontWeight:'bold'});number.anchor.x=1;number.x=w/2-14;group.addChild(number);
  scene.balanceNumber=number;scene.balanceGroup=group;
  updateBalance(scene);
}

export function updateBalance(scene){
  if(!scene.balanceNumber||scene.balanceNumber.destroyed)return;
  const node=scene.balanceNumber;node.text=scene.wallet?scene.wallet.wallet.balance.toLocaleString('en-US'):'—';
  node.scale.set(1);node.scale.set(Math.min(1,112/node.width));
}
