import {Container,FillGradient,Graphics,Rectangle} from 'pixi.js';
import {characterRule} from '../characters.js';
import {label,PALETTE} from './ui.js';

const addText=(parent,value,size,x,y,color=PALETTE.cream,options={},anchor=.0)=>{
  const node=label(value,size,color,options);node.anchor.x=anchor;node.position.set(x,y);parent.addChild(node);return node;
};
export function buildMatchHistory(scene,body,mw,mh){
  const phone=scene.layout.ui.width<=700,inset=phone?16:24,top=-mh/2+108,vh=mh-152,cw=mw-inset*2-10,step=138,cardHeight=126;
  const records=scene.archive.records(),max=Math.max(0,records.length*step-12-vh);
  body.addChild(new Graphics().roundRect(-mw/2,-mh/2,mw,66,14).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:0},colorStops:[{offset:0,color:0x522333},{offset:1,color:0x291c2b}]})));
  body.addChild(new Graphics().moveTo(-mw/2,-mh/2+66).lineTo(mw/2,-mh/2+66).stroke({color:PALETTE.gold,alpha:.26,width:1}));
  addText(body,'遊玩紀錄',19,-mw/2+inset,-mh/2+32,PALETTE.gold);
  addText(body,`共 ${records.length} 場 · 所有時間皆為台灣時間`,12,-mw/2+inset,-mh/2+86,PALETTE.muted);
  const bounds=new Rectangle(0,0,cw,vh),viewport=new Container({label:'match-history-scroll',eventMode:'static',hitArea:bounds,boundsArea:bounds});viewport.position.set(-mw/2+inset,top);body.addChild(viewport);
  viewport.accessible=true;viewport.accessibleTitle='遊玩紀錄清單，使用方向鍵或滑動查看更多';viewport.accessibleHint=viewport.accessibleTitle;viewport.accessibleType='div';viewport.tabIndex=0;
  viewport.accessiblePointerEvents='none';
  const content=new Container({label:'match-history-rows',eventMode:'none'}),mask=new Graphics().rect(0,0,cw,vh).fill(0xffffff);viewport.addChild(content,mask);content.mask=mask;
  const thumb=new Graphics();body.addChild(thumb);
  const show=()=>{
    scene.historyScroll=Math.max(0,Math.min(scene.historyScroll || 0,max));const offset=scene.historyScroll;
    content.removeChildren().forEach(child=>child.destroy({children:true}));
    const first=Math.floor(offset/step),last=Math.min(records.length,Math.ceil((offset+vh)/step));
    for(let i=first;i<last;i++){
      const record=records[i],row=new Container({label:`match:${record.id}`,eventMode:'none'});row.position.set(0,i*step-offset);content.addChild(row);
      row.addChild(new Graphics().roundRect(0,0,cw,cardHeight,12).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:0},colorStops:[{offset:0,color:0x3c2637},{offset:1,color:0x2a1e30}]})).stroke({color:0xc79a5f,alpha:.32,width:1}));
      if(record.reward)row.addChild(new Graphics().roundRect(0,12,3,cardHeight-24,1.5).fill(PALETTE.gold));
      const status={won:'通關',lost:'敗場結束',left:'已離場',playing:record.id===scene.matchId?'本場進行中':'未完成'}[record.status];
      const date=new Date(record.startedAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Taipei'});
      addText(row,characterRule(record.characterId).name,phone?17:18,16,26,PALETTE.cream,{fontWeight:'500'});
      addText(row,date,12,16,51,PALETTE.muted);
      addText(row,status,13,16,83,record.reward?PALETTE.gold:PALETTE.muted);
      addText(row,'試玩未入帳',11,16,105,PALETTE.muted);
      const right=cw-16;
      addText(row,`${record.wins} 勝 / ${record.losses} 敗`,phone?24:28,right,29,PALETTE.bright,{fontFamily:['Georgia','serif'],fontWeight:'bold'},1);
      addText(row,`+${record.reward.toLocaleString('en-US')}`,phone?25:29,right,78,record.reward?0xb7e8bf:PALETTE.muted,{fontFamily:['Georgia','serif']},1);
      addText(row,'獲得戲籌',11,right,105,PALETTE.muted,{},1);
    }
    if(!records.length){addText(content,'還沒有遊玩紀錄',19,cw/2,vh/2-15,PALETTE.gold,{},.5);addText(content,'開始一場對局後，就會出現在這裡。',12,cw/2,vh/2+20,PALETTE.muted,{wordWrap:true,wordWrapWidth:cw-24},.5);}
    thumb.clear();if(max){const h=Math.max(32,vh*vh/(max+vh));thumb.roundRect(mw/2-12,top,3,vh,1.5).fill({color:PALETTE.gold,alpha:.12});thumb.roundRect(mw/2-12,top+(vh-h)*offset/max,3,h,1.5).fill({color:PALETTE.gold,alpha:.55});}
    viewport.accessibleText=records.slice(first,last).map(r=>`${characterRule(r.characterId).name}，${r.wins} 勝 ${r.losses} 敗，獲得 ${r.reward} 戲籌`).join('。');
    if(viewport._accessibleDiv)viewport._accessibleDiv.textContent=viewport.accessibleText;
  };
  scene.scrollHistory=(delta,edge)=>{scene.historyScroll=edge==='start'?0:edge==='end'?max:(scene.historyScroll || 0)+delta;show();};
  viewport.on('wheel',event=>{event.stopPropagation();scene.scrollHistory(event.deltaY*(event.deltaMode===1?20:event.deltaMode===2?vh:1));});
  let drag=null;
  viewport.on('pointerdown',event=>{drag={id:event.pointerId,y:event.global.y,offset:scene.historyScroll};});
  viewport.on('pointermove',event=>{if(drag && drag.id===event.pointerId){scene.historyScroll=drag.offset+(drag.y-event.global.y);show();}});
  for(const name of ['pointerup','pointerupoutside','pointercancel'])viewport.on(name,()=>{drag=null;});
  addText(body,scene.archive.persistent?'紀錄儲存在這台裝置':'目前無法儲存，資料只保留在此頁',11,0,mh/2-20,PALETTE.muted,{},.5);show();
  // Header controls remain above the title strip and scrolling content.
  const close=body.children.find(node=>node.accessibleTitle==='關閉視窗');if(close)body.setChildIndex(close,body.children.length-1);
}
