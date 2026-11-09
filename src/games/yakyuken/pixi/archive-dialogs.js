import {Container,Graphics,Rectangle,Sprite} from 'pixi.js';
import {CHARACTERS,characterRule} from '../characters.js';
import {CG_ART} from '../cg-catalog.js';
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
function storageCaption(scene,body,mw,y){
  text(scene.archive.cloud?'收藏與紀錄儲存在測試雲端':scene.archive.persistent?'收藏與紀錄儲存在這台裝置':'目前無法儲存，資料只保留在此頁',11,0,y,body,PALETTE.muted,{wordWrap:true,wordWrapWidth:mw-32,lineHeight:15});
}
function collectionFooter(scene,body,mw,mh,compact){
  const bottom=mh/2;
  storageCaption(scene,body,mw,bottom-(compact?82:120));
  const links=[['服務條款','/terms.html'],['隱私權政策','/privacy.html']].map(([name,path])=>{
    const link=new PixiButton({text:name,name:`${name}（另開分頁）`,variant:'link',width:112,height:44,fontSize:13,onPress:()=>window.open(path,'_blank','noopener,noreferrer')});
    link.buttonWidth=link.caption.width+16;link.hitArea=new Rectangle(-link.buttonWidth/2,-22,link.buttonWidth,44);link.boundsArea=link.hitArea;link.draw();
    link.caption.style.fill=0xf7d490;
    return link;
  });
  const gap=DIALOG_FOOTER.legalGap-16,total=links.reduce((sum,link)=>sum+link.buttonWidth,0)+gap;let x=-total/2;
  for(const link of links){place(link,x+link.buttonWidth/2,bottom-(compact?53:78),body);x+=link.buttonWidth+gap;}
  const inset=scene.layout.ui.width<=600?DIALOG_FOOTER.mobileInset:DIALOG_FOOTER.desktopInset,options={fontFamily:DIALOG_FOOTER.fontFamily,letterSpacing:DIALOG_FOOTER.letterSpacing};
  const ruleY=bottom-(compact?30:48),brandY=bottom-(compact?15:25);
  body.addChild(new Graphics().moveTo(-mw/2+inset,ruleY).lineTo(mw/2-inset,ruleY).stroke({color:0xe4b866,width:1,alpha:.15}));
  const brand=text(DIALOG_BRAND,DIALOG_FOOTER.fontSize,-mw/2+inset,brandY,body,DIALOG_FOOTER.color,options);brand.anchor.x=0;
  const version=text(`v${APP_VERSION}`,DIALOG_FOOTER.fontSize,mw/2-inset,brandY,body,DIALOG_FOOTER.color,options);version.anchor.x=1;
}

