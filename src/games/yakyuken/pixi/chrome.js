import {Container,FillGradient,Graphics} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,PALETTE,PixiButton,slotIcon} from './ui.js';
import {TABLE_MOVE_NAMES} from './layout.js';
import {slotHeaderLayout} from './header-layout.js';
import {difficultyRule} from '../challenge.js';

function at(node,x,y,parent){node.position.set(x,y);parent.addChild(node);return node;}
function leftLabel(text,size,color,x,y,parent,options={}){const node=label(text,size,color,options);node.anchor.set(0,.5);return at(node,x,y,parent);}

export function buildSlotHud(scene){
  if(scene.screen==='games')return;
  const {ui,scale}=scene.layout,{width,height,headerHeight}=ui;
  const h=slotHeaderLayout(width,height),{narrow,small,left,avatarSize,identityY}=h;
  const hud=new Container({label:'slot-style-chrome'});hud.scale.set(1/scale);scene.world.addChild(hud);scene.hud=hud;
  const shade=new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x19101e},{offset:1,color:0x211426}]});
  hud.addChild(new Graphics().rect(0,0,width,headerHeight).fill({fill:shade,alpha:.7}));
  const avatar=at(new Container({label:'player-avatar',eventMode:'none'}),left+avatarSize/2,identityY,hud);
  const portrait=new Graphics().circle(0,0,avatarSize/2).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0x825342},{offset:.58,color:0x442638},{offset:1,color:0x281d30}]})).stroke({color:0xbf925e,width:1,alpha:.53});
  portrait.circle(avatarSize/2-6,avatarSize/2-6,4).fill(0xb5a0b1).stroke({color:0x24182c,width:2});avatar.addChild(portrait,slotIcon(icon('user'),narrow?19:23,0xf4d59b));
  const textX=left+avatarSize+(narrow?8:12),textWidth=h.checkin.x-12-textX;
  leftLabel('訪客玩家',narrow?14:15,PALETTE.cream,textX,identityY-10,hud,{fontWeight:'500'});
  leftLabel('本機試玩・暫不扣款',small?11:12,0xd7bfbf,textX,identityY+11,hud,{wordWrap:true,wordWrapWidth:textWidth,align:'left'});
  const c=h.checkin,checkin=at(new PixiButton({name:'週簽到・介面預覽',width:c.width,height:56}),c.x+c.width/2,c.y+28,hud);checkin.cursor='default';
  checkin.background.clear().roundRect(-c.width/2,-28,c.width,56,12).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:.2},colorStops:[{offset:0,color:0x73452f},{offset:1,color:0x5c2f39}]})).stroke({color:0xc79a5f,width:1});
  const copyWidth=6*(narrow?11:12),giftSize=narrow?18:20,giftGap=narrow?8:10;
  const contentX=-(copyWidth+(small?0:giftSize+giftGap))/2;
  if(!small){const gift=slotIcon(icon('gift'),giftSize);gift.position.set(contentX,-giftSize/2);checkin.addChild(gift);}
  const copyX=contentX+(small?0:giftSize+giftGap);
  leftLabel('週簽到',narrow?12:14,0xffe9bc,copyX,-10,checkin,{fontWeight:'500'});
  leftLabel('查看七日獎勵',narrow?11:12,0xffdfab,copyX,11,checkin);
  const {toolsX,toolsY,toolsWidth,toolsHeight,centers}=h,cy=toolsY+toolsHeight/2;
  hud.addChild(new Graphics().roundRect(toolsX,toolsY,toolsWidth,toolsHeight,narrow?11:12).fill({color:0x2b1d2d,alpha:.85}).stroke({color:0xc99b5b,alpha:.21,width:1}));
  const sound=at(new PixiButton({name:'音效尚未加入',variant:'utility',width:48,height:48,icon:icon('muted')}),centers[0],cy,hud);sound.setEnabled(false);sound.alpha=1;sound.glyph.tint=0xc1b1bf;
  const music=at(new PixiButton({name:scene.audio.musicMuted?'開啟音樂':'關閉音樂',variant:'utility',width:48,height:48,icon:icon(scene.audio.musicMuted?'musicMuted':'music'),onPress:async()=>{
    await scene.audio.toggleMusic();scene.refreshAudioIcons?.();
  }}),centers[1],cy,hud);
  scene.refreshAudioIcons=()=>{
    if(scene.disposed || music.destroyed)return;
    music.setActive(!scene.audio.musicMuted);music.setIcon(icon(scene.audio.musicMuted?'musicMuted':'music'));music.setName(scene.audio.musicMuted?'開啟音樂':'關閉音樂');
  };scene.refreshAudioIcons();
  hud.addChild(new Graphics().moveTo(centers[1]+33,toolsY+9).lineTo(centers[1]+33,toolsY+toolsHeight-9).stroke({color:0xc99b5b,width:1,alpha:.19}));
  at(new PixiButton({name:'遊戲規則',variant:'utility',width:48,height:48,icon:icon('info'),onPress:()=>scene.openModal('help')}),centers[2],cy,hud);
  at(new PixiButton({name:'遊玩紀錄尚未開放',variant:'utility',width:48,height:48,icon:icon('clock')}),centers[3],cy,hud).setEnabled(false);
  scene.lobbyButton=at(new PixiButton({name:'返回遊戲大廳',variant:'utility',width:48,height:48,icon:icon('lobby'),onPress:()=>scene.visitScreen('games')}),centers[4],cy,hud);
  if(scene.screen!=='table')return;
  const {action,status}=scene.layout;
  scene.confirmButton=at(new PixiButton({text:'確認出牌',name:'確認出牌',variant:'gold',width:action.width,height:action.height,fontSize:14,onPress:()=>scene.confirm()}),action.x,action.y,hud);
  scene.status=at(label('',13,PALETTE.cream,{wordWrap:true,wordWrapWidth:status.width,lineHeight:20}),status.x,status.y,hud);
  scene.status.anchor.set(.5,1);scene.status.y=action.y-action.height/2-10;
  const scoreWidth=Math.min(width-24,360),scoreY=headerHeight+23;
  hud.addChild(new Graphics().roundRect((width-scoreWidth)/2,scoreY-17,scoreWidth,34,10).fill({color:0x211426,alpha:.85}).stroke({color:PALETTE.gold,alpha:.3,width:1}));
  scene.score=at(label('',13,PALETTE.gold),width/2,scoreY,hud);
}

