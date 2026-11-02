import {Container,FillGradient,Graphics} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,PALETTE,PixiButton} from './ui.js';
import {SLOT_UI} from './slot-theme.js';
import {TABLE_MOVES,TABLE_MOVE_NAMES} from './layout.js';

function at(node,x,y,parent){node.position.set(x,y);parent.addChild(node);return node;}
function leftLabel(text,size,color,x,y,parent,options={}){const node=label(text,size,color,options);node.anchor.set(0,.5);return at(node,x,y,parent);}

export function buildSlotHud(scene){
  const {ui,scale}=scene.layout,{width,height,narrow,headerHeight,deck}=ui;
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

  const controls=new Container({label:'slot-control-deck'});controls.position.set(deck.x,deck.y);controls.scale.set(deck.scale);hud.addChild(controls);
  const dw=deck.width/deck.scale,dh=deck.height/deck.scale;
  const border=new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x75452f},{offset:.09,color:0x36202e},{offset:.88,color:0x301b2b},{offset:1,color:0x5d322a}]});
  controls.addChild(new Graphics().roundRect(0,4,dw,dh,20).fill(0x281421).stroke({color:0xac7c43,width:1})
    .roundRect(0,0,dw,dh,16).fill(border).stroke({color:0xe2b76b,width:1})
    .roundRect(3,3,dw-6,dh-6,14).stroke({color:0xffe6a7,width:1,alpha:.22}));
  const mobile=ui.mobile;
  const actionSize=mobile?88:104,actionX=mobile?dw/2:490,actionY=mobile?62:65;
  const goldWidth=mobile?(dw-32-actionSize-20)/2:156,goldHeight=mobile?72:82;
  const englishSize=mobile?(width<=360?14:18):22;
  at(new PixiButton({text:'DEALER',subtitle:'荷官與造型',name:'荷官與造型',variant:'gold',width:goldWidth,height:goldHeight,fontSize:englishSize,onPress:()=>scene.openModal('wardrobe')}),mobile?16+goldWidth/2:345,mobile?60:65,controls);
  scene.confirmButton=at(new PixiButton({text:'PLAY',subtitle:'確認出牌',name:'確認出牌',variant:'action',width:actionSize,height:actionSize,onPress:()=>scene.confirm()}),actionX,actionY,controls);
  at(new PixiButton({text:'SETTINGS',subtitle:'遊戲設定',name:'開啟設定',variant:'gold',width:goldWidth,height:goldHeight,fontSize:englishSize,onPress:()=>scene.openModal('settings')}),mobile?dw-16-goldWidth/2:637,mobile?60:65,controls);
  const coinsX=mobile?24:835,coinsY=mobile?139:42;
  const coins=label('COINS',mobile?12:14,0xe8c787,{fontFamily:SLOT_UI.serif,letterSpacing:1});if(mobile)coins.anchor.set(0,.5);at(coins,coinsX,coinsY,controls);
  at(label('—',mobile?32:44,0xfff0ba,{fontFamily:SLOT_UI.serif}),mobile?dw-43:835,mobile?139:89,controls);
  if(!mobile)controls.addChild(new Graphics().moveTo(742,24).lineTo(742,115).stroke({color:0xe7be71,width:1,alpha:.25}));
  scene.handCaption=leftLabel('HAND',mobile?11:14,0xe8c787,24,mobile?174:42,controls,{fontFamily:SLOT_UI.serif,letterSpacing:1});
  scene.handCaptionChinese=leftLabel('本局手牌',mobile?9:11,0xd9bdb4,73,mobile?174:42,controls);
  const selectorWidth=mobile?(dw-48-12)/3:60;
  scene.handButtons=TABLE_MOVES.map((move,index)=>at(new PixiButton({text:TABLE_MOVE_NAMES[move],name:`手牌選擇${TABLE_MOVE_NAMES[move]}`,variant:'panel',width:selectorWidth,height:mobile?48:52,fontSize:mobile?14:16,onPress:()=>scene.select(move)}),24+selectorWidth/2+index*(selectorWidth+6),mobile?211:83,controls));
  scene.resultTitle=at(label('',mobile?18:18,PALETTE.gold,{fontWeight:'500'}),mobile?dw/2:122,mobile?201:75,controls);
  scene.resultDetail=at(label('',12,PALETTE.muted),mobile?dw/2:122,mobile?225:102,controls);
  scene.status=label('',14/scale,PALETTE.cream);at(scene.status,scene.layout.w/2,scene.layout.statusY,scene.world);
  scene.statusDetail=label('',12/scale,PALETTE.muted);scene.statusDetail.visible=false;scene.world.addChild(scene.statusDetail);
}

export function updateSlotHud(scene){
  const {phase,selected,duel}=scene,confirmed=phase==='confirmed';
  scene.confirmButton.setText(confirmed?'NEXT':phase==='presenting'?'WAIT':'PLAY');
  scene.confirmButton.setSubtitle(confirmed?'下一局':phase==='presenting'?'出牌中…':'確認出牌');
  scene.confirmButton.setName(confirmed?'下一局':'確認出牌');
  scene.confirmButton.setEnabled(confirmed || phase==='selecting' && !!selected);
  scene.handButtons.forEach((button,index)=>{button.visible=!confirmed;button.setEnabled(phase==='selecting');button.setPressed(selected===TABLE_MOVES[index]);});
  scene.handCaption.text=confirmed?'RESULT':'HAND';scene.handCaptionChinese.text=confirmed?'本局結果':'本局手牌';
  scene.resultTitle.visible=scene.resultDetail.visible=confirmed;
  if(confirmed){scene.resultTitle.text={win:'你贏了',loss:'荷官獲勝',draw:'平手'}[duel.outcome];scene.resultTitle.style.fill=duel.outcome==='loss'?0xe6a8aa:PALETTE.gold;
    scene.resultDetail.text=`你出${TABLE_MOVE_NAMES[selected]}／荷官出${TABLE_MOVE_NAMES[duel.dealer]}`;}
}
