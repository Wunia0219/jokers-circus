import {slotChrome} from './slot-theme.js';

const smooth=(from,to,value)=>{const t=Math.max(0,Math.min(1,(value-from)/(to-from)));return t*t*(3-2*t);};

// One wide composition, fitted as a unit below the shared header. Resizing a
// Discord activity must not independently move the table, actor and cards.
function wideTableLayout(width,height,ui){
  const w=1600,scale=width/w,h=height/scale,room=height-ui.headerHeight;
  const fit=Math.min(width/1600,room/820),left=(width-1600*fit)/2,top=ui.headerHeight+(room-820*fit)/2;
  const x=value=>(left+value*fit)/scale,y=value=>(top+value*fit)/scale;
  const unit=fit/scale,nearWidth=182,nearHalf=nearWidth*(113/156*.92+.035),nearY=820-nearHalf-32;
  const farEdge=nearY-nearHalf-18,actorTop=8,actorHeight=(farEdge-actorTop)/.44;
  const sideWidth=250,sideHeight=sideWidth*214/156,sideY=actorTop+(farEdge-actorTop)/2;
  const actionHeight=Math.max(44,52*fit),actionY=top+(nearY+10)*fit+Math.max(0,72*(.65-fit));
  return {w,h,portrait:false,mode:'wide',scale,top:y(actorTop),ui,stackedControls:false,compactFeedback:false,
    logo:{x:w/2,y:0,width:0},dealer:{x:x(800),y:y(actorTop),height:actorHeight*unit},
    table:{x:w/2,y:h*1.20,rx:w*.83,ry:h*1.20-y(farEdge)},
    dealerCard:{x:x(1200),y:y(sideY),scale:sideWidth/156*unit,perspective:1},
    progress:{x:left+400*fit,y:top+sideY*fit,width:sideWidth*fit,height:sideHeight*fit},
    playerCards:{x:x(650),y:y(nearY),gap:nearWidth*1.27*unit,scale:nearWidth/156*unit,perspective:.92},
    selectedLift:36*unit,confirmedLift:36*unit,hoverLift:8*unit,dealerLift:0,
    playZone:{x:x(650),y:y(nearY)},
    action:{x:left+1200*fit,y:actionY,width:Math.max(140,210*fit),height:actionHeight,fontSize:Math.max(14,17*fit)},
    status:{x:left+1200*fit,y:actionY-actionHeight/2-Math.max(32,52*fit),width:Math.max(180,260*fit),fontSize:Math.max(14,18*fit),detailSize:Math.max(10,12*fit),detailGap:Math.max(18,23*fit)},
    cardWidth:156,cardHeight:214};
}

// Only the shared top bar uses slot dimensions. The room belongs to this game.
export function tableLayout(width,height,{touch=false}={}) {
  if(!(width>0 && height>0))throw new Error('Viewport must have a positive size');
  const ui=slotChrome(width,height,touch),roomHeight=height-ui.headerHeight;
  const portrait=width/height<1.05;
  if(!portrait)return wideTableLayout(width,height,ui);
  const w=760,scale=width/w,h=height/scale;
  const stackedControls=true,compactFeedback=roomHeight<600;
  const footerSpace=compactFeedback?106:130;
  const gap=Math.min(18,Math.max(12,roomHeight*.025)),cardHalfRatio=113/156*.92+.035;
  let nearWidth=Math.max(52,Math.min(156,width*.25,roomHeight*(height<=500 ? .225 : .21)));
  if(compactFeedback)nearWidth=Math.min(nearWidth,Math.max(52,(roomHeight*.55-8-footerSpace-gap-2)/(2*cardHalfRatio)));
  const nearHalf=nearWidth*113/156*.92+nearWidth*.035;
  const nearY=height-nearHalf-footerSpace;
  const farEdge=Math.min(ui.headerHeight+roomHeight*.72,nearY-nearHalf-gap);
  const baseActorTop=ui.headerHeight+8,baseActorHeight=(farEdge-baseActorTop)/.44;
  // A tall phone should gain breathing room, rather than magnifying the
  // portrait until its shoulders fill both HUD columns. Blend the adjustment
  // with aspect ratio and available height, without a new phone breakpoint.
  const portraitWings=smooth(1.3,1.85,height/width)*(1-smooth(520,700,width));
  const portraitFit=portraitWings*smooth(440,680,roomHeight);
  const fittedHeight=Math.min(baseActorHeight*.90,width*2.1);
  const widthFittedHeight=baseActorHeight+(fittedHeight-baseActorHeight)*portraitFit;
  const compactPortrait=portraitWings*(1-smooth(440,680,roomHeight));
  const actorHeight=widthFittedHeight*(1-.06*compactPortrait);
  const nearGap=nearWidth*1.27;
  // Mirrored wings share their centre line, top edge, and visual weight.
  const sideWidth=Math.min(width*(ui.mobile ? .22-.03*portraitWings : .17),(farEdge-baseActorTop)*.70*156/214,(farEdge-baseActorTop-48)*156/214);
  const sideHeight=sideWidth*214/156,baseSideY=baseActorTop+(farEdge-baseActorTop)*.50;
  const upperSideY=Math.min(baseSideY,ui.headerHeight+31+sideHeight/2);
  const sideY=baseSideY+(upperSideY-baseSideY)*portraitWings;
  const sideX=width*(ui.mobile ? .18-.035*portraitWings : .25);
  const portraitShift=Math.min((baseActorHeight-widthFittedHeight)*.44,(farEdge-baseActorTop)*.14);
  const shoulderSafeTop=sideY+sideHeight/2+12-actorHeight*.10;
  const actorTop=Math.max(baseActorTop+portraitShift,baseActorTop+(shoulderSafeTop-baseActorTop)*portraitFit);
  const lift=Math.min(32,nearWidth*.20);
  const actionWidth=200,actionX=width/2,actionY=height-32,nearX=width/2;
  const statusWidth=Math.min(width-24,400);
  return {w,h,portrait,mode:'narrow',scale,top:actorTop/scale,ui,stackedControls,compactFeedback,
    logo:{x:w/2,y:0,width:0},
    dealer:{x:w/2,y:actorTop/scale,height:actorHeight/scale},
    table:{x:w/2,y:h*1.20,rx:w*(portrait?1.25:.83),ry:h*1.20-farEdge/scale},
    dealerCard:{x:(width-sideX)/scale,y:sideY/scale,scale:sideWidth/156/scale,perspective:1},
    progress:{x:sideX,y:sideY,width:sideWidth,height:sideHeight},
    playerCards:{x:nearX/scale,y:nearY/scale,gap:nearGap/scale,scale:nearWidth/156/scale,perspective:.92},
    selectedLift:lift/scale,confirmedLift:lift/scale,hoverLift:Math.min(8,lift*.3)/scale,
    dealerLift:0,
    playZone:{x:nearX/scale,y:nearY/scale},
    action:{x:actionX,y:actionY,width:actionWidth,height:52},
    status:{x:actionX,y:actionY-(compactFeedback?56:76),width:statusWidth,detailGap:compactFeedback?17:23},
    cardWidth:156,cardHeight:214};
}
export const TABLE_MOVES=Object.freeze(['rock','scissors','paper']);
export const TABLE_MOVE_NAMES=Object.freeze({rock:'拳頭',scissors:'剪刀',paper:'布'});
