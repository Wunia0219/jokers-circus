import {Container,FillGradient,Graphics} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,PALETTE,PixiButton} from './ui.js';
import {TABLE_MOVE_NAMES} from './layout.js';

function at(node,x,y,parent){node.position.set(x,y);parent.addChild(node);return node;}
function leftLabel(text,size,color,x,y,parent,options={}){const node=label(text,size,color,options);node.anchor.set(0,.5);return at(node,x,y,parent);}

export function buildSlotHud(scene){
  const {ui,scale}=scene.layout,{width,narrow,headerHeight}=ui;
  const hud=new Container({label:'slot-style-chrome'});hud.scale.set(1/scale);scene.world.addChild(hud);scene.hud=hud;
  const shade=new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x19101e},{offset:1,color:0x211426}]});
  hud.addChild(new Graphics().rect(0,0,width,headerHeight).fill({fill:shade,alpha:.82}));
  const ax=narrow?12:28,avatarSize=narrow?40:48;
  const avatar=at(new PixiButton({name:'開啟選單',variant:'utility',width:48,height:48,icon:icon('user'),onPress:()=>scene.openModal('menu')}),ax+avatarSize/2,narrow?32:40,hud);
  avatar.background.clear().circle(0,0,avatarSize/2).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0x825342},{offset:.58,color:0x442638},{offset:1,color:0x281d30}]})).stroke({color:0xbf925e,width:1,alpha:.53});
  avatar.background.circle(avatarSize/2-3,avatarSize/2-3,4).fill(0xb5a0b1).stroke({color:0x24182c,width:2});
  leftLabel('訪客玩家',narrow?14:15,PALETTE.cream,ax+avatarSize+(narrow?8:12),narrow?23:29,hud,{fontWeight:'500'});
  leftLabel('本機試玩・不扣戲籌',width<=360?11:12,0xd7bfbf,ax+avatarSize+(narrow?8:12),narrow?44:51,hud);
  const toolsWidth=narrow?width-24:236,toolsX=narrow?12:width-toolsWidth-28,toolsY=narrow?72:12,toolsHeight=56;
  hud.addChild(new Graphics().roundRect(toolsX,toolsY,toolsWidth,toolsHeight,12).fill({color:0x2b1d2d,alpha:.85}).stroke({color:0xc99b5b,alpha:.21,width:1}));
  const positions=[toolsX+28,toolsX+84,toolsX+toolsWidth-84,toolsX+toolsWidth-28],cy=toolsY+toolsHeight/2;
  const sound=at(new PixiButton({name:scene.audio.muted?'開啟音效':'關閉音效',variant:'utility',width:48,height:48,icon:icon(scene.audio.muted?'muted':'sound'),onPress:async()=>{
    try{await scene.audio.toggle();scene.refreshAudioIcons?.();}catch{}
  }}),positions[0],cy,hud);
  const music=at(new PixiButton({name:scene.audio.musicMuted?'開啟音樂':'關閉音樂',variant:'utility',width:48,height:48,icon:icon(scene.audio.musicMuted?'musicMuted':'music'),onPress:async()=>{
    try{await scene.audio.toggleMusic();scene.refreshAudioIcons?.();}catch{}
  }}),positions[1],cy,hud);
  scene.refreshAudioIcons=()=>{
    if(scene.disposed || sound.destroyed || music.destroyed)return;
    sound.setIcon(icon(scene.audio.muted?'muted':'sound'));sound.setName(scene.audio.muted?'開啟音效':'關閉音效');
    music.setIcon(icon(scene.audio.musicMuted?'musicMuted':'music'));music.setName(scene.audio.musicMuted?'開啟音樂':'關閉音樂');
  };
  hud.addChild(new Graphics().moveTo(toolsX+116,toolsY+9).lineTo(toolsX+116,toolsY+toolsHeight-9).stroke({color:0xc99b5b,width:1,alpha:.19}));
  at(new PixiButton({name:'遊戲規則',variant:'utility',width:48,height:48,icon:icon('info'),onPress:()=>scene.openModal('help')}),positions[2],cy,hud);
  at(new PixiButton({name:'遊玩紀錄',variant:'utility',width:48,height:48,icon:icon('clock'),onPress:()=>scene.openModal('history')}),positions[3],cy,hud);

  if(scene.screen!=='table')return;
  const {action,status}=scene.layout;
  scene.confirmButton=at(new PixiButton({text:'確認出牌',name:'確認出牌',variant:'gold',width:action.width,height:action.height,fontSize:14,onPress:()=>scene.confirm()}),action.x,action.y,hud);
  scene.status=at(label('',13,PALETTE.cream,{wordWrap:true,wordWrapWidth:status.width,lineHeight:20}),status.x,status.y,hud);
}

export function updateSlotHud(scene){
  if(scene.screen!=='table' || !scene.confirmButton)return;
  const {phase,selected,duel}=scene,confirmed=phase==='confirmed';
  scene.confirmButton.setText(confirmed?'下一局':phase==='presenting'?'荷官出牌中…':'確認出牌');
  scene.confirmButton.setName(confirmed?'下一局':'確認出牌');
  scene.confirmButton.setEnabled(confirmed || phase==='selecting' && !!selected);
  scene.status.text=confirmed?`${{win:'你贏了',loss:'荷官獲勝',draw:'平手'}[duel.outcome]}・你出${TABLE_MOVE_NAMES[selected]}／荷官出${TABLE_MOVE_NAMES[duel.dealer]}`:phase==='presenting'?'荷官正在出牌':selected?'準備好了，就出這一張。':'請選擇一張手牌';
}
