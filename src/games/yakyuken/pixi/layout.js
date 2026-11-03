import {slotChrome} from './slot-theme.js';

// Only the shared top bar uses slot dimensions. The room belongs to this game.
export function tableLayout(width,height,{touch=false}={}) {
  if(!(width>0 && height>0))throw new Error('Viewport must have a positive size');
  const portrait=width/height<1.05,w=portrait?760:1600,scale=width/w,h=height/scale;
  const ui=slotChrome(width,height,touch),roomHeight=height-ui.headerHeight;
  const nearWidth=Math.max(44,Math.min(104,width*.20,roomHeight*.122));
  const farWidth=nearWidth*.60,nearHalf=nearWidth*214/156*.84/2,farHalf=farWidth*214/156*.84/2;
  const nearY=height-nearHalf-(ui.mobile?96:22),gap=Math.min(16,Math.max(10,roomHeight*.018));
  const farY=nearY-nearHalf-farHalf-gap;
  const farEdge=Math.min(ui.headerHeight+roomHeight*.65,farY-farHalf-14);
  const actorTop=ui.headerHeight+8,actorHeight=(farEdge-actorTop)/.44;
  const nearGap=nearWidth*1.38,farGap=nearGap*.72;
  const lift=Math.min(10,gap*.45);
  const actionX=ui.mobile?width/2:Math.min(width-106,width/2+nearGap*1.8+100);
  const actionY=ui.mobile?height-30:nearY;
  return {w,h,portrait,scale,top:actorTop/scale,ui,
    logo:{x:w*.17,y:(ui.headerHeight+24)/scale,width:ui.mobile?0:Math.min(230,width*.20)/scale},
    dealer:{x:w/2,y:actorTop/scale,height:actorHeight/scale},
    table:{x:w/2,y:h*1.20,rx:w*(portrait?1.25:.83),ry:h*1.20-farEdge/scale},
    dealerCards:{x:w/2,y:farY/scale,gap:farGap/scale,scale:farWidth/156/scale},
    playerCards:{x:w/2,y:nearY/scale,gap:nearGap/scale,scale:nearWidth/156/scale},
    selectedLift:lift*.75/scale,confirmedLift:lift/scale,hoverLift:Math.min(5,lift*.5)/scale,
    dealerLift:Math.min(7,gap*.45)/scale,
    playZone:{x:w/2,y:(farY+nearY)/2/scale},
    action:{x:actionX,y:actionY,width:ui.mobile?176:180,height:44},
    status:{x:actionX,y:ui.mobile?height-68:nearY-52,width:ui.mobile?width-24:220},
    cardWidth:156,cardHeight:214};
}
export const TABLE_MOVES=Object.freeze(['rock','scissors','paper']);
export const TABLE_MOVE_NAMES=Object.freeze({rock:'拳頭',scissors:'剪刀',paper:'布'});
