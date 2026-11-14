import {Container,FillGradient,Graphics,Sprite} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,PALETTE,PixiButton,slotIcon} from '../../../ui/pixi/ui.js';
import {TABLE_MOVE_NAMES,resultActionLayout} from './layout.js';
import {yakyukenHeaderLayout} from './header-layout.js';
import {characterRule} from '../characters.js';
import {attachPortrait,buildBalance,playerIdentity,updateBalance} from './player-display.js';

function at(node,x,y,parent){node.position.set(x,y);parent.addChild(node);return node;}
function leftLabel(text,size,color,x,y,parent,options={}){const node=label(text,size,color,options);node.anchor.set(0,.5);return at(node,x,y,parent);}

function buildProgress(scene,hud){
  const {progress,dealerCard,scale}=scene.layout,{x,y,width:w,height:h}=progress,rule=characterRule(scene.selectedCharacter);
  const score=at(new Container({label:'challenge-progress',eventMode:'none'}),x,y,hud);scene.score=score;
  const frame=new Sprite(scene.cardTextures.progress);frame.anchor.set(.5);frame.width=w;frame.height=h;score.addChild(frame);
  const titleSize=Math.max(12,w*.08),titleY=y-h/2-15;
  at(label('本場進度',titleSize,PALETTE.gold,{letterSpacing:1}),x,titleY,hud);
  at(label(`${rule.id==='dealer'?'荷官':rule.name}出牌`,titleSize,PALETTE.gold,{letterSpacing:1}),dealerCard.x*scale,titleY,hud);
  for(const [index,[name,target,color]] of [['勝',rule.winsRequired,PALETTE.win],['敗',rule.lossLimit,PALETTE.loss]].entries()){
    const rowY=(index?1:-1)*h*.22;
    at(label(name,Math.max(12,w*.095),color),-w*.28,rowY,score);
    const number=at(label('0',Math.max(28,w*.34),color,{fontFamily:['Georgia','serif'],fontWeight:'bold'}),0,rowY,score);
    at(label('/ '+target,Math.max(12,w*.105),PALETTE.muted),w*.28,rowY+w*.025,score);
    if(index)scene.scoreLosses=number;else scene.scoreWins=number;
  }
  score.addChild(new Graphics().moveTo(-w*.27,0).lineTo(w*.27,0).stroke({color:PALETTE.gold,width:.7,alpha:.22}));
}

function updateDialogue(scene){
  const bubble=scene.dialogueBubble;
  if(!bubble)return;
  bubble.visible=['selecting','confirmed'].includes(scene.phase) && !!scene.dialogue;
  if(!bubble.visible || bubble.dialogue===scene.dialogue)return;
  bubble.dialogue=scene.dialogue;
  bubble.removeChildren().forEach(child=>child.destroy({children:true}));
  const l=scene.layout,{width}=l.ui;
  const w=Math.min(440,width-2*l.progress.x-l.progress.width-24),size=width<700?12:15;
  const text=label(`「${scene.dialogue}」`,size,PALETTE.cream,{fontWeight:'500',wordWrap:true,wordWrapWidth:w-20,lineHeight:size*1.5});
  const h=text.height+22;
  const frame=new Graphics().roundRect(-w/2,-h/2,w,h,9).fill({color:0x101422,alpha:.91}).stroke({color:PALETTE.gold,alpha:.42,width:1});
  bubble.addChild(frame,text);bubble.position.set(width/2,(l.table.y-l.table.ry)*l.scale-h/2-8);
}

