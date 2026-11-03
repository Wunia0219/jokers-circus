import {slotChrome} from './slot-theme.js';

// Only the shared top bar uses slot dimensions. The room belongs to this game.
export function tableLayout(width,height,{touch=false}={}) {
  if(!(width>0 && height>0))throw new Error('Viewport must have a positive size');
  const portrait=width/height<1.05,w=portrait?760:1600,scale=width/w,h=height/scale;
  const ui=slotChrome(width,height,touch),roomHeight=height-ui.headerHeight;
  const nearWidth=Math.max(52,Math.min(156,width*.235,roomHeight*.225));
  const nearHalf=nearWidth*113/156*.92+nearWidth*.035;
  const nearY=height-nearHalf-(ui.mobile?106:26),gap=Math.min(18,Math.max(12,roomHeight*.025));
  const farEdge=Math.min(ui.headerHeight+roomHeight*.72,nearY-nearHalf-gap);
  const actorTop=ui.headerHeight+8,actorHeight=(farEdge-actorTop)/.44;
  const nearGap=nearWidth*1.27;
  // Mirrored wings share their centre line, top edge, and visual weight.
  const sideWidth=Math.min(190,width*.22,(farEdge-actorTop)*.62*156/214);
  const sideHeight=sideWidth*214/156,sideY=actorTop+(farEdge-actorTop)*.53;
  const sideX=width*(ui.mobile ? .18 : .25);
  const lift=Math.min(10,gap*.45);
  const actionX=ui.mobile?width/2:Math.min(width-106,width/2+nearGap*1.8+100);
  const actionY=ui.mobile?height-30:nearY;
  return {w,h,portrait,scale,top:actorTop/scale,ui,
    logo:{x:w*.17,y:(ui.headerHeight+24)/scale,width:ui.mobile || height<550?0:Math.min(230,width*.20)/scale},
    dealer:{x:w/2,y:actorTop/scale,height:actorHeight/scale},
    table:{x:w/2,y:h*1.20,rx:w*(portrait?1.25:.83),ry:h*1.20-farEdge/scale},
    dealerCard:{x:(width-sideX)/scale,y:sideY/scale,scale:sideWidth/156/scale,perspective:1},
    progress:{x:sideX,y:sideY,width:sideWidth,height:sideHeight},
    playerCards:{x:w/2,y:nearY/scale,gap:nearGap/scale,scale:nearWidth/156/scale,perspective:.92},
    selectedLift:lift*.75/scale,confirmedLift:lift/scale,hoverLift:Math.min(5,lift*.5)/scale,
    dealerLift:0,
    playZone:{x:w/2,y:nearY/scale},
    action:{x:actionX,y:actionY,width:ui.mobile?176:180,height:44},
    status:{x:actionX,y:ui.mobile?height-68:nearY-52,width:ui.mobile?width-24:220},
    cardWidth:156,cardHeight:214};
}
export const TABLE_MOVES=Object.freeze(['rock','scissors','paper']);
export const TABLE_MOVE_NAMES=Object.freeze({rock:'拳頭',scissors:'剪刀',paper:'布'});