export function updateSlotHud(scene){
  scene.lobbyButton?.setEnabled(scene.phase!=='presenting' && !scene.changing);
  if(scene.screen!=='table' || !scene.confirmButton)return;
  const {phase,selected,duel}=scene,confirmed=phase==='confirmed';
  const rule=difficultyRule(scene.selectedDifficulty),challenge=scene.challenge,finished=challenge?.status!=='playing';
  // Counters reveal with the hand, without exposing its result mid-flip.
  const pending=phase==='presenting'?duel?.outcome:null;
  scene.score.text=`難度${rule.name}　${(challenge?.wins || 0)-Number(pending==='win')} / ${rule.winsRequired} 勝　${(challenge?.losses || 0)-Number(pending==='loss')} / ${rule.lossLimit} 敗`;
  const next=finished?'再挑戰一次':'下一局';
  scene.confirmButton.setText(confirmed?next:phase==='presenting'?'荷官出牌中…':'確認出牌');
  scene.confirmButton.setName(confirmed?next:'確認出牌');
  scene.confirmButton.setEnabled(confirmed || phase==='selecting' && !!selected);
  scene.status.text=confirmed?`${{win:'你贏了',loss:'荷官獲勝',draw:'平手'}[duel.outcome]}・你出${TABLE_MOVE_NAMES[selected]}／荷官出${TABLE_MOVE_NAMES[duel.dealer]}`:phase==='presenting'?'荷官正在出牌':selected?'準備好了，就出這一張。':'請選擇一張手牌';
  if(confirmed && finished)scene.status.text=challenge.status==='won'?`通關！獎金 ${challenge.reward.toLocaleString('en-US')} 戲籌\n本機試玩，未入帳`:'挑戰結束\n已達敗場上限，本場無獎金';
}