export function buildSlotHud(scene){
  if(scene.screen==='games')return;
  const {ui,scale}=scene.layout,{width,height,headerHeight}=ui;
  const h=yakyukenHeaderLayout(width,height),{narrow,small,left,avatarSize,identityY}=h;
  const hud=new Container({label:'slot-style-chrome'});hud.scale.set(1/scale);scene.world.addChild(hud);scene.hud=hud;
  const shade=new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:'#19101ee8'},{offset:1,color:'#21142655'}]});
  hud.addChild(new Graphics().rect(0,0,width,headerHeight).fill(shade));
  const avatar=at(new Container({label:'player-avatar',eventMode:'none'}),left+avatarSize/2,identityY,hud);
  const portrait=new Graphics().circle(0,0,avatarSize/2-.5).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0x825342},{offset:.58,color:0x442638},{offset:1,color:0x281d30}]})).stroke({color:0xbf925e,width:1,alpha:.53});
  avatar.addChild(portrait);
  const fallback=slotIcon(icon('user'),narrow?19:23,0xf4d59b);avatar.addChild(fallback);attachPortrait(scene,avatar,avatarSize,fallback);
  avatar.addChild(new Graphics().circle(avatarSize/2-5,avatarSize/2-5,3).fill(scene.activity?.user?0xa9e9b9:0xb5a0b1).stroke({color:0x24182c,width:2}));
  const textX=left+avatarSize+(narrow?8:12),textWidth=h.checkin.x-12-textX;
  const identity=playerIdentity(scene),name=leftLabel(identity.name,narrow?14:height<=500?13:15,PALETTE.cream,textX,identityY-10,hud,{fontWeight:'500'});
  scene.playerNameCaption=name;
  while(name.width>Math.min(320,textWidth)&&name.text.length>1)name.text=name.text.replace(/…$/,'').slice(0,-1)+'…';
  scene.playerIdCaption=leftLabel(identity.detail,small?11:12,0xd7bfbf,textX,identityY+3,hud,{wordWrap:true,breakWords:true,wordWrapWidth:textWidth,align:'left',lineHeight:small?17.6:19.2});scene.playerIdCaption.anchor.y=0;
  buildBalance(scene,hud,width,headerHeight);
  const {x,y,width:checkinWidth}=h.checkin;
  Object.assign(scene.checkinButton.element.style,{left:`${x}px`,top:`${y}px`,width:`${checkinWidth}px`});
  const {toolsX,toolsY,toolsWidth,toolsHeight,centers}=h,cy=toolsY+toolsHeight/2;
  hud.addChild(new Graphics({label:'player-tools-frame'}).roundRect(toolsX,toolsY,toolsWidth,toolsHeight,narrow?11:12).fill({color:0x2b1d2d,alpha:.85}).stroke({color:0xc99b5b,alpha:.21,width:1}));
  const sound=at(new PixiButton({name:scene.audio.effectsMuted?'開啟音效':'關閉音效',variant:'utility',width:48,height:48,icon:icon(scene.audio.effectsMuted?'muted':'sound'),onPress:async()=>{
    await scene.audio.toggleEffects();scene.refreshAudioIcons?.();
  }}),centers[0],cy,hud);
  const music=at(new PixiButton({name:scene.audio.musicMuted?'開啟音樂':'關閉音樂',variant:'utility',width:48,height:48,icon:icon(scene.audio.musicMuted?'musicMuted':'music'),onPress:async()=>{
    await scene.audio.toggleMusic();scene.refreshAudioIcons?.();
  }}),centers[1],cy,hud);
  scene.refreshAudioIcons=()=>{
    if(scene.disposed || music.destroyed || sound.destroyed)return;
    sound.setActive(!scene.audio.effectsMuted);sound.setIcon(icon(scene.audio.effectsMuted?'muted':'sound'));sound.setName(scene.audio.effectsMuted?'開啟音效':'關閉音效');
    music.setActive(!scene.audio.musicMuted);music.setIcon(icon(scene.audio.musicMuted?'musicMuted':'music'));music.setName(scene.audio.musicMuted?'開啟音樂':'關閉音樂');
  };scene.refreshAudioIcons();
  hud.addChild(new Graphics().moveTo(centers[1]+33,toolsY+9).lineTo(centers[1]+33,toolsY+toolsHeight-9).stroke({color:0xc99b5b,width:1,alpha:.19}));
  scene.collectionButton=at(new PixiButton({name:'CG 收藏',variant:'utility',width:48,height:48,icon:icon('gallery'),onPress:()=>scene.openModal('collection')}),centers[2],cy,hud);
  scene.historyButton=at(new PixiButton({name:'遊玩紀錄',variant:'utility',width:48,height:48,icon:icon('clock'),onPress:()=>{scene.historyScroll=0;scene.openModal('history');}}),centers[3],cy,hud);
  scene.lobbyButton=at(new PixiButton({name:'返回遊戲大廳',variant:'utility',width:48,height:48,icon:icon('lobby'),onPress:()=>scene.visitScreen('games')}),centers[4],cy,hud);
  if(scene.screen!=='table')return;
  const {action,status}=scene.layout;
  scene.confirmButton=at(new PixiButton({text:'確認出牌',name:'確認出牌',variant:'duel',width:action.width,height:action.height,fontSize:action.fontSize??17,onPress:()=>scene.confirm()}),action.x,action.y,hud);
  scene.returnButton=at(new PixiButton({text:'返回',name:'返回',width:action.width,height:action.height,fontSize:18,onPress:()=>scene.returnToCharacters()}),action.x,action.y,hud);scene.returnButton.visible=false;scene.returnButton.setEnabled(false);
  scene.status=at(label('',status.fontSize??(ui.mobile?16:18),PALETTE.cream,{fontWeight:'600',wordWrap:true,breakWords:true,wordWrapWidth:status.width,lineHeight:status.lineHeight??Math.max(23,(status.fontSize??18)*1.3)}),status.x,status.y,hud);
  scene.statusDetail=at(label('',status.detailSize??12,0xcbb8b5,{wordWrap:true,breakWords:true,wordWrapWidth:status.width,lineHeight:status.detailLineHeight??Math.max(17,(status.detailSize??12)*1.4)}),status.x,status.y+status.detailGap,hud);
  buildProgress(scene,hud);
  scene.dialogueBubble=new Container({label:'dealer-dialogue',eventMode:'none'});hud.addChild(scene.dialogueBubble);
}

