import {gameLobbyLayout} from '../../../ui/lobby/lobby-layout.js';

// All menu geometry is in CSS pixels, independent of the table's world scale.
export function lobbyLayout(width,height,headerHeight){
  const vertical=width<650 && height>width,room=height-headerHeight;
  const lobby=gameLobbyLayout(width,height);
  const contentScale=vertical?1:Math.max(.8,Math.min(2,width/1280,room/650));
  const infoX=vertical?width/2:width*.74,slotsWidth=vertical?width-24:Math.min(520*contentScale,width*.46-36);
  const slotGap=vertical?8:10*contentScale;
  const slotWidth=(slotsWidth-slotGap*4)/5,slotHeight=vertical?68:Math.min(104*contentScale,room*.22);
  const slotsY=vertical?height-153:headerHeight+room*.54;
  const artTop=headerHeight+(vertical?52:16),artBottom=vertical?slotsY-slotHeight/2-10:height-16;
  return {...lobby,character:{
    infoX,contentScale,vertical,headingY:vertical?headerHeight+24:headerHeight+room*.12,
    nameY:vertical?artBottom-34:headerHeight+room*.25,
    descriptionY:headerHeight+room*.34,
    rulesY:vertical?artBottom-9:headerHeight+room*.42,
    panel:{x:infoX,y:headerHeight+room*.48,width:Math.min(width*.48,slotsWidth+40*contentScale),height:room*.88},
    art:{x:vertical?0:width*.05,y:artTop,width:vertical?width:width*.53,height:artBottom-artTop},
    slots:CHARACTER_INDICES.map(index=>({x:infoX+(index-2)*(slotWidth+slotGap),y:slotsY,width:slotWidth,height:slotHeight})),
    buttonWidth:Math.min(280*contentScale,slotsWidth*.78),buttonHeight:Math.max(44,48*contentScale),
    feeY:vertical?height-86:headerHeight+room*.71,enterY:vertical?height-37:headerHeight+room*.82,
  }};
}
const CHARACTER_INDICES=[0,1,2,3,4];
