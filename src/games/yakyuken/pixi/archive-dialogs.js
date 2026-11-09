import {Container,FillGradient,Graphics,Rectangle,Sprite} from 'pixi.js';
import {CHARACTERS,characterRule} from '../characters.js';
import {CG_ART} from '../cg-catalog.js';
import {icon} from '../../../ui/shared/icons.js';
import {APP_VERSION} from '../../../version.js';
import {DIALOG_BRAND,DIALOG_FOOTER,PROGRAMME,programmeScrollbarWidth} from '../../../ui/shared/dialog-spec.js';
import {downloadCG} from '../cg-download.js';
import {buildMatchHistory} from './match-history.js';
import {cgGridLayout,cgGridPage,cgViewerLayout} from './cg-layout.js';
import {label,PALETTE,PixiButton,slotIcon} from './ui.js';

const lock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/></svg>';
const downloadGlyph='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v10.75m-3.75-3.5L12 14.5l3.75-3.75"/><path d="M4.5 15.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3.5"/></svg>';
const place=(node,x,y,parent)=>{node.position.set(x,y);parent.addChild(node);return node;};
const text=(value,size,x,y,parent,color=PALETTE.cream,options={})=>place(label(value,size,color,options),x,y,parent);
function navigation(text,name,direction,onPress){
  const button=new PixiButton({text,name,variant:'quiet',width:96,height:44,fontSize:13,onPress});
  const arrow=slotIcon(icon('arrow'),16,PALETTE.muted);arrow.pivot.set(12,12);arrow.position.set(direction<0?-32:32,0);if(direction<0)arrow.rotation=Math.PI;
  button.caption.x=direction<0?8:-8;button.addChild(arrow);return button;
}
function storageCaption(scene,body,mw,y){
  text(scene.archive.cloud?'收藏與紀錄儲存在測試雲端':scene.archive.persistent?'收藏與紀錄儲存在這台裝置':'目前無法儲存，資料只保留在此頁',11,0,y,body,PALETTE.muted,{wordWrap:true,wordWrapWidth:mw-32,lineHeight:15});
}
function collectionFooter(scene,body,mw,mh,inline,mini,mastheadY,mobile,scrollbar){
  const bottom=mh/2;
  if(!inline&&!mini)storageCaption(scene,body,mw,bottom-82);
  const links=[['服務條款','/terms.html'],['隱私權政策','/privacy.html']].map(([name,path])=>{
    const link=new PixiButton({text:name,name:`${name}（另開分頁）`,variant:'link',width:112,height:44,fontSize:13,onPress:()=>window.open(path,'_blank','noopener,noreferrer')});
    link.buttonWidth=link.caption.width+16;link.hitArea=new Rectangle(-link.buttonWidth/2,-22,link.buttonWidth,44);link.boundsArea=link.hitArea;link.draw();
    link.caption.style.fill=0xf7d490;
    return link;
  });
  const gap=DIALOG_FOOTER.legalGap-16,total=links.reduce((sum,link)=>sum+link.buttonWidth,0)+gap;let x=mini?mw/2-14-scrollbar-total:-(total+scrollbar)/2;
  for(const link of links){place(link,x+link.buttonWidth/2,mini?mastheadY:bottom-(inline?23:53),body);x+=link.buttonWidth+gap;}
  if(mini)return;
  const inset=PROGRAMME.border+(mobile?DIALOG_FOOTER.mobileInset:DIALOG_FOOTER.desktopInset),options={fontFamily:DIALOG_FOOTER.fontFamily,letterSpacing:DIALOG_FOOTER.letterSpacing};
  const ruleY=bottom-(inline?48:30),brandY=bottom-(inline?23:15);
  body.addChild(new Graphics().moveTo(-mw/2+inset,ruleY).lineTo(mw/2-inset-scrollbar,ruleY).stroke({color:0xe4b866,width:1,alpha:.15}));
  const brand=text(DIALOG_BRAND,DIALOG_FOOTER.fontSize,-mw/2+inset,brandY,body,DIALOG_FOOTER.color,options);brand.anchor.x=0;
  const version=text(`v${APP_VERSION}`,DIALOG_FOOTER.fontSize,mw/2-inset-scrollbar,brandY,body,DIALOG_FOOTER.color,options);version.anchor.x=1;
}