export function updateSlotHud(scene){
  updateBalance(scene);
  scene.syncCheckinButton();
  scene.lobbyButton?.setEnabled(!scene.settling&&!scene.rewardPresentation.busy&&!scene.wallet?.pending&&scene.phase!=='presenting' && !scene.changing && !scene.ending);
  scene.collectionButton?.setEnabled(!scene.rewardPresentation.busy);scene.historyButton?.setEnabled(!scene.rewardPresentation.busy);
  if(scene.screen!=='table' || !scene.confirmButton)return;
  const {phase,selected,duel}=scene,confirmed=phase==='confirmed',retrying=phase==='retrying';
  const rule=characterRule(scene.selectedCharacter),opponent=rule.id==='dealer'?'荷官':rule.name,challenge=scene.challenge,finished=challenge?.status!=='playing';
  const pending=phase==='presenting'?duel?.outcome:null;
  const wins=(challenge?.wins || 0)-Number(pending==='win'),losses=(challenge?.losses || 0)-Number(pending==='loss');
  scene.scoreWins.text=String(wins);scene.scoreLosses.text=String(losses);
  scene.scoreDescription=rule.name+'，'+wins+' 勝，目標 '+rule.winsRequired+' 勝；'+losses+' 敗，上限 '+rule.lossLimit+' 敗';
  const results=confirmed&&finished,resultLayout=results?resultActionLayout(scene.layout):null;
  const primary=resultLayout?.primary??scene.layout.action;
  const statusX=resultLayout?.stackStatus?resultLayout.x:scene.layout.status.x,statusWidth=resultLayout?.stackStatus?resultLayout.width:scene.layout.status.width;
  for(const text of [scene.status,scene.statusDetail]){text.x=statusX;text.style.wordWrapWidth=statusWidth;}
  scene.confirmButton.resizeButton(primary.width,primary.height);scene.confirmButton.position.set(primary.x,primary.y);scene.confirmButton.caption.style.fontSize=primary.fontSize??17;
  scene.returnButton.visible=results;
  if(results){const back=resultLayout.secondary;scene.returnButton.resizeButton(back.width,back.height);scene.returnButton.position.set(back.x,back.y);scene.returnButton.caption.style.fontSize=back.fontSize;}
  scene.returnButton.setEnabled(results&&!scene.settling&&!scene.rewardPresentation.busy&&!scene.changing&&!scene.entering&&!scene.wallet?.pending);
  const paused=finished&&scene.wallet?.admissionOpen===false;
  const next=finished?(paused?'暫停新場次':'再次挑戰'):'下一拳';
  const retryName=scene.wallet?.pending?'重試上一拳':'更新進度';
  scene.confirmButton.setText(scene.rewardPresentation.busy?'領獎中…':confirmed?next:retrying?retryName:phase==='confirming'?'正在確認紀錄…':phase==='requesting'?'正在確認出牌…':phase==='presenting'?`${opponent}出牌中…`:'確認出牌');
  scene.confirmButton.caption.scale.set(1);
  scene.confirmButton.caption.scale.set(Math.min(1,(scene.confirmButton.buttonWidth-24)/scene.confirmButton.caption.width));
  scene.confirmButton.setName(confirmed?next:retrying?retryName:'確認出牌');
  scene.confirmButton.setEnabled(!scene.settling&&!scene.rewardPresentation.busy&&!scene.changing && !scene.ending && (confirmed&&!paused || retrying || phase==='selecting' && !!selected));
  scene.status.text=confirmed?{win:'你贏了這拳',loss:`${opponent}贏了這拳`,draw:'平手'}[duel.outcome]:phase==='presenting'?`${opponent}準備翻牌`:selected?'已選'+TABLE_MOVE_NAMES[selected]:'輪到你出牌';
  scene.statusDetail.text=confirmed?`你出${TABLE_MOVE_NAMES[selected]} · ${opponent}出${TABLE_MOVE_NAMES[duel.dealer]}`:phase==='presenting'?'等對手翻牌':selected?'準備好就確認出牌':'選一張牌出拳';
  if(phase==='confirming'){
    scene.status.text=duel?{win:'你贏了這拳',loss:`${opponent}贏了這拳`,draw:'平手'}[duel.outcome]:'正在確認出牌';
    scene.statusDetail.text='正在確認紀錄…';
  }
  if(retrying){scene.status.text='上一拳還沒確認';scene.statusDetail.text=scene.handTurn?.error||`請按「${retryName}」。`;}
  if(confirmed && finished){
    scene.status.text=challenge.status==='won'?'通關了！':'挑戰結束';
    scene.statusDetail.text=challenge.status==='won'?'獎金 '+challenge.reward.toLocaleString('en-US')+' 戲籌 · '+(scene.wallet?'已入帳':'試玩未入帳'):'這次挑戰未通關';
    if(scene.rewardPresentation.busy)scene.statusDetail.text=scene.rewardPresentation.stage==='counting'?'獎金累計中…':'最後一幕，為你揭曉';
  }
  if(scene.layout.status.autoStack){
    const {status}=scene.layout,action=resultLayout?{...scene.layout.action,y:resultLayout.y,height:resultLayout.height}:scene.layout.action;
    if(status.sideBySide&&!resultLayout?.stackStatus){
      const total=scene.status.height+status.gap+scene.statusDetail.height;
      const top=Math.min(scene.layout.ui.height-8-total,Math.max(status.feltTop+8,action.y-total/2));
      scene.status.y=top+scene.status.height/2;
      scene.statusDetail.y=top+scene.status.height+status.gap+scene.statusDetail.height/2;
    }else{
      scene.statusDetail.y=action.y-action.height/2-status.gap-scene.statusDetail.height/2;
      scene.status.y=scene.statusDetail.y-scene.statusDetail.height/2-status.gap-scene.status.height/2;
    }
  }
  updateDialogue(scene);
}
