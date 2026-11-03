import {Container,Graphics,Rectangle,Sprite} from 'pixi.js';
import {icon} from '../../../ui/shared/icons.js';
import {DEALER_ART} from '../assets.js';
import {label,panel,PALETTE,PixiButton} from './ui.js';
import {SLOT_UI} from './slot-theme.js';
import {TABLE_MOVE_NAMES} from './layout.js';

export function buildSlotDialog(scene,type){
  const {ui,scale}=scene.layout,{width,height}=ui;
  scene.world.interactiveChildren=false;scene.world.accessibleChildren=false;
  const root=new Container({label:`modal:${type}`});root.scale.set(1/scale);scene.modalRoot=root;scene.root.addChild(root);
  const shade=new Graphics().rect(0,0,width,height).fill({color:0x13081d,alpha:.85});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,width,height);shade.on('pointertap',()=>scene.closeModal());root.addChild(shade);
  const mw=Math.min(type==='wardrobe'?800:660,width-32),artHeight=Math.min(330,((mw-48)/3-8)*1.5,height-210);
  const mh=Math.min(height-32,type==='wardrobe'?artHeight+174:type==='help'?480:type==='history'?480:400);
  const body=new Container({label:'slot-dialog'});body.position.set(width/2,height/2);body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',event=>event.stopPropagation());body.addChild(panel(mw,mh));root.addChild(body);
  const title=label({menu:'遊戲選單',help:'遊戲規則',settings:'遊戲設定',wardrobe:'荷官與造型',history:'遊玩紀錄'}[type],width<=450?17:SLOT_UI.dialogTitleSize,PALETTE.gold,{fontWeight:'500'});title.anchor.set(0,.5);title.position.set(-mw/2+22,-mh/2+33);body.addChild(title);
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
  }else if(type==='help'){
    if(height<550){
      paragraph('雙方各有拳頭、剪刀、布三張牌。\n選牌後按出牌，只翻開荷官選中的牌。\n拳頭勝剪刀、剪刀勝布、布勝拳頭。\n1／2／3 選牌，Enter 確認，Esc 開關選單。',-mh/2+72);
    }else{
      paragraph('準備好，讓表演開始',-mh/2+72,14,PALETTE.gold);
      paragraph('雙方各有拳頭、剪刀、布三張牌。\n選好手牌，按下中央的出牌按鈕。\n\n荷官先蓋牌，出牌時只翻開選中的一張。\n拳頭勝剪刀、剪刀勝布、布勝拳頭。\n\n鍵盤 1／2／3 選牌，Enter 確認；Esc 開關選單。',-mh/2+109);
    }
    paragraph('本機展示使用固定出牌順序，不扣戲籌；正式機率另行確認。',mh/2-96,12,PALETTE.muted);
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
  }else if(type==='history'){
    paragraph('本機展示紀錄，重新整理後清除。',-mh/2+72,12,PALETTE.muted);
    const entries=scene.history.slice(-Math.max(1,Math.floor((mh-150)/48))).reverse();
    if(!entries.length)paragraph('還沒有遊玩紀錄\n開始遊戲後，就能在這裡查看。',-mh/2+130,14);
    entries.forEach((entry,index)=>{
      const y=-mh/2+108+index*48;
      paragraph(`第 ${entry.round} 局・你出${TABLE_MOVE_NAMES[entry.player]}／荷官出${TABLE_MOVE_NAMES[entry.dealer]}`,y,13);
      const result=label({win:'你贏了',loss:'荷官獲勝',draw:'平手'}[entry.outcome],12,PALETTE.gold);result.anchor.set(1,0);result.position.set(mw/2-22,y+23);body.addChild(result);
      body.addChild(new Graphics().moveTo(-mw/2+22,y+42).lineTo(mw/2-22,y+42).stroke({color:0xc79a5f,width:1,alpha:.2}));
    });
  }
  scene.app.canvas.dataset.modal=type;
}
