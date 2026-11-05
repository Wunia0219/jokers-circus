import {Container,FillGradient,Graphics,Sprite} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,PALETTE,PixiButton,slotIcon} from './ui.js';
import {TABLE_MOVE_NAMES} from './layout.js';
import {yakyukenHeaderLayout} from './header-layout.js';
import {characterRule} from '../characters.js';

function at(node,x,y,parent){node.position.set(x,y);parent.addChild(node);return node;}
function leftLabel(text,size,color,x,y,parent,options={}){const node=label(text,size,color,options);node.anchor.set(0,.5);return at(node,x,y,parent);}

function buildProgress(scene,hud){
  const {progress,dealerCard,scale}=scene.layout,{x,y,width:w,height:h}=progress,rule=characterRule(scene.selectedCharacter);
  const score=at(new Container({label:'challenge-progress',eventMode:'none'}),x,y,hud);scene.score=score;
  const frame=new Sprite(scene.cardTextures.progress);frame.anchor.set(.5);frame.width=w;frame.height=h;score.addChild(frame);
  const titleSize=Math.max(12,w*.08),titleY=y-h/2-15;
  at(label('本場進度',titleSize,PALETTE.gold,{letterSpacing:1}),x,titleY,hud);
  at(label('荷官出牌',titleSize,PALETTE.gold,{letterSpacing:1}),dealerCard.x*scale,titleY,hud);
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
  bubble.visible=scene.phase==='confirmed' && !!scene.dialogue;
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
  portrait.circle(avatarSize/2-5,avatarSize/2-5,3).fill(0xb5a0b1).stroke({color:0x24182c,width:2});avatar.addChild(portrait,slotIcon(icon('user'),narrow?19:23,0xf4d59b));
  const textX=left+avatarSize+(narrow?8:12),textWidth=h.checkin.x-12-textX;
  leftLabel(scene.wallet?.wallet.name||'訪客玩家',narrow?14:height<=500?13:15,PALETTE.cream,textX,identityY-10,hud,{fontWeight:'500'});
  scene.walletCaption=leftLabel(scene.wallet?`測試戲籌 ${scene.wallet.wallet.balance.toLocaleString('en-US')}`:'本機試玩・暫不扣款',small?11:12,0xd7bfbf,textX,identityY+11,hud,{wordWrap:true,wordWrapWidth:textWidth,align:'left'});
  const c=h.checkin,checkin=at(new PixiButton({name:scene.wallet?'領取測試週簽到':'週簽到・介面預覽',width:c.width,height:56,onPress:()=>scene.claimDaily()}),c.x+c.width/2,c.y+28,hud);checkin.cursor=scene.wallet?'pointer':'default';scene.checkinButton=checkin;
  checkin.background.clear().roundRect(-c.width/2,-28,c.width,56,12).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:.2},colorStops:[{offset:0,color:0x73452f},{offset:1,color:0x5c2f39}]})).stroke({color:0xc79a5f,width:1});
  const copyWidth=6*(narrow?11:12),giftSize=narrow?18:20,giftGap=narrow?8:10;
  const contentX=-(copyWidth+(small?0:giftSize+giftGap))/2;
  if(!small){const gift=slotIcon(icon('gift'),giftSize);gift.position.set(contentX,-giftSize/2);checkin.addChild(gift);}
  const copyX=contentX+(small?0:giftSize+giftGap);
  leftLabel('週簽到',narrow?12:14,0xffe9bc,copyX,-10,checkin,{fontWeight:'500'});
  scene.checkinCopy=leftLabel('查看七日獎勵',narrow?11:12,0xffdfab,copyX,11,checkin);
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
  at(new PixiButton({name:'CG 收藏',variant:'utility',width:48,height:48,icon:icon('gallery'),onPress:()=>scene.openModal('collection')}),centers[2],cy,hud);
  at(new PixiButton({name:'遊玩紀錄',variant:'utility',width:48,height:48,icon:icon('clock'),onPress:()=>{scene.historyScroll=0;scene.openModal('history');}}),centers[3],cy,hud);
  scene.lobbyButton=at(new PixiButton({name:'返回遊戲大廳',variant:'utility',width:48,height:48,icon:icon('lobby'),onPress:()=>scene.visitScreen('games')}),centers[4],cy,hud);
  if(scene.screen!=='table')return;
  const {action,status}=scene.layout;
  scene.confirmButton=at(new PixiButton({text:'確認出牌',name:'確認出牌',variant:'duel',width:action.width,height:action.height,fontSize:action.fontSize??17,onPress:()=>scene.confirm()}),action.x,action.y,hud);
  scene.status=at(label('',status.fontSize??(ui.mobile?16:18),PALETTE.cream,{fontWeight:'600',wordWrap:true,wordWrapWidth:status.width,lineHeight:Math.max(23,(status.fontSize??18)*1.3)}),status.x,status.y,hud);
  scene.statusDetail=at(label('',status.detailSize??12,0xcbb8b5,{wordWrap:true,wordWrapWidth:status.width,lineHeight:Math.max(17,(status.detailSize??12)*1.4)}),status.x,status.y+status.detailGap,hud);
  buildProgress(scene,hud);
  scene.dialogueBubble=new Container({label:'dealer-dialogue',eventMode:'none'});hud.addChild(scene.dialogueBubble);
}