function buildProgrammeFrame(body,frame){
  const {width,height,radius,header,inset,title}=frame,left=-width/2,top=-height/2,b=PROGRAMME.border;
  const ground=new FillGradient({type:'radial',center:{x:.5,y:0},innerRadius:0,outerRadius:.7,colorStops:[{offset:0,color:0x3d2539},{offset:1,color:PROGRAMME.surface}]});
  const band=new FillGradient({start:{x:0,y:0},end:{x:1,y:.36},colorStops:[{offset:0,color:PROGRAMME.headStart},{offset:.7,color:PROGRAMME.headEnd},{offset:1,color:PROGRAMME.headEnd}]});
  body.once('destroyed',()=>{ground.destroy();band.destroy();});
  body.addChild(new Graphics().roundRect(left,top,width,height,radius).fill(ground));
  const clip=new Graphics().roundRect(left+b,top+b,width-2*b,height-2*b,radius-b).fill(0xffffff);
  const bar=new Graphics({label:'programme-header'}).rect(left+b,top+b,width-2*b,header).fill(band);
  bar.moveTo(left+b,top+b+header-.5).lineTo(width/2-b,top+b+header-.5).stroke({color:PROGRAMME.line,width:1,alpha:.22});
  bar.mask=clip;body.addChild(bar,clip);
  body.addChild(new Graphics().roundRect(left+b/2,top+b/2,width-b,height-b,radius-b/2).stroke({color:PROGRAMME.edge,width:b}));
  const heading=text('CG 收藏',title,left+b+inset,top+b+(header-1)/2,body,PROGRAMME.gold,{fontWeight:'600',letterSpacing:3});
  heading.anchor.x=0;heading.label='programme-title';
}

