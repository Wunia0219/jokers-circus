import {slotChrome} from './slot-theme.js';

const smooth=(from,to,value)=>{const t=Math.max(0,Math.min(1,(value-from)/(to-from)));return t*t*(3-2*t);};

// Only the shared top bar uses slot dimensions. The room belongs to this game.
export function tableLayout(width,height,{touch=false}={}) {
  if(!(width>0 && height>0))throw new Error('Viewport must have a positive size');
  const portrait=width/height<1.05,w=portrait?760:1600,scale=width/w,h=height/scale;
  const ui=slotChrome(width,height,touch),roomHeight=height-ui.headerHeight;
  const compact=height<=500,stackedControls=ui.mobile || !compact && width<1000;
  const compactFeedback=stackedControls && roomHeight<600;
  // Gradually reclaim the bottom margin on desktop, instead of changing the
  // stage and both wings in one jump at a desktop width breakpoint.
  const desktopRoom=Math.max(0,Math.min(1,(width-1000)/400));
  const footerSpace=stackedControls?(compactFeedback?106:130):compact?32:130-98*desktopRoom;
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
  const actionWidth=stackedControls?200:210;
  const actionX=stackedControls?width/2:compact?width-12-actionWidth/2:width-sideX;
  const actionY=stackedControls?height-32:nearY+10;
  const nearHalfWidth=nearWidth*(84+113*.92*.06)/156;
  const nearX=stackedControls?width/2:Math.min(width/2,actionX-actionWidth/2-16-nearGap-nearHalfWidth);
  const statusWidth=stackedControls?Math.min(width-24,400):Math.min(260,(width-12-actionX)*2);
  return {w,h,portrait,scale,top:actorTop/scale,ui,stackedControls,compactFeedback,
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