export function updateSlotHud(scene){
  if(scene.wallet&&scene.walletCaption&&!scene.walletCaption.destroyed){
    scene.walletCaption.text=`測試戲籌 ${scene.wallet.wallet.balance.toLocaleString('en-US')}`;
    const view=scene.wallet.wallet.checkinView,retry=scene.wallet.pending?.action==='checkin';scene.checkinCopy.text=retry?'點此重試簽到':view.claimed?'今日已領取':`領取 ${view.daily.toLocaleString('en-US')} 戲籌`;
    scene.checkinButton.setName(retry?'重試測試週簽到':'領取測試週簽到');
    scene.checkinButton.setEnabled(!view.claimed&&!scene.settling&&(!scene.wallet.pending||retry));
  }
  scene.lobbyButton?.setEnabled(!scene.settling&&!scene.wallet?.pending&&scene.phase!=='presenting' && !scene.changing && !scene.ending);
  if(scene.screen!=='table' || !scene.confirmButton)return;
  const {phase,selected,duel}=scene,confirmed=phase==='confirmed';
  const rule=characterRule(scene.selectedCharacter),challenge=scene.challenge,finished=challenge?.status!=='playing';
  const pending=phase==='presenting'?duel?.outcome:null;
  const wins=(challenge?.wins || 0)-Number(pending==='win'),losses=(challenge?.losses || 0)-Number(pending==='loss');
  scene.scoreWins.text=String(wins);scene.scoreLosses.text=String(losses);
  scene.scoreDescription=rule.name+'，'+wins+' 勝，目標 '+rule.winsRequired+' 勝；'+losses+' 敗，上限 '+rule.lossLimit+' 敗';
  const next=challenge?.status==='lost'?'返回選擇荷官…':finished?'再挑戰一次':'下一局';
  scene.confirmButton.setText(confirmed?next:phase==='requesting'?'正在確認出牌…':phase==='presenting'?'荷官出牌中…':scene.wallet?.pending?'重試上一拳':'確認出牌');
  scene.confirmButton.setName(confirmed?next:'確認出牌');
  scene.confirmButton.setEnabled(!scene.settling&&!scene.changing && !scene.ending && challenge?.status!=='lost' && (confirmed || phase==='selecting' && !!selected));
  scene.status.text=confirmed?{win:'你贏了',loss:'荷官獲勝',draw:'平手，再來一拳'}[duel.outcome]:phase==='presenting'?'荷官即將揭牌':selected?'已選'+TABLE_MOVE_NAMES[selected]:'輪到你出牌';
  scene.statusDetail.text=confirmed?'你出'+TABLE_MOVE_NAMES[selected]+' · 荷官出'+TABLE_MOVE_NAMES[duel.dealer]:phase==='presenting'?'好戲，即將揭曉':selected?'準備好了，就出這一張':'選擇手牌，與命運一決勝負';
  if(confirmed && finished){
    scene.status.text=challenge.status==='won'?'挑戰通關':'挑戰結束';
    scene.statusDetail.text=challenge.status==='won'?'獎金 '+challenge.reward.toLocaleString('en-US')+' 戲籌 · 試玩未入帳':'已達敗場上限，本場無獎金';
  }
  updateDialogue(scene);
}
