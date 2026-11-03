// All menu geometry is in CSS pixels, independent of the table's world scale.
export function lobbyLayout(width,height,headerHeight){
  const vertical=width<650 && height>width,room=height-headerHeight;
  const lobby=gameLobbyLayout(width,height);
  const infoX=vertical?width/2:width*.74,slotsWidth=vertical?width-24:Math.min(430,width*.46-36);
  const slotWidth=(slotsWidth-32)/5,slotHeight=vertical?68:Math.min(86,room*.22);
  const slotsY=vertical?height-153:headerHeight+room*.54;
  const artTop=headerHeight+(vertical?52:16),artBottom=vertical?slotsY-slotHeight/2-10:height-16;
  return {...lobby,character:{
    infoX,headingY:vertical?headerHeight+24:headerHeight+room*.12,
    nameY:vertical?artBottom-18:headerHeight+room*.27,
    descriptionY:headerHeight+room*.36,
    art:{x:vertical?0:width*.05,y:artTop,width:vertical?width:width*.53,height:artBottom-artTop},
    slots:CHARACTER_INDICES.map(index=>({x:infoX+(index-2)*(slotWidth+8),y:slotsY,width:slotWidth,height:slotHeight})),
    feeY:vertical?height-86:headerHeight+room*.71,enterY:vertical?height-37:headerHeight+room*.82,
  }};
}
const CHARACTER_INDICES=[0,1,2,3,4];

// The lobby fills the stage independently of the in-game header.
export function gameLobbyLayout(width,height){
  const vertical=width<650 && height>width,compact=height<500;
  const margin=vertical?16:compact?16:32,gap=vertical?12:24;
  const logoWidth=Math.min(vertical?360:440,width*(vertical ? .66 : .34),height*(vertical ? .42 : .55));
  const logoHeight=logoWidth*336/1064,headingSize=vertical?22:compact?22:28;
  const topBlock=logoHeight+(compact?10:18)+headingSize+8+(compact?16:20)+(compact?16:24);
  const footer=compact?26:36;
  const available=height-2*margin-topBlock-footer;
  const tileHeight=vertical?Math.min(254,(available-gap)/2):Math.min(390,available);
  const tileWidth=vertical?Math.min(480,width-32):Math.min(500,(width-2*margin-gap)/2);
  const groupHeight=topBlock+(vertical?tileHeight*2+gap:tileHeight)+footer;
  const logoY=(height-groupHeight)/2,headingY=logoY+logoHeight+(compact?10:18)+headingSize/2;
  const subtitleY=headingY+headingSize/2+8+(compact?8:10),top=logoY+topBlock;
  const games=[0,1].map(index=>({width:tileWidth,height:tileHeight,x:vertical?width/2:width/2+(index?1:-1)*(tileWidth+gap)/2,y:top+tileHeight/2+(vertical?index*(tileHeight+gap):0)}));
  return {logoWidth,logoY,headingY,headingSize,subtitleY,games,footerY:top+(vertical?tileHeight*2+gap:tileHeight)+footer*.66};
}
