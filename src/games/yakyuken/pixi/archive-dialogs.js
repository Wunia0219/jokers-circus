import {Container,Graphics,Rectangle,Sprite} from 'pixi.js';
import {DEALER_ART} from '../assets.js';
import {characterRule} from '../characters.js';
import {icon} from '../../../ui/shared/icons.js';
import {label,panel,PALETTE,PixiButton,slotIcon} from './ui.js';

const lock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/></svg>';
const place=(node,x,y,parent)=>{node.position.set(x,y);parent.addChild(node);return node;};
const text=(value,size,x,y,parent,color=PALETTE.cream,options={})=>place(label(value,size,color,options),x,y,parent);
function leftText(value,size,x,y,parent,color=PALETTE.cream){const node=text(value,size,x,y,parent,color);node.anchor.x=0;return node;}
function thumbnail(texture,parent,{x,y,width,height}){
  const image=new Sprite(texture);image.anchor.set(.5,0);image.height=height/.44;image.scale.x=image.scale.y;image.position.set(x,y-height/2);
  const mask=new Graphics().roundRect(x-width/2,y-height/2,width,height,6).fill(0xffffff);
  parent.addChild(image,mask);image.mask=mask;
}
function storageCaption(scene,body,mw,y){
  text(scene.archive.persistent?'收藏與紀錄儲存在這台裝置':'目前無法儲存，資料只保留在此頁',11,0,y,body,PALETTE.muted,{wordWrap:true,wordWrapWidth:mw-32,lineHeight:15});
}

