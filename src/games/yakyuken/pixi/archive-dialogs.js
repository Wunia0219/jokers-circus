import {Container,Graphics,Rectangle,Sprite} from 'pixi.js';
import {characterRule} from '../characters.js';
import {icon} from '../../../ui/shared/icons.js';
import {APP_VERSION} from '../../../version.js';
import {DIALOG_BRAND,DIALOG_FOOTER} from '../../../ui/shared/dialog-spec.js';
import {downloadCG} from '../cg-download.js';
import {buildMatchHistory} from './match-history.js';
import {label,panel,PALETTE,PixiButton,slotIcon} from './ui.js';

const lock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/></svg>';
const downloadGlyph='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v10.75m-3.75-3.5L12 14.5l3.75-3.75"/><path d="M4.5 15.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3.5"/></svg>';
const place=(node,x,y,parent)=>{node.position.set(x,y);parent.addChild(node);return node;};
const text=(value,size,x,y,parent,color=PALETTE.cream,options={})=>place(label(value,size,color,options),x,y,parent);
function leftText(value,size,x,y,parent,color=PALETTE.cream){const node=text(value,size,x,y,parent,color);node.anchor.x=0;return node;}
function navigation(text,name,direction,onPress){
  const button=new PixiButton({text,name,variant:'quiet',width:96,height:44,fontSize:13,onPress});
  const arrow=slotIcon(icon('arrow'),16,PALETTE.muted);arrow.pivot.set(12,12);arrow.position.set(direction<0?-32:32,0);if(direction<0)arrow.rotation=Math.PI;
  button.caption.x=direction<0?8:-8;button.addChild(arrow);return button;
}
function thumbnail(texture,parent,{x,y,width,height}){
  const image=new Sprite(texture);image.anchor.set(.5,0);image.height=height/.44;image.scale.x=image.scale.y;image.position.set(x,y-height/2);
  const mask=new Graphics().roundRect(x-width/2,y-height/2,width,height,6).fill(0xffffff);
  parent.addChild(image,mask);image.mask=mask;
}
function storageCaption(scene,body,mw,y){
  text(scene.archive.cloud?'收藏與紀錄儲存在測試雲端':scene.archive.persistent?'收藏與紀錄儲存在這台裝置':'目前無法儲存，資料只保留在此頁',11,0,y,body,PALETTE.muted,{wordWrap:true,wordWrapWidth:mw-32,lineHeight:15});
}
function collectionFooter(scene,body,mw,mh){
  const bottom=mh/2;
  storageCaption(scene,body,mw,bottom-120);
  const links=[['服務條款','/terms.html'],['隱私權政策','/privacy.html']].map(([name,path])=>{
    const link=new PixiButton({text:name,name:`${name}（另開分頁）`,variant:'link',width:112,height:44,fontSize:13,onPress:()=>window.open(path,'_blank','noopener,noreferrer')});
    link.buttonWidth=link.caption.width+16;link.hitArea=new Rectangle(-link.buttonWidth/2,-22,link.buttonWidth,44);link.boundsArea=link.hitArea;link.draw();
    link.caption.style.fill=0xf7d490;
    return link;
  });
  const gap=DIALOG_FOOTER.legalGap-16,total=links.reduce((sum,link)=>sum+link.buttonWidth,0)+gap;let x=-total/2;
  for(const link of links){place(link,x+link.buttonWidth/2,bottom-78,body);x+=link.buttonWidth+gap;}
  const inset=scene.layout.ui.width<=600?DIALOG_FOOTER.mobileInset:DIALOG_FOOTER.desktopInset,options={fontFamily:DIALOG_FOOTER.fontFamily,letterSpacing:DIALOG_FOOTER.letterSpacing};
  body.addChild(new Graphics().moveTo(-mw/2+inset,bottom-48).lineTo(mw/2-inset,bottom-48).stroke({color:0xe4b866,width:1,alpha:.15}));
  const brand=text(DIALOG_BRAND,DIALOG_FOOTER.fontSize,-mw/2+inset,bottom-25,body,DIALOG_FOOTER.color,options);brand.anchor.x=0;
  const version=text(`v${APP_VERSION}`,DIALOG_FOOTER.fontSize,mw/2-inset,bottom-25,body,DIALOG_FOOTER.color,options);version.anchor.x=1;
}

