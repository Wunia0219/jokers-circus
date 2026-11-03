import {slotChrome} from './slot-theme.js';

// Only the shared top bar uses slot dimensions. The room belongs to this game.
export function tableLayout(width,height,{touch=false}={}) {
  if(!(width>0 && height>0))throw new Error('Viewport must have a positive size');
  const portrait=width/height<1.05,w=portrait?760:1600,scale=width/w,h=height/scale;
  const ui=slotChrome(width,height,touch),roomHeight=height-ui.headerHeight;
  const compact=height<=500,stackedControls=ui.mobile || !compact && width<1500;
  const compactFeedback=stackedControls && roomHeight<600;
  const footerSpace=stackedControls?(compactFeedback?106:130):32;
  const gap=Math.min(18,Math.max(12,roomHeight*.025)),cardHalfRatio=113/156*.92+.035;
  let nearWidth=Math.max(52,Math.min(156,width*.25,roomHeight*(height<=500 ? .225 : .21)));
  if(compactFeedback)nearWidth=Math.min(nearWidth,Math.max(52,(roomHeight*.55-8-footerSpace-gap-2)/(2*cardHalfRatio)));
  const nearHalf=nearWidth*113/156*.92+nearWidth*.035;
  const nearY=height-nearHalf-footerSpace;
  const farEdge=Math.min(ui.headerHeight+roomHeight*.72,nearY-nearHalf-gap);
  const actorTop=ui.headerHeight+8,actorHeight=(farEdge-actorTop)/.44;
  const nearGap=nearWidth*1.27;
  // Mirrored wings share their centre line, top edge, and visual weight.
  const sideWidth=Math.min(184,width*.22,(farEdge-actorTop)*.58*156/214);
  const sideHeight=sideWidth*214/156,sideY=actorTop+(farEdge-actorTop)*.50;
  const sideX=width*(ui.mobile ? .18 : .25);
  const lift=Math.min(10,gap*.45);
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
    selectedLift:lift*.75/scale,confirmedLift:lift/scale,hoverLift:Math.min(5,lift*.5)/scale,
    dealerLift:0,
    playZone:{x:nearX/scale,y:nearY/scale},
    action:{x:actionX,y:actionY,width:actionWidth,height:52},
    status:{x:actionX,y:actionY-(compactFeedback?56:76),width:statusWidth,detailGap:compactFeedback?17:23},
    cardWidth:156,cardHeight:214};
}
export const TABLE_MOVES=Object.freeze(['rock','scissors','paper']);
export const TABLE_MOVE_NAMES=Object.freeze({rock:'拳頭',scissors:'剪刀',paper:'布'});
