import {Container,FillGradient,Graphics,Rectangle} from 'pixi.js';
import {characterRule} from '../characters.js';
import {label,PALETTE,PixiButton} from '../../../ui/pixi/ui.js';

const addText=(parent,value,size,x,y,color=PALETTE.cream,options={},anchor=.0)=>{
  const node=label(value,size,color,options);node.anchor.x=anchor;node.position.set(x,y);parent.addChild(node);return node;
};
function score(parent,record,x,y,size){
  const group=new Container({label:'history-win-loss',eventMode:'none'});group.position.set(x,y);parent.addChild(group);
  const pieces=[[`${record.wins} 勝`,PALETTE.win],[' / ',PALETTE.muted],[`${record.losses} 敗`,PALETTE.loss]];let width=0;
  for(const [value,color] of pieces){const node=addText(group,value,size,width,0,color,{fontWeight:'500'});width+=node.width;}
  for(const node of group.children)node.x-=width/2;
}
export function buildMatchHistory(scene,body,mw,mh){
  const phone=scene.layout.ui.width<=700,inset=phone?16:24,header=phone?64:72,top=-mh/2+header+(phone?58:60),vh=mh-(top+mh/2)-50,cw=mw-inset*2-10;
  const summaryHeight=cw<420?104:84,detailHeight=88,pad=phone?14:20,records=scene.archive.records();
  scene.historyExpanded ||= new Set();
  const headFill=new FillGradient({start:{x:0,y:0},end:{x:1,y:0},colorStops:[{offset:0,color:0x3b1d2d},{offset:1,color:0x291c2b}]});
  body.addChild(new Graphics().roundRect(-mw/2,-mh/2,mw,header,18).fill(headFill).rect(-mw/2,-mh/2+18,mw,header-18).fill(headFill));
  body.addChild(new Graphics().moveTo(-mw/2,-mh/2+header).lineTo(mw/2,-mh/2+header).stroke({color:0xc79a5f,alpha:.26,width:1}));
  addText(body,'遊玩紀錄',scene.layout.ui.width<=450?17:19,-mw/2+inset,-mh/2+header/2,PALETTE.gold,{fontWeight:'500'});
  addText(body,`共 ${records.length} 場 · 點開一場查看對局結果`,12,-mw/2+inset,-mh/2+header+(phone?29:31),0xd5bcbf);
  const bounds=new Rectangle(0,0,cw,vh),viewport=new Container({label:'match-history-scroll',eventMode:'static',hitArea:bounds,boundsArea:bounds});viewport.position.set(-mw/2+inset,top);body.addChild(viewport);
  viewport.accessible=true;viewport.accessibleTitle='遊玩紀錄清單，使用方向鍵或滑動查看更多';viewport.accessibleHint=viewport.accessibleTitle;viewport.accessibleType='div';viewport.tabIndex=0;
  viewport.accessiblePointerEvents='none';
  const content=new Container({label:'match-history-rows',eventMode:'passive'}),mask=new Graphics().rect(0,0,cw,vh).fill(0xffffff);viewport.addChild(content,mask);content.mask=mask;
  const thumb=new Graphics();body.addChild(thumb);
  let rows,max,dragMoved=false;
  const measure=()=>{
    let y=0;rows=records.map(record=>{const height=summaryHeight+(scene.historyExpanded.has(record.id)?detailHeight:0),row={record,y,height};y+=height+12;return row;});
    max=Math.max(0,y-(records.length?12:0)-vh);
  };
  const show=focusId=>{
    scene.historyScroll=Math.max(0,Math.min(scene.historyScroll || 0,max));const offset=scene.historyScroll;
    content.removeChildren().forEach(child=>child.destroy({children:true}));
    const visible=rows.filter(row=>row.y+row.height>offset && row.y<offset+vh);let focus;
    for(const {record,y,height} of visible){
      const expanded=scene.historyExpanded.has(record.id),row=new Container({label:`match:${record.id}`,eventMode:'passive'});row.position.set(0,y-offset);content.addChild(row);
      row.addChild(new Graphics().roundRect(0,0,cw,height,12).fill(new FillGradient({start:{x:0,y:0},end:{x:1,y:0},colorStops:[{offset:0,color:0x3c2637},{offset:1,color:0x2a1e30}]})).stroke({color:0xc79a5f,alpha:.31,width:1}));
      const status={won:'這場挑戰已通關。',lost:'這場挑戰未通關。',left:'這場已中途離場。',playing:record.id===scene.matchId?'這場仍在進行中。':'這場尚未完成。'}[record.status];
      const date=new Date(record.startedAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Taipei'});
      const net=record.net ?? record.reward,prize=Math.abs(net).toLocaleString('en-US'),title=record.reward?`獲得 ${record.reward.toLocaleString('en-US')} 戲籌`:'這場沒有得獎';
      const summary=new PixiButton({name:`${expanded?'收合':'展開'} ${date} ${characterRule(record.characterId).name} 對局結果`,variant:'quiet',width:cw,height:summaryHeight,onPress:()=>{
        if(dragMoved)return;const keyboard=summary.focused;
        if(expanded)scene.historyExpanded.delete(record.id);else scene.historyExpanded.add(record.id);
        measure();show(keyboard?record.id:undefined);
      }});
      // Pointer gestures stay on the canvas so the list can wheel/drag; the
      // accessibility button remains focusable and activates with Enter/Space.
      summary.accessiblePointerEvents='none';
      summary.position.set(cw/2,summaryHeight/2);row.addChild(summary);if(record.id===focusId)focus=summary;
      const right=cw-pad-22;
      addText(row,date,12,pad,24,0xd3bac6);
      const heading=addText(row,title,phone?14:16,pad,39,PALETTE.cream,{fontWeight:'500',wordWrap:true,wordWrapWidth:cw*.38-pad,lineHeight:20});heading.anchor.y=0;
      score(row,record,cw*.54,summaryHeight>84?80:51,cw<300?12:phone?14:16);
      addText(row,'戲籌變化',11,right,23,0xd3bac6,{},1);
      addText(row,`${net>0?'+':net<0?'−':''}${prize}`,phone?23:26,right,51,net>0?0xb7e8bf:net<0?PALETTE.loss:0xe2c7cd,{fontFamily:['Georgia','serif']},1);
      const chevron=new Graphics().moveTo(-4,-2).lineTo(0,2).lineTo(4,-2).stroke({color:0xe4c88b,width:1});chevron.position.set(cw-pad-4,summaryHeight/2);if(expanded)chevron.rotation=Math.PI;chevron.eventMode='none';row.addChild(chevron);
      if(expanded){
        row.addChild(new Graphics().moveTo(0,summaryHeight).lineTo(cw,summaryHeight).stroke({color:0xd1a866,alpha:.15,width:1}));
        addText(row,characterRule(record.characterId).name,13,pad,summaryHeight+21,0xdec9b1);
        score(row,record,pad+45,summaryHeight+43,13);
        addText(row,status,12,pad,summaryHeight+66,0xdac0cb);
      }
    }
    if(!records.length){addText(content,'第一場挑戰，等你開場',19,cw/2,vh/2-18,PALETTE.gold,{wordWrap:true,wordWrapWidth:cw-24},.5);addText(content,'開始一場野球拳，這裡就會留下對局結果與通關獎勵。',14,cw/2,vh/2+25,PALETTE.muted,{wordWrap:true,wordWrapWidth:cw-24,lineHeight:22},.5);}
    thumb.clear();if(max){const h=Math.max(32,vh*vh/(max+vh));thumb.roundRect(mw/2-12,top,3,vh,1.5).fill({color:PALETTE.gold,alpha:.12});thumb.roundRect(mw/2-12,top+(vh-h)*offset/max,3,h,1.5).fill({color:PALETTE.gold,alpha:.55});}
    viewport.accessibleText=visible.map(({record:r})=>`${characterRule(r.characterId).name}，${r.wins} 勝 ${r.losses} 敗，戲籌變化 ${r.net??r.reward}，${scene.wallet?'測試戲籌':'試玩未入帳'}`).join('。');
    if(viewport._accessibleDiv)viewport._accessibleDiv.textContent=viewport.accessibleText;
    if(focus){scene.app.render();focus._accessibleDiv?.focus();}
  };
  scene.scrollHistory=(delta,edge)=>{scene.historyScroll=edge==='start'?0:edge==='end'?max:(scene.historyScroll || 0)+delta;show();};
  viewport.on('wheel',event=>{event.stopPropagation();scene.scrollHistory(event.deltaY*(event.deltaMode===1?20:event.deltaMode===2?vh:1));});
  let drag=null;
  viewport.on('pointerdown',event=>{dragMoved=false;drag={id:event.pointerId,y:event.global.y,offset:scene.historyScroll || 0};});
  viewport.on('pointermove',event=>{if(drag && drag.id===event.pointerId && Math.abs(drag.y-event.global.y)>6){dragMoved=true;scene.historyScroll=drag.offset+(drag.y-event.global.y);show();}});
  for(const name of ['pointerup','pointerupoutside','pointercancel'])viewport.on(name,()=>{drag=null;queueMicrotask(()=>{dragMoved=false;});});
  addText(body,`${scene.wallet?'測試戲籌':'試玩獎勵未入帳'} · 所有時間皆為台灣時間`,10,0,mh/2-31,PALETTE.muted,{},.5);
  addText(body,scene.archive.cloud?'紀錄儲存在測試雲端':scene.archive.persistent?'紀錄儲存在這台裝置':'目前無法儲存，資料只保留在此頁',10,0,mh/2-15,PALETTE.muted,{},.5);measure();show();
  // Header controls remain above the title strip and scrolling content.
  const close=body.children.find(node=>node.accessibleTitle==='關閉視窗');if(close)body.setChildIndex(close,body.children.length-1);
}