export function buildArchiveDialog(scene,type){
  const {width,height}=scene.layout.ui,scale=scene.layout.scale;
  scene.world.interactiveChildren=false;scene.world.accessibleChildren=false;
  const root=new Container({label:`modal:${type}`});root.scale.set(1/scale);scene.modalRoot=root;scene.root.addChild(root);
  const shade=new Graphics().rect(0,0,width,height).fill({color:0x080d1c,alpha:.88});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,width,height);shade.on('pointertap',()=>scene.closeModal());root.addChild(shade);
  const mw=Math.min(800,width-(type==='history'?(width<=700?16:32):24)),mh=Math.min(height-(type==='history'?(width<=700?16:32):24),type==='history'?760:680);
  const body=place(new Container({label:'archive-dialog'}),width/2,height/2,root);body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',e=>e.stopPropagation());
  body.addChild(type==='history'?new Graphics().roundRect(-mw/2,-mh/2,mw,mh,18).fill(0x211727).stroke({color:0xc79d60,width:1}):panel(mw,mh));
  const close=place(new PixiButton({name:'關閉視窗',icon:icon('close'),iconSize:21,variant:'close',width:44,height:44,onPress:()=>scene.closeModal()}),mw/2-(width<=700?16:24)-22,-mh/2+(type==='history'?(width<=700?32:36):34),body);
  if(type==='cg'){
    place(navigation('返回收藏','返回 CG 收藏',-1,()=>scene.openModal('collection')),-mw/2+62,-mh/2+34,body);
    text(`${characterRule(scene.selectedCharacter).name} · ${scene.characterCG[scene.cgIndex].name}`,width<450?16:20,0,-mh/2+78,body,PALETTE.gold);
    const image=new Sprite(scene.characterTextures[scene.cgIndex]);image.label='unlocked-cg-art';image.anchor.set(.5);
    const availableH=mh-218;image.height=Math.min(availableH,(mw-44)*image.texture.height/image.texture.width);image.scale.x=image.scale.y;image.y=-mh/2+105+availableH/2;body.addChild(image);
    const downloadStatus=text('',11,0,mh/2-55,body,PALETTE.muted);
    const download=place(new PixiButton({name:'下載高畫質去背 PNG',icon:downloadGlyph,iconSize:26,variant:'quiet',width:52,height:44,onPress:async()=>{
      download.setEnabled(false);downloadStatus.text='';
      try{const opened=await downloadCG(scene.archive,scene.selectedCharacter,scene.cgIndex,scene.activity);if(!body.destroyed)downloadStatus.text=opened?'':'已取消開啟，可再次點選下載';}
      catch{if(!body.destroyed)downloadStatus.text='暫時無法開啟下載，請稍後再試';}
      finally{if(!body.destroyed)download.setEnabled(true);}
    }}),0,mh/2-82,body);
    const unlocked=scene.characterCG.map((_,i)=>i).filter(i=>scene.archive.isUnlocked(scene.selectedCharacter,i)),at=unlocked.indexOf(scene.cgIndex);
    const prev=place(navigation('上一張','上一張已解鎖 CG',-1,()=>scene.openCG(unlocked[at-1])),-mw/2+64,mh/2-29,body);prev.setEnabled(at>0);
    const next=place(navigation('下一張','下一張已解鎖 CG',1,()=>scene.openCG(unlocked[at+1])),mw/2-64,mh/2-29,body);next.setEnabled(at<unlocked.length-1);
    text(`${at+1} / ${unlocked.length}`,12,0,mh/2-29,body,PALETTE.muted);
    // Keep the close control above the large image's bounds.
    body.setChildIndex(close,body.children.length-1);
  }else if(type==='collection'){
    const compact=height<500;
    const logo=place(new Sprite(scene.logoTexture),0,-mh/2+(compact?12:22),body);logo.label='collection-brand-logo';logo.anchor.set(.5,0);logo.width=Math.min(compact?150:250,mw-128);logo.scale.y=logo.scale.x;logo.eventMode='none';
    text('CG 收藏',compact?18:21,0,-mh/2+(compact?75:117),body,PALETTE.bright,{letterSpacing:2});
    const artCount=scene.characterCG.length,count=scene.characterCG.filter((_,i)=>scene.archive.isUnlocked(scene.selectedCharacter,i)).length;
    text(`${characterRule(scene.selectedCharacter).name} · 已解鎖 ${count} / ${artCount}`,12,0,-mh/2+(compact?99:145),body,PALETTE.muted);
    const vertical=width<600 && height>width,top=-mh/2+(compact?121:170),available=mh-(compact?260:309),gap=12;
    const twoColumns=vertical&&artCount>4,columns=vertical?(twoColumns?2:1):artCount,rows=Math.ceil(artCount/columns);
    const tileWidth=(mw-44-(columns-1)*gap)/columns;
    const tileHeight=vertical?(available-(rows-1)*gap)/rows:Math.min(330,available);
    scene.characterCG.forEach((art,index)=>{
      const unlocked=scene.archive.isUnlocked(scene.selectedCharacter,index);
      const cx=(index%columns-(columns-1)/2)*(tileWidth+gap);
      const cy=vertical?top+tileHeight/2+Math.floor(index/columns)*(tileHeight+gap):top+available/2;
      const tile=place(new PixiButton({name:unlocked?`回顧${art.name} CG`:`${art.name} CG 尚未解鎖`,variant:'gallery',width:tileWidth,height:tileHeight,onPress:()=>scene.openCG(index)}),cx,cy,body);
      const thumbX=-tileWidth/2+(twoColumns?25:47);
      if(unlocked){
        thumbnail(scene.characterTextures[index],tile,vertical?{x:thumbX,y:0,width:twoColumns?38:82,height:tileHeight-10}:{x:0,y:-27,width:tileWidth-12,height:tileHeight-64});
      }else{
        const glyph=slotIcon(lock,vertical?27:36,0x9b8796);place(glyph,vertical?thumbX-13:-18,vertical?-13:-40,tile);
      }
      const tx=vertical?(twoColumns?20:26):0;
      text(art.name,twoColumns?13:vertical?15:17,tx,vertical?-15:tileHeight/2-38,tile,unlocked?PALETTE.cream:PALETTE.muted,{fontWeight:'500'});
      const condition=index?`${twoColumns?'':'累積 '}${index} 勝解鎖`:twoColumns?'入場解鎖':'開始對局解鎖';
      text(unlocked?'已解鎖':condition,twoColumns?11:12,tx,vertical?14:tileHeight/2-15,tile,unlocked?PALETTE.gold:PALETTE.muted);
      if(!unlocked){tile.setEnabled(false);tile.alpha=1;}
    });
    collectionFooter(scene,body,mw,mh);
  }else{
    buildMatchHistory(scene,body,mw,mh);
  }
  scene.app.canvas.dataset.modal=type;
}