export function buildArchiveDialog(scene,type){
  const {width,height}=scene.layout.ui,scale=scene.layout.scale;
  scene.world.interactiveChildren=false;scene.world.accessibleChildren=false;
  const root=new Container({label:`modal:${type}`});root.scale.set(1/scale);scene.modalRoot=root;scene.root.addChild(root);
  const shade=new Graphics().rect(0,0,width,height).fill({color:0x080d1c,alpha:type==='cg'?.96:.88});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,width,height);shade.on('pointertap',()=>scene.closeModal());root.addChild(shade);
  const mw=Math.min(type==='cg'?1000:type==='collection'?800:660,width-24),mh=type==='cg'?height-24:Math.min(height-24,type==='collection'?580:600);
  const body=place(new Container({label:'archive-dialog'}),width/2,height/2,root);body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',e=>e.stopPropagation());body.addChild(panel(mw,mh));
  const close=place(new PixiButton({name:'關閉視窗',icon:icon('close'),variant:'utility',width:44,height:44,onPress:()=>scene.closeModal()}),mw/2-30,-mh/2+30,body);
  if(type!=='cg')place(new PixiButton({name:'遊戲選單',icon:icon('menu'),variant:'utility',width:44,height:44,onPress:()=>scene.openModal('menu')}),mw/2-86,-mh/2+30,body);
  if(type==='cg'){
    place(new PixiButton({text:'返回收藏',name:'返回 CG 收藏',width:96,height:44,fontSize:13,onPress:()=>scene.openModal('collection')}),-mw/2+62,-mh/2+30,body);
    text(`${characterRule(scene.selectedCharacter).name} · ${DEALER_ART[scene.cgIndex].name}`,width<450?16:20,0,-mh/2+78,body,PALETTE.gold);
    const image=new Sprite(scene.dealerTextures[scene.cgIndex]);image.label='unlocked-cg-art';image.anchor.set(.5);
    const availableH=mh-156;image.height=Math.min(availableH,(mw-44)*image.texture.height/image.texture.width);image.scale.x=image.scale.y;image.y=-mh/2+105+availableH/2;body.addChild(image);
    const unlocked=DEALER_ART.map((_,i)=>i).filter(i=>scene.archive.isUnlocked(scene.selectedCharacter,i)),at=unlocked.indexOf(scene.cgIndex);
    const prev=place(new PixiButton({text:'上一張',name:'上一張已解鎖 CG',width:84,height:44,fontSize:13,onPress:()=>scene.openCG(unlocked[at-1])}),-mw/2+64,mh/2-29,body);prev.setEnabled(at>0);
    const next=place(new PixiButton({text:'下一張',name:'下一張已解鎖 CG',width:84,height:44,fontSize:13,onPress:()=>scene.openCG(unlocked[at+1])}),mw/2-64,mh/2-29,body);next.setEnabled(at<unlocked.length-1);
    text(`${at+1} / ${unlocked.length}`,12,0,mh/2-29,body,PALETTE.muted);
    // Keep the close control above the large image's bounds.
    body.setChildIndex(close,body.children.length-1);
  }else if(type==='collection'){
    leftText('CG 收藏',19,-mw/2+22,-mh/2+30,body,PALETTE.gold);
    const count=DEALER_ART.filter((_,i)=>scene.archive.isUnlocked(scene.selectedCharacter,i)).length;
    text(`${characterRule(scene.selectedCharacter).name} · 已解鎖 ${count} / ${DEALER_ART.length}`,13,0,-mh/2+68,body,PALETTE.muted);
    const vertical=width<600 && height>width,top=-mh/2+98,available=mh-152,gap=12;
    const tileWidth=vertical?mw-44:(mw-44-2*gap)/3,tileHeight=vertical?(available-2*gap)/3:Math.min(330,available);
    DEALER_ART.forEach((art,index)=>{
      const unlocked=scene.archive.isUnlocked(scene.selectedCharacter,index),cx=vertical?0:(index-1)*(tileWidth+gap),cy=vertical?top+tileHeight/2+index*(tileHeight+gap):top+available/2;
      const tile=place(new PixiButton({name:unlocked?`回顧${art.name} CG`:`${art.name} CG 尚未解鎖`,width:tileWidth,height:tileHeight,onPress:()=>scene.openCG(index)}),cx,cy,body);
      tile.background.clear().roundRect(-tileWidth/2,-tileHeight/2,tileWidth,tileHeight,9).fill(0x151728).stroke({color:unlocked?PALETTE.gold:0x66545f,width:1,alpha:unlocked?.8:.5});
      if(unlocked){
        thumbnail(scene.dealerTextures[index],tile,vertical?{x:-tileWidth/2+47,y:0,width:82,height:tileHeight-10}:{x:0,y:-27,width:tileWidth-12,height:tileHeight-64});
      }else{
        const glyph=slotIcon(lock,vertical?27:36,0x9b8796);place(glyph,vertical?-tileWidth/2+34:-18,vertical?-13:-40,tile);
      }
      const tx=vertical?26:0;
      text(art.name,vertical?15:17,tx,vertical?-15:tileHeight/2-38,tile,unlocked?PALETTE.cream:PALETTE.muted,{fontWeight:'500'});
      const condition=index?`累積 ${index} 勝解鎖`:'開始對局解鎖';
      text(unlocked?'已解鎖 · 點擊回顧':condition,vertical?12:12,tx,vertical?14:tileHeight/2-15,tile,unlocked?PALETTE.gold:PALETTE.muted);
      if(!unlocked){tile.setEnabled(false);tile.alpha=1;}
    });
    storageCaption(scene,body,mw,mh/2-22);
  }else{
    leftText('遊玩紀錄',19,-mw/2+22,-mh/2+30,body,PALETTE.gold);
    const records=scene.archive.records(),pageSize=Math.max(1,Math.floor((mh-164)/68)),pages=Math.max(1,Math.ceil(records.length/pageSize));
    scene.historyPage=Math.max(0,Math.min(scene.historyPage,pages-1));
    text(`每場一筆 · 共 ${records.length} 場`,13,0,-mh/2+68,body,PALETTE.muted);
    if(!records.length){
      place(slotIcon(icon('clock'),32,PALETTE.gold),-16,-36,body);
      text('還沒有遊玩紀錄',17,0,20,body);
      text('開始一場對局後，就會出現在這裡。',12,0,53,body,PALETTE.muted,{wordWrap:true,wordWrapWidth:mw-40});
    }
    records.slice(scene.historyPage*pageSize,(scene.historyPage+1)*pageSize).forEach((record,index)=>{
      const y=-mh/2+112+index*68;
      body.addChild(new Graphics().roundRect(-mw/2+22,y-28,mw-44,58,7).fill({color:0x101421,alpha:.8}).stroke({color:PALETTE.gold,width:.7,alpha:.18}));
      leftText(characterRule(record.characterId).name,15,-mw/2+34,y-9,body);
      const status={won:'通關',lost:'敗場結束',left:'已離場',playing:record.id===scene.matchId?'本場':'未完成'}[record.status];
      const date=new Date(record.startedAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Taipei'});
      leftText(`${date} · ${status}`,11,-mw/2+34,y+14,body,PALETTE.muted);
      text(`${record.wins} 勝 / ${record.losses} 敗`,width<450?17:20,mw/2-88,y,body,PALETTE.bright,{fontWeight:'500'});
    });
    const previous=place(new PixiButton({text:'上一頁',name:'上一頁遊玩紀錄',width:84,height:44,fontSize:13,onPress:()=>{scene.historyPage--;scene.openModal('history');}}),-mw/2+64,mh/2-49,body);previous.setEnabled(scene.historyPage>0);
    const next=place(new PixiButton({text:'下一頁',name:'下一頁遊玩紀錄',width:84,height:44,fontSize:13,onPress:()=>{scene.historyPage++;scene.openModal('history');}}),mw/2-64,mh/2-49,body);next.setEnabled(scene.historyPage<pages-1);
    text(`${scene.historyPage+1} / ${pages}`,12,0,mh/2-49,body,PALETTE.muted);storageCaption(scene,body,mw,mh/2-14);
  }
  scene.app.canvas.dataset.modal=type;
}