function buildCollection(scene,body,mw,mh,width,height){
  const compact=height<500,compactFooter=mh<590,top=-mh/2,inset=mw<450?14:22,gap=8;
  const character=scene.galleryCharacter??=scene.selectedCharacter;
  const characters=CHARACTERS.filter(c=>c.enabled&&CG_ART[c.id]);
  const unlocked=c=>CG_ART[c].map(({index})=>scene.archive.isUnlocked(c,index));
  const owned=unlocked(character),art=CG_ART[character];
  const logo=place(new Sprite(scene.logoTexture),-mw/2+inset,top+34,body);
  logo.label='collection-brand-logo';logo.anchor.set(0,.5);logo.width=Math.min(104,mw*.28);logo.scale.y=logo.scale.x;logo.eventMode='none';
  text('CG 收藏',mw<450?19:22,0,top+34,body,PALETTE.bright,{fontWeight:'600',letterSpacing:2});
  const contentWidth=mw-2*inset,tabWidth=(contentWidth-gap*(characters.length-1))/characters.length;
  characters.forEach(({id,name},i)=>{
    const states=id===character?owned:unlocked(id),count=states.filter(Boolean).length;
    const tab=new PixiButton({name:`${name}收藏，已解鎖 ${count} / ${states.length}${id===character?'，目前顯示':''}`,variant:'tool',width:tabWidth,height:44,onPress:()=>scene.selectGalleryCharacter(id,tab.focused)});
    tab.label=`gallery-tab:${id}`;tab.setActive(id===character);
    place(tab,-contentWidth/2+tabWidth/2+i*(tabWidth+gap),top+(compact?76:82),body);
    text(name,14,0,-7,tab,id===character?PALETTE.bright:PALETTE.cream,{fontWeight:'600'});
    text(`${count} / ${states.length}`,12,0,11,tab,id===character?PALETTE.gold:PALETTE.muted);
  });
  if(!compact)text('選擇角色查看收藏 · 勝場可解鎖新造型',12,0,top+124,body,PALETTE.muted);
  const start=top+(compact?104:144),end=mh/2-(compactFooter?92:133);
  const narrow=width<600&&height>width;
  const columns=compact?(mw>=640?art.length:Math.min(3,art.length)):narrow?2:3;
  const rows=Math.ceil(art.length/columns),gridWidth=Math.min(contentWidth,columns*210+(columns-1)*gap);
  const w=(gridWidth-(columns-1)*gap)/columns,h=Math.min(compact?158:190,(end-start-(rows-1)*gap)/rows);
  art.forEach(({name,index},i)=>{
    const available=owned[index], cx=-gridWidth/2+w/2+(i%columns)*(w+gap),cy=start+h/2+Math.floor(i/columns)*(h+gap);
    const tile=place(new PixiButton({name:available?`回顧${name} CG`:`${name} CG 尚未解鎖`,variant:'gallery',width:w,height:h,onPress:()=>{
      const restoreFocus=tile.focused;
      if(scene.openCG(index,character)&&restoreFocus)scene.focusArchiveControl('gallery-back');
    }}),cx,cy,body);
    tile.label=`gallery-tile:${index}`;
    tile.addChildAt(new Graphics().roundRect(-w/2,-h/2,w,h,9).fill({color:available?0x251727:0x241b2c,alpha:.82}).stroke({color:PALETTE.edge,alpha:available?.43:.16,width:1}),0);
    const short=h<80,captionHeight=short?40:46,artHeight=h-captionHeight,artY=-captionHeight/2;
    if(artHeight>=22){
      if(available){
        const image=new Sprite(scene.artTextures[character][index]);image.label='cg-thumbnail';image.anchor.set(.5);
        image.height=Math.min(artHeight-6,(w-22)*image.texture.height/image.texture.width);image.scale.x=image.scale.y;
        place(image,0,artY,tile);
      }else{
        const size=Math.min(25,artHeight-6);
        const glyph=slotIcon(lock,size,0xc4adb8);place(glyph,-size/2,artY-size/2,tile);
      }
    }
    const nameY=h/2-captionHeight+(short?11:13),infoY=h/2-(short?10:12);
    text(name,short?12:14,0,nameY,tile,available?PALETTE.cream:0xdeced9,{fontWeight:'600'});
    const condition=index?`${index} 勝解鎖`:'入場解鎖';
    text(available?(index?`第 ${index} 勝 · 查看`:'初始 · 查看'):condition,11,0,infoY,tile,available?PALETTE.gold:PALETTE.muted);
    if(!available){tile.setEnabled(false);tile.alpha=1;}
    else tile.setChildIndex(tile.outline,tile.children.length-1);
  });
  collectionFooter(scene,body,mw,mh,compactFooter);
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
    const character=scene.galleryCharacter,index=scene.cgIndex;
    const back=place(navigation('返回收藏','返回 CG 收藏',-1,()=>{
      const restoreFocus=back.focused;scene.openModal('collection');
      if(restoreFocus)scene.focusArchiveControl(`gallery-tile:${index}`);
    }),-mw/2+62,-mh/2+34,body);back.label='gallery-back';
    text(`${characterRule(character).name} · ${CG_ART[character][index].name}`,width<450?16:20,0,-mh/2+78,body,PALETTE.gold);
    const image=new Sprite(scene.artTextures[character][index]);image.label='unlocked-cg-art';image.anchor.set(.5);
    const availableH=mh-218;image.height=Math.min(availableH,(mw-44)*image.texture.height/image.texture.width);image.scale.x=image.scale.y;image.y=-mh/2+105+availableH/2;body.addChild(image);
    const downloadStatus=text('',11,0,mh/2-55,body,PALETTE.muted);
    const download=place(new PixiButton({name:'下載高畫質去背 PNG',icon:downloadGlyph,iconSize:26,variant:'quiet',width:52,height:44,onPress:async()=>{
      download.setEnabled(false);downloadStatus.text='';
      try{const opened=await downloadCG(scene.archive,character,index,scene.activity);if(!body.destroyed)downloadStatus.text=opened?'':'已取消開啟，可再次點選下載';}
      catch{if(!body.destroyed)downloadStatus.text='暫時無法開啟下載，請稍後再試';}
      finally{if(!body.destroyed)download.setEnabled(true);}
    }}),0,mh/2-82,body);
    const unlocked=CG_ART[character].map((_,i)=>i).filter(i=>scene.archive.isUnlocked(character,i)),at=unlocked.indexOf(index);
    const prev=place(navigation('上一張','上一張已解鎖 CG',-1,()=>scene.stepCG(-1,prev.focused)),-mw/2+64,mh/2-29,body);prev.label='gallery-step:-1';prev.setEnabled(at>0);
    const next=place(navigation('下一張','下一張已解鎖 CG',1,()=>scene.stepCG(1,next.focused)),mw/2-64,mh/2-29,body);next.label='gallery-step:1';next.setEnabled(at<unlocked.length-1);
    text(`${at+1} / ${unlocked.length}`,12,0,mh/2-29,body,PALETTE.muted);
    // Keep the close control above the large image's bounds.
    body.setChildIndex(close,body.children.length-1);
  }else if(type==='collection'){
    buildCollection(scene,body,mw,mh,width,height);
  }else{
    buildMatchHistory(scene,body,mw,mh);
  }
  scene.app.canvas.dataset.modal=type;
}
