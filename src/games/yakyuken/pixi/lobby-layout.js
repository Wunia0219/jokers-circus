// All menu geometry is in CSS pixels, independent of the table's world scale.
export function lobbyLayout(width,height,headerHeight){
  const vertical=width<650 && height>width,room=height-headerHeight;
  const logoWidth=Math.min(vertical?250:360,width*.63,room*.65);
  const headingY=headerHeight+logoWidth*336/1064+38;
  const top=headingY+30,gap=vertical?12:24;
  const tileWidth=vertical?width-32:Math.min(500,(width-72)/2);
  const tileHeight=vertical?Math.min(230,(height-top-20-gap)/2):Math.min(380,height-top-24);
  const games=[0,1].map(index=>({width:tileWidth,height:tileHeight,x:vertical?width/2:width/2+(index?1:-1)*(tileWidth+gap)/2,y:top+tileHeight/2+(vertical?index*(tileHeight+gap):0)}));
  const infoX=vertical?width/2:width*.74,slotsWidth=vertical?width-24:Math.min(430,width*.46-36);
  const slotWidth=(slotsWidth-32)/5,slotHeight=vertical?68:Math.min(86,room*.22);
  const slotsY=vertical?height-153:headerHeight+room*.54;
  const artTop=headerHeight+(vertical?52:16),artBottom=vertical?slotsY-slotHeight/2-10:height-16;
  return {logoWidth,headingY,games,character:{
    infoX,headingY:vertical?headerHeight+24:headerHeight+room*.12,
    nameY:vertical?artBottom-18:headerHeight+room*.27,
    descriptionY:headerHeight+room*.36,
    art:{x:vertical?0:width*.05,y:artTop,width:vertical?width:width*.53,height:artBottom-artTop},
    slots:CHARACTER_INDICES.map(index=>({x:infoX+(index-2)*(slotWidth+8),y:slotsY,width:slotWidth,height:slotHeight})),
    feeY:vertical?height-86:headerHeight+room*.71,enterY:vertical?height-37:headerHeight+room*.82,
  }};
}
const CHARACTER_INDICES=[0,1,2,3,4];
