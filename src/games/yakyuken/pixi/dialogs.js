import {Container,Graphics,Rectangle} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,panel,PALETTE,PixiButton} from '../../../ui/pixi/ui.js';
import {SLOT_UI} from '../../../ui/pixi/slot-theme.js';
import {buildArchiveDialog} from './archive-dialogs.js';

export function buildSlotDialog(scene,type){
  if(['collection','cg','history'].includes(type))return buildArchiveDialog(scene,type);
  const {ui,scale}=scene.layout,{width,height}=ui;
  scene.world.interactiveChildren=false;scene.world.accessibleChildren=false;
  const root=new Container({label:`modal:${type}`});root.scale.set(1/scale);scene.modalRoot=root;scene.root.addChild(root);
  const shade=new Graphics().rect(0,0,width,height).fill({color:0x13081d,alpha:.85});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,width,height);shade.on('pointertap',()=>scene.closeModal());root.addChild(shade);
  const mw=Math.min(660,width-32),mh=Math.min(height-32,type==='leave'?280:400);
  const body=new Container({label:'slot-dialog'});body.position.set(width/2,height/2);body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',event=>event.stopPropagation());body.addChild(panel(mw,mh));root.addChild(body);
  const title=label({menu:'遊戲選單',settings:'遊戲設定',leave:'離開這場挑戰？'}[type],width<=450?17:SLOT_UI.dialogTitleSize,PALETTE.gold,{fontWeight:'500'});title.anchor.set(0,.5);title.position.set(-mw/2+22,-mh/2+33);body.addChild(title);
  const close=new PixiButton({name:'關閉視窗',icon:icon('close'),iconSize:21,variant:'close',width:44,height:44,onPress:()=>scene.closeModal()});close.position.set(mw/2-36,-mh/2+33);body.addChild(close);
  const addButton=(text,y,onPress,name=text)=>{
    const button=new PixiButton({text,name,width:Math.min(360,mw-44),height:44,fontSize:14,onPress});button.y=y;body.addChild(button);return button;
  };
  const paragraph=(text,y,size=13,color=0xdeccd7)=>{
    const node=label(text,size,color,{wordWrap:true,wordWrapWidth:mw-44,lineHeight:size*1.9,align:'left'});node.anchor.set(0,0);node.position.set(-mw/2+22,y);body.addChild(node);return node;
  };
  if(type==='leave'){
    paragraph(scene.wallet?'這場還沒打完，入場時已扣除 1,000 戲籌。\n現在離開，入場費不會退還。':'本場尚未完成。\n現在離開，將結束這場挑戰。',-mh/2+92,14);
    const bw=Math.min(210,(mw-56)/2);
    for(const [text,x,onPress,variant] of [['繼續遊戲',-bw/2-6,()=>scene.closeModal(),'panel'],['確認離開',bw/2+6,()=>scene.confirmLeave(),'duel']]){
      const button=new PixiButton({text,name:text,width:bw,height:48,variant,onPress});button.position.set(x,mh/2-54);body.addChild(button);
    }
  }else if(type==='menu'){
    const entries=[['繼續遊戲',null],['CG 收藏','collection'],['遊玩紀錄','history'],['遊戲設定','settings']];
    for(const [index,[text,target]] of entries.entries()){
      addButton(text,-mh/2+100+index*52,()=>target?scene.openModal(target):scene.closeModal());
    }
  }else if(type==='settings'){
    const start=-mh/2+100;
    const music=addButton(scene.audio.musicMuted?'開啟音樂':'關閉音樂',start,async()=>{
      try{await scene.audio.toggleMusic();scene.refreshAudioIcons?.();if(!music.destroyed)music.setText(scene.audio.musicMuted?'開啟音樂':'關閉音樂');}catch{}
    },'切換音樂');
    const motion=addButton(scene.motion.reduced?'動態效果：減少':'動態效果：標準',start+52,()=>{
      scene.reducePreference=!scene.motion.reduced;scene.motion.reduced=!!scene.reducePreference || scene.media.matches;if(scene.motion.reduced)scene.motion.finish();scene.openModal('settings');
    },'切換動態效果');
    if(scene.media.matches){motion.setText('動態效果：跟隨系統減少');motion.setEnabled(false);}
    const fullscreen=addButton(document.fullscreenElement?'離開全螢幕':'全螢幕',start+104,async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await scene.host.requestFullscreen();if(!scene.disposed && scene.modal==='settings')scene.openModal('settings');}
      catch{if(!fullscreen.destroyed)fullscreen.setText('此視窗不支援全螢幕');}
    },'切換全螢幕');
  }
  scene.app.canvas.dataset.modal=type;
}
