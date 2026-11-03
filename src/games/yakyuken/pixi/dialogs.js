import {Container,Graphics,Rectangle,Sprite} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {DEALER_ART} from '../assets.js';
import {label,panel,PALETTE,PixiButton} from './ui.js';
import {SLOT_UI} from './slot-theme.js';
import {DIFFICULTIES,difficultyRule} from '../challenge.js';

export function buildSlotDialog(scene,type){
  const {ui,scale}=scene.layout,{width,height}=ui;
  scene.world.interactiveChildren=false;scene.world.accessibleChildren=false;
  const root=new Container({label:`modal:${type}`});root.scale.set(1/scale);scene.modalRoot=root;scene.root.addChild(root);
  const shade=new Graphics().rect(0,0,width,height).fill({color:0x13081d,alpha:.85});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,width,height);shade.on('pointertap',()=>scene.closeModal());root.addChild(shade);
  const mw=Math.min(type==='wardrobe'?800:660,width-32),artHeight=Math.min(330,((mw-48)/3-8)*1.5,height-210);
  const mh=Math.min(height-32,type==='wardrobe'?artHeight+174:type==='help'?480:type==='difficulty'?440:400);
  const body=new Container({label:'slot-dialog'});body.position.set(width/2,height/2);body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',event=>event.stopPropagation());body.addChild(panel(mw,mh));root.addChild(body);
  const title=label({menu:'遊戲選單',help:'遊戲規則',settings:'遊戲設定',wardrobe:'荷官與造型',difficulty:'選擇挑戰難度'}[type],width<=450?17:SLOT_UI.dialogTitleSize,PALETTE.gold,{fontWeight:'500'});title.anchor.set(0,.5);title.position.set(-mw/2+22,-mh/2+33);body.addChild(title);
  const close=new PixiButton({name:'關閉視窗',icon:icon('close'),variant:'utility',width:44,height:44,onPress:()=>scene.closeModal()});close.position.set(mw/2-36,-mh/2+33);body.addChild(close);
  const addButton=(text,y,onPress,name=text)=>{
    const button=new PixiButton({text,name,width:Math.min(360,mw-44),height:44,fontSize:14,onPress});button.y=y;body.addChild(button);return button;
  };
  const paragraph=(text,y,size=13,color=0xdeccd7)=>{
    const node=label(text,size,color,{wordWrap:true,wordWrapWidth:mw-44,lineHeight:size*1.9,align:'left'});node.anchor.set(0,0);node.position.set(-mw/2+22,y);body.addChild(node);return node;
  };
  if(type==='menu'){
    const entries=[['繼續遊戲',null],...(scene.screen==='table'?[['荷官與造型','wardrobe']]:[]),['遊戲設定','settings']];
    for(const [index,[text,target]] of entries.entries()){
      addButton(text,-mh/2+100+index*52,()=>target?scene.openModal(target):scene.closeModal());
    }
  }else if(type==='difficulty'){
    const rule=difficultyRule(scene.selectedDifficulty),gap=6,bw=(mw-44-gap*4)/5;
    DIFFICULTIES.forEach((entry,index)=>{
      const button=new PixiButton({text:entry.name,name:`難度${entry.name}`,width:bw,height:44,onPress:()=>scene.selectDifficulty(entry.id)});
      button.position.set(-mw/2+22+bw/2+index*(bw+gap),-mh/2+96);button.setPressed(entry.id===rule.id);body.addChild(button);
    });
    paragraph(`難度${rule.name}・${rule.winsRequired} 勝通關／第 ${rule.lossLimit} 敗結束\n通關獎金 ${rule.reward.toLocaleString('en-US')} 戲籌\n每拳勝 ${(rule.winWeight/100).toFixed(2)}%／敗 ${(rule.lossWeight/100).toFixed(2)}%\n平手 20%，不計勝敗，不另收費\n整場通關約 ${Math.round(rule.clearRate*100)}%`, -mh/2+132,12);
    paragraph('入場 1,000 戲籌・本機暫不扣款／發獎',mh/2-88,12,PALETTE.muted);
    addButton('使用此難度',mh/2-38,()=>scene.closeModal());
  }else if(type==='help'){
    const rule=difficultyRule(scene.selectedDifficulty);
    paragraph(`難度${rule.name}：累積 ${rule.winsRequired} 勝通關，第 ${rule.lossLimit} 敗結束。\n通關獎金 ${rule.reward.toLocaleString('en-US')} 戲籌。\n每拳勝 ${(rule.winWeight/100).toFixed(2)}%／敗 ${(rule.lossWeight/100).toFixed(2)}%／平 20%。\n平手不計勝敗；敗場不清除累積勝場。\n拳頭勝剪刀、剪刀勝布、布勝拳頭。\n1／2／3 選牌，Enter 出牌，Esc 選單。`, -mh/2+72,height<550?12:13);
    paragraph('本機試玩暫不扣款／發獎，遊玩紀錄尚未開放。',mh/2-88,12,PALETTE.muted);
    addButton('遊戲設定與造型',mh/2-38,()=>scene.openModal('menu'));
  }else if(type==='settings'){
    const start=-mh/2+100;
    addButton('音效尚未加入',start,()=>{}).setEnabled(false);
    const music=addButton(scene.audio.musicMuted?'開啟音樂':'關閉音樂',start+52,async()=>{
      try{await scene.audio.toggleMusic();scene.refreshAudioIcons?.();if(!music.destroyed)music.setText(scene.audio.musicMuted?'開啟音樂':'關閉音樂');}catch{}
    },'切換音樂');
    const motion=addButton(scene.motion.reduced?'動態效果：減少':'動態效果：標準',start+104,()=>{
      scene.reducePreference=!scene.motion.reduced;scene.motion.reduced=!!scene.reducePreference || scene.media.matches;if(scene.motion.reduced)scene.motion.finish();scene.openModal('settings');
    },'切換動態效果');
    if(scene.media.matches){motion.setText('動態效果：跟隨系統減少');motion.setEnabled(false);}
    const fullscreen=addButton(document.fullscreenElement?'離開全螢幕':'全螢幕',start+156,async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await scene.host.requestFullscreen();if(!scene.disposed && scene.modal==='settings')scene.openModal('settings');}
      catch{if(!fullscreen.destroyed)fullscreen.setText('此視窗不支援全螢幕');}
    },'切換全螢幕');
  }else if(type==='wardrobe'){
    const cell=(mw-48)/3;
    DEALER_ART.forEach((art,index)=>{
      const image=new Sprite(scene.dealerTextures[index]);image.anchor.set(.5,0);image.height=artHeight;image.scale.x=image.scale.y;image.position.set((index-1)*cell,-mh/2+70);body.addChild(image);
      const button=new PixiButton({text:art.name,name:`預覽${art.name}造型`,width:cell-8,height:44,fontSize:12,onPress:()=>scene.changePose(index)});
      button.position.set((index-1)*cell,-mh/2+artHeight+100);body.addChild(button);
    });
    const future=label('其餘四位角色・敬請期待',12,PALETTE.muted);future.y=mh/2-22;body.addChild(future);
  }
  scene.app.canvas.dataset.modal=type;
}
