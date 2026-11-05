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
  group.addChild(new Graphics().roundRect(-w/2,-17,w,34,17).fill({color:0x291c29,alpha:.96}).stroke({color:0xd6af6b,width:1,alpha:.55}));
  const chip=new Graphics().circle(-w/2+23,2,11).fill(0x271726).stroke({color:0xa87b47,width:1})
    .circle(-w/2+23,-1,11).fill(0x6c293e).stroke({color:0xebca87,width:1.2});
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=-w/2+23;chip.moveTo(x+Math.cos(a)*8,-1+Math.sin(a)*8).lineTo(x+Math.cos(a)*10,-1+Math.sin(a)*10).stroke({color:0xebca87,width:1.4});}
  chip.poly([-w/2+23,-6,-w/2+27,-1,-w/2+23,4,-w/2+19,-1]).fill(0xf5d28c);group.addChild(chip);
  const caption=label('持有戲籌',11,PALETTE.muted);caption.anchor.x=0;caption.x=-w/2+43;group.addChild(caption);
  const number=label('',21,PALETTE.bright,{fontFamily:['Georgia','serif'],fontWeight:'bold'});number.anchor.x=1;number.x=w/2-14;group.addChild(number);
  scene.balanceNumber=number;scene.balanceGroup=group;
  updateBalance(scene);
}

export function updateBalance(scene){
  if(!scene.balanceNumber||scene.balanceNumber.destroyed)return;
  const node=scene.balanceNumber;node.text=scene.wallet?scene.wallet.wallet.balance.toLocaleString('en-US'):'—';
  node.scale.set(1);node.scale.set(Math.min(1,112/node.width));
}
