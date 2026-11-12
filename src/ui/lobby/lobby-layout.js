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
