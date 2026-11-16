import {gameLobbyLayout} from '../../../ui/lobby/lobby-layout.js';

// All menu geometry is in CSS pixels, independent of the table's world scale.
export function lobbyLayout(width,height,headerHeight){
  const vertical=width<650 && height>width,room=height-headerHeight;
  const lobby=gameLobbyLayout(width,height);
  const compactWide=!vertical&&room<300;
  const shortPortrait=vertical&&room<400;
  const contentScale=vertical?1:compactWide?Math.max(.68,room/375):Math.max(.8,Math.min(2,width/1280,room/650));
  const infoX=vertical?width/2:width*(compactWide?.72:.74);
  const slotsWidth=vertical?width-24:Math.min(520*contentScale,width*(compactWide?.56:.46)-(compactWide?20:36));
  const slotGap=vertical?8:10*contentScale;
  const slotWidth=(slotsWidth-slotGap*4)/5,slotHeight=vertical?(shortPortrait?56:68):Math.max(44,Math.min(104*contentScale,room*.22));
  const slotsY=vertical?height-(shortPortrait?123:153):compactWide?Math.min(headerHeight+room*.60,height-66-slotHeight/2):headerHeight+room*.54;
  const artTop=headerHeight+(vertical?(shortPortrait?42:52):16),artBottom=vertical?slotsY-slotHeight/2-10:height-16;
  const rulesY=vertical?artBottom-9:Math.min(headerHeight+room*.42,slotsY-slotHeight/2-10);
  return {...lobby,character:{
    infoX,contentScale,vertical,compactWide,headingY:vertical?headerHeight+24:compactWide?rulesY-57:headerHeight+room*.12,
    nameY:vertical?artBottom-34:compactWide?rulesY-35:headerHeight+room*.25,
    descriptionY:compactWide?rulesY-15:headerHeight+room*.34,
    rulesY,
    panel:{x:infoX,y:headerHeight+room*(compactWide?.5:.48),width:Math.min(width*(compactWide?.55:.48),slotsWidth+40*contentScale),height:room*(compactWide?.95:.88)},
    art:{x:vertical?0:width*.05,y:artTop,width:vertical?width:width*(compactWide?.38:.53),height:artBottom-artTop},
    slots:CHARACTER_INDICES.map(index=>({x:infoX+(index-2)*(slotWidth+slotGap),y:slotsY,width:slotWidth,height:slotHeight})),
    buttonWidth:Math.min(280*contentScale,slotsWidth*.78),buttonHeight:Math.max(44,48*contentScale),
    feeY:vertical?height-(shortPortrait?68:86):compactWide?height-56:headerHeight+room*.71,
    enterY:vertical?height-(shortPortrait?30:37):compactWide?height-25:headerHeight+room*.82,
  }};
}
const CHARACTER_INDICES=[0,1,2,3,4];