function buildCollection(scene,body,{frame,panelWidth:mw,panelHeight:mh,mini,inlineFooter,scrollbar,gap,contentWidth,columns,cardWidth:w,cardHeight:h,gridTop,pagerY,capacity,pages,page,first,
  mastheadTop,mastheadHeight,mastheadPad,logoWidth,logoHeight,stackedLogo,tabsTop}){
  const top=-mh/2,contentX=-scrollbar/2;
  const character=scene.galleryCharacter??=scene.selectedCharacter;
  const characters=CHARACTERS.filter(c=>c.enabled&&CG_ART[c.id]);
  const unlocked=c=>CG_ART[c].map(({index})=>scene.archive.isUnlocked(c,index));
  const owned=unlocked(character),art=CG_ART[character];
  const mastheadInset=PROGRAMME.border+(frame.mobile?PROGRAMME.smallMastheadInset:PROGRAMME.mastheadInset),mastheadY=top+mastheadTop+mastheadHeight/2;
  const logo=place(new Sprite(scene.logoTexture),stackedLogo?contentX:-mw/2+mastheadInset,top+mastheadTop+mastheadPad,body);
  logo.label='collection-brand-logo';logo.anchor.set(stackedLogo?.5:0,0);logo.width=logoWidth;logo.scale.y=logo.scale.x;logo.eventMode='none';
  if(!mini){
    const total=Object.values(CG_ART).reduce((sum,items)=>sum+items.length,0);
    const caption=text(`${total} 張造型  ◆  點圖放大`,frame.mobile?12:13,stackedLogo?contentX:mw/2-mastheadInset-scrollbar,
      stackedLogo?top+mastheadTop+mastheadPad+logoHeight+21:mastheadY,body,PROGRAMME.gold,{letterSpacing:1});
    if(!stackedLogo)caption.anchor.x=1;
  }
  const tabTop=top+tabsTop,tabPad=mini?4:PROGRAMME.tabPad,tabHeight=PROGRAMME.tab+2*(tabPad+1),left=-mw/2+PROGRAMME.border,right=-left-scrollbar;
  body.addChild(new Graphics({label:'programme-tabs'}).rect(left,tabTop,right-left,tabHeight).fill(0x24182c)
    .moveTo(left,tabTop+.5).lineTo(right,tabTop+.5).moveTo(left,tabTop+tabHeight-.5).lineTo(right,tabTop+tabHeight-.5).stroke({color:PROGRAMME.line,alpha:.2,width:1}));
  const tabWidth=(contentWidth-gap*(characters.length-1))/characters.length;
  characters.forEach(({id,name},i)=>{
    const states=id===character?owned:unlocked(id),count=states.filter(Boolean).length;
    const active=id===character;
    const tab=new PixiButton({name:`${name}收藏，已解鎖 ${count} / ${states.length}${active?'，目前顯示':''}`,variant:'quiet',width:tabWidth,height:PROGRAMME.tab,onPress:()=>scene.selectGalleryCharacter(id,tab.focused)});
    tab.label=`gallery-tab:${id}`;
    const style=new Graphics().roundRect(-tabWidth/2,-PROGRAMME.tab/2,tabWidth,PROGRAMME.tab,8).fill(active?0x65343a:0x201525).stroke({color:PROGRAMME.edge,width:1,alpha:active?1:.3});
    if(active)style.roundRect(-12,PROGRAMME.tab/2-1.5,24,3,1.5).fill(PROGRAMME.gold);
    tab.addChildAt(style,0);
    place(tab,contentX-contentWidth/2+tabWidth/2+i*(tabWidth+gap),tabTop+tabPad+1+PROGRAMME.tab/2,body);
    text(name,14,0,-7,tab,id===character?PALETTE.bright:PALETTE.cream,{fontWeight:'600'});
    text(`${count} / ${states.length}`,12,0,11,tab,id===character?PALETTE.gold:PALETTE.muted);
  });
  const items=art.slice(first,first+capacity),start=top+gridTop;
  const surfaces=new Map();
  body.once('destroyed',()=>surfaces.forEach(surface=>surface.destroy()));
  items.forEach(({name,index},i)=>{
    const row=Math.floor(i/columns),inRow=Math.min(columns,items.length-row*columns);
    const available=owned[index],cx=contentX+(i%columns-(inRow-1)/2)*(w+gap),cy=start+h/2+row*(h+gap);
    const tile=place(new PixiButton({name:available?`回顧${name} CG`:`${name} CG 尚未解鎖`,variant:'gallery',width:w,height:h,onPress:()=>{
      const restoreFocus=tile.focused;
      if(scene.openCG(index,character)&&restoreFocus)scene.focusArchiveControl('gallery-back');
    }}),cx,cy,body);
    tile.label=`gallery-tile:${index}`;
    if(!surfaces.has(available))surfaces.set(available,new FillGradient({start:{x:.5,y:0},end:{x:.5,y:1},colorStops:available?[{offset:0,color:0x412b38},{offset:1,color:0x231827}]:[{offset:0,color:0x2b2232},{offset:1,color:0x231b2b}]}));
    tile.addChildAt(new Graphics().roundRect(-w/2,-h/2,w,h,10).fill(surfaces.get(available)).stroke({color:PALETTE.edge,alpha:available?.5:.21,width:1}),0);
    const short=h<96,captionHeight=short?37:44,artHeight=h-captionHeight,artY=-captionHeight/2;
    if(artHeight>=22){
      if(available){
        const image=new Sprite(scene.artTextures[character][index]);image.label='cg-thumbnail';image.anchor.set(.5);
        image.height=Math.min(artHeight-8,(w-16)*image.texture.height/image.texture.width);image.scale.x=image.scale.y;
        place(image,0,artY,tile);
      }else{
        const size=Math.min(28,artHeight-6);
        const glyph=slotIcon(lock,size,0xc4adb8);place(glyph,-size/2,artY-size/2,tile);
      }
    }
    tile.addChild(new Graphics().moveTo(-w/2+8,h/2-captionHeight).lineTo(w/2-8,h/2-captionHeight).stroke({color:PALETTE.edge,alpha:.14,width:1}));
    const nameY=h/2-captionHeight+(short?10:12),infoY=h/2-(short?9:11);
    text(name,short?12:14,0,nameY,tile,available?PALETTE.cream:0xdeced9,{fontWeight:'600'});
    const condition=index?`${index} 勝解鎖`:'入場解鎖';
    text(available?(index?`第 ${index} 勝`:'初始造型'):condition,11,0,infoY,tile,available?PALETTE.gold:PALETTE.muted);
    if(!available){tile.setEnabled(false);tile.alpha=1;}
    else tile.setChildIndex(tile.outline,tile.children.length-1);
  });
  const y=top+pagerY;
  text(pages>1?`${page+1} / ${pages} 頁`:`共 ${art.length} 張`,12,0,y,body,PALETTE.muted);
  if(pages>1){
    const pageButton=(direction,caption)=>{
      const next=page+direction,button=navigation(caption,`CG 收藏${caption}`,direction,()=>{
        const following=next+direction;
        scene.showGalleryPage(next*capacity,button.focused?(following>=0&&following<pages?`gallery-page:${direction}`:`gallery-page:${-direction}`):null);
      });
      button.label=`gallery-page:${direction}`;button.setEnabled(next>=0&&next<pages);
      place(button,direction*Math.min(109,contentWidth/2-48),y,body);
    };
    pageButton(-1,'上一頁');pageButton(1,'下一頁');
  }
  collectionFooter(scene,body,mw,mh,inlineFooter,mini,mastheadY,frame.mobile,scrollbar);
}

