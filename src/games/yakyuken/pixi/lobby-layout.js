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

// The lobby fills the stage independently of the in-game header.
export function gameLobbyLayout(width,height){
  const vertical=width<650 && height>width,compact=height<500,shortPortrait=vertical && height<650;
  const margin=vertical?16:compact?16:32,gap=vertical?12:24;
  const logoWidth=Math.min(vertical?360:440,width*(vertical?(shortPortrait ? .58 : .66):.34),height*(vertical ? .42 : .55));
  const logoHeight=logoWidth*336/1064,headingSize=shortPortrait?20:vertical||compact?22:28;
  const headingGap=compact?10:shortPortrait?12:18,subtitleHeight=compact||shortPortrait?16:20;
  const topBlock=logoHeight+headingGap+headingSize+8+subtitleHeight+(compact||shortPortrait?16:24);
  const footer=shortPortrait?24:compact?26:36;
  const available=height-2*margin-topBlock-footer;
  const heightBudget=vertical?Math.min(254,(available-gap)/2):Math.min(390,available);
  const desiredWidth=vertical?Math.min(480,width-32):Math.min(540,(width-2*margin-gap)/2);
  const tileWidth=Math.min(desiredWidth,heightBudget*1.5),tileHeight=tileWidth/1.5;
  const groupHeight=topBlock+(vertical?tileHeight*2+gap:tileHeight)+footer;
  const logoY=(height-groupHeight)/2,headingY=logoY+logoHeight+headingGap+headingSize/2;
  const subtitleY=headingY+headingSize/2+8+subtitleHeight/2,top=logoY+topBlock;
  const games=[0,1].map(index=>({width:tileWidth,height:tileHeight,x:vertical?width/2:width/2+(index?1:-1)*(tileWidth+gap)/2,y:top+tileHeight/2+(vertical?index*(tileHeight+gap):0)}));
  return {logoWidth,logoY,headingY,headingSize,subtitleY,games,footerY:top+(vertical?tileHeight*2+gap:tileHeight)+footer*.66};
}
