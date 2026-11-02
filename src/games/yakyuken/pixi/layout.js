import {slotChrome} from './slot-theme.js';

// Game geometry uses logical units. Slot-style chrome uses actual CSS pixels.
export function tableLayout(width,height,{touch=false}={}) {
  if(!(width>0 && height>0))throw new Error('Viewport must have a positive size');
  const portrait=width/height<1.05,w=portrait?760:1600,scale=width/w,h=height/scale;
  const ui=slotChrome(width,height,touch),gameHeight=Math.max(130,ui.gameBottom-ui.gameTop);
  const tight=gameHeight<260;
  const nearWidth=Math.max(44,Math.min(portrait?width*.21:width*.09,gameHeight*.28,140));
  const farWidth=nearWidth*.7,nearHalf=nearWidth*214/156*.84/2,farHalf=farWidth*214/156*.84/2;
  const nearY=ui.gameBottom-nearHalf-16,gap=Math.min(24,gameHeight*.05);
  const farY=nearY-nearHalf-farHalf-gap;
  const farEdge=Math.min(ui.gameTop+gameHeight*(tight ? .32 : .43),farY-farHalf-4);
  const clearance=Math.max(2,nearY-nearHalf-(farY+farHalf));
  const lift=Math.min(16,clearance*.55);
  const logoWidth=tight?0:Math.min(420,width*(portrait ? .52 : .30));
  const logoHeight=logoWidth*336/1064;
  const actorTop=ui.gameTop+(tight?6:portrait?logoHeight+10:12);
  const actorHeight=Math.max(100,(farEdge-actorTop)/.38);
  const nearGap=Math.max(nearWidth+12,Math.min(width*.25,nearWidth*1.45)),farGap=Math.max(farWidth+12,nearGap*.72);
  return {w,h,portrait,scale,top:actorTop/scale,ui,
    logo:{x:portrait?w/2:w*.25,y:(ui.gameTop+4)/scale,width:logoWidth/scale},
    dealer:{x:w/2,y:actorTop/scale,height:actorHeight/scale},
    table:{x:w/2,y:h*1.05,rx:w*(portrait?1.17:.76),ry:h*1.05-farEdge/scale},
    dealerCards:{x:w/2,y:farY/scale,gap:farGap/scale,scale:farWidth/156/scale},
    playerCards:{x:w/2,y:nearY/scale,gap:nearGap/scale,scale:nearWidth/156/scale},
    selectedLift:lift*.75/scale,confirmedLift:lift/scale,hoverLift:Math.min(6,lift*.5)/scale,
    dealerLift:Math.min(10,Math.max(2,(farY-farHalf-farEdge)*.75))/scale,
    playZone:{x:w/2,y:(farY+nearY)/2/scale},statusY:(farY+farHalf+nearY-nearHalf)/2/scale,
    actionY:(ui.deck.y+ui.deck.height/2)/scale,cardWidth:156,cardHeight:214};
}
export const TABLE_MOVES=Object.freeze(['rock','scissors','paper']);
export const TABLE_MOVE_NAMES=Object.freeze({rock:'拳頭',scissors:'剪刀',paper:'布'});