function buildViewer(scene,body,width,height,layout){
  const {wide,gutter,barHeight,controlY,downloadWidth,closeX,downloadLeft,art}=layout,left=-width/2,top=-height/2;
  const character=scene.galleryCharacter,index=scene.cgIndex;
  const unlocked=CG_ART[character].map(({index:i})=>i).filter(i=>scene.archive.isUnlocked(character,i)),at=unlocked.indexOf(index);
  const image=new Sprite(scene.artTextures[character][index]);image.label='unlocked-cg-art';image.anchor.set(.5);
  image.scale.set(Math.min(art.width/image.texture.width,art.height/image.texture.height));
  place(image,left+art.x+art.width/2,top+art.y+art.height/2,body);

  const bar=new Graphics().rect(left,top,width,barHeight).fill(0x211725)
    .moveTo(left,top+barHeight).lineTo(width/2,top+barHeight).stroke({color:PALETTE.edge,width:1,alpha:.35});
  if(!wide)bar.rect(left,height/2-56,width,56).fill(0x211725)
    .moveTo(left,height/2-56).lineTo(width/2,height/2-56).stroke({color:PALETTE.edge,width:1,alpha:.35});
  body.addChild(bar);
  const y=top+controlY,back=place(navigation('返回收藏','返回 CG 收藏',-1,()=>{
    scene.showGalleryPage(index,back.focused?`gallery-tile:${index}`:null);
  }),left+gutter+48,y,body);back.label='gallery-back';
  const status=text('',12,0,top+barHeight+14,body,PALETTE.bright);
  const download=place(new PixiButton({text:'下載原圖',name:'下載高畫質去背 PNG',icon:downloadGlyph,iconSize:18,variant:'tool',width:downloadWidth,height:44,onPress:async()=>{
    download.setEnabled(false);status.text='';
    try{const opened=await downloadCG(scene.archive,character,index,scene.activity);if(!body.destroyed)status.text=opened?'':'已取消，可再次點選下載';}
    catch{if(!body.destroyed)status.text='暫時無法開啟下載，請稍後再試';}
    finally{if(!body.destroyed)download.setEnabled(true);}
  }}),left+downloadLeft+downloadWidth/2,y,body);
  download.setActive(true);
  const iconGap=9;
  download.caption.x=(download.iconSize+iconGap)/2;
  download.glyph.position.set(-(download.caption.width+download.iconSize+iconGap)/2,-download.iconSize/2);
  place(new PixiButton({name:'關閉視窗',icon:icon('close'),iconSize:21,variant:'close',width:44,height:44,onPress:()=>scene.closeModal()}),left+closeX,y,body);

  const titleY=wide?y:height/2-28;
  const title=text(`${characterRule(character).name} · ${CG_ART[character][index].name}`,width<450?14:17,0,titleY-8,body,PALETTE.bright,{fontWeight:'600'});
  title.label='cg-viewer-title';
  if(wide){
    const low=left+gutter+104,high=left+downloadLeft-8;
    if(title.width>high-low)title.scale.set((high-low)/title.width);
    title.x=Math.max(low+title.width/2,Math.min(0,high-title.width/2));
  }
  text(`${at+1} / ${unlocked.length}`,12,title.x,titleY+12,body,PALETTE.muted);
  for(const direction of [-1,1]){
    const button=new PixiButton({name:direction<0?'上一張已解鎖 CG':'下一張已解鎖 CG',icon:icon('arrow'),iconSize:22,variant:'close',width:44,height:44,onPress:()=>scene.stepCG(direction,button.focused)});
    if(direction<0){button.glyph.position.set(11,11);button.glyph.rotation=Math.PI;}
    button.label=`gallery-step:${direction}`;button.setEnabled(at+direction>=0&&at+direction<unlocked.length);
    place(button,direction*(width/2-gutter-22),wide?top+art.y+art.height/2:titleY,body);
  }
}

export function buildArchiveDialog(scene,type){
  const {width,height}=scene.layout.ui,scale=scene.layout.scale;
  scene.world.interactiveChildren=false;scene.world.accessibleChildren=false;
  const root=new Container({label:`modal:${type}`});root.scale.set(1/scale);scene.modalRoot=root;scene.root.addChild(root);
  const collection=type==='collection';
  const shade=new Graphics().rect(0,0,width,height).fill(collection?{color:PROGRAMME.backdrop,alpha:.85}:{color:0x080d1c,alpha:.88});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,width,height);shade.on('pointertap',()=>scene.closeModal());root.addChild(shade);
  const baseGrid=collection?cgGridLayout(width,height,window.innerWidth,window.innerHeight,programmeScrollbarWidth(document)):null;
  const grid=baseGrid?cgGridPage(baseGrid,CG_ART[scene.galleryCharacter??scene.selectedCharacter].length,scene.galleryAnchor):null;
  const mw=type==='cg'?width:grid?.panelWidth??Math.min(800,width-(width<=700?16:32));
  const mh=type==='cg'?height:grid?.panelHeight??Math.min(760,height-(width<=700?16:32));
  const body=place(new Container({label:'archive-dialog'}),width/2,height/2,root);body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',e=>e.stopPropagation());
  if(type==='cg'){
    body.addChild(new Graphics().rect(-mw/2,-mh/2,mw,mh).fill(0x100e17));
    buildViewer(scene,body,width,height,cgViewerLayout(width,height));
    scene.app.canvas.dataset.modal=type;return;
  }
  if(collection)buildProgrammeFrame(body,grid.frame);
  else body.addChild(new Graphics().roundRect(-mw/2,-mh/2,mw,mh,18).fill(0x211727).stroke({color:0xc79d60,width:1}));
  const close=place(new PixiButton({name:'關閉視窗',icon:icon('close'),iconSize:PROGRAMME.icon,variant:'close',width:PROGRAMME.close,height:PROGRAMME.close,closeTheme:collection?PROGRAMME:null,onPress:()=>scene.closeModal()}),
    mw/2-(collection?grid.frame.inset+PROGRAMME.border:width<=700?16:24)-PROGRAMME.close/2,-mh/2+(collection?PROGRAMME.border+(grid.frame.header-1)/2:width<=700?32:36),body);
  if(collection){
    buildCollection(scene,body,grid);body.setChildIndex(close,body.children.length-1);
  }else{
    buildMatchHistory(scene,body,mw,mh);
  }
  scene.app.canvas.dataset.modal=type;
}
