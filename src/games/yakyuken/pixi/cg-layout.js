import {PROGRAMME,programmeFrame} from '../../../ui/shared/dialog-spec.js';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

// Capacity and card size depend only on the usable viewport, never the character.
export function cgGridLayout(width,height,viewportWidth=width,viewportHeight=height,scrollbar=0){
  const frame=programmeFrame(width,height,viewportWidth,viewportHeight);
  const panelWidth=frame.width,panelHeight=frame.height;
  const compact=height<=500,mini=height<=360||panelWidth<490&&height<440,stackedLogo=frame.mobile&&!compact,inlineFooter=panelWidth>=490;
  const inset=PROGRAMME.border+(frame.mobile?PROGRAMME.smallTabInset:PROGRAMME.tabInset),gap=PROGRAMME.tabGap,contentWidth=panelWidth-2*inset-scrollbar;
  const logoWidth=mini?Math.min(110,panelWidth*.38):stackedLogo?Math.min(PROGRAMME.smallLogo,(panelWidth-scrollbar-2*(PROGRAMME.border+PROGRAMME.smallMastheadInset))*.8):compact&&frame.mobile?Math.min(144,panelWidth*.44):frame.short?PROGRAMME.shortLogo:PROGRAMME.logo;
  const logoHeight=logoWidth*336/1064,mastheadTop=frame.header+PROGRAMME.border;
  const mastheadPad=mini?5:stackedLogo?PROGRAMME.smallMastheadPad:compact?PROGRAMME.shortMastheadPad:PROGRAMME.mastheadPad;
  const mastheadHeight=2*mastheadPad+logoHeight+(stackedLogo?34:0);
  const tabsTop=mastheadTop+mastheadHeight;
  const columns=compact?clamp(Math.floor((contentWidth+gap)/125),2,6):panelWidth<560?2:panelWidth<790?3:4;
  const cardWidth=Math.min(180,Math.floor((contentWidth-(columns-1)*gap)/columns));
  const gridTop=tabsTop+PROGRAMME.tab+PROGRAMME.tabPad*(mini?1:2)+(mini?4:6),footerHeight=mini?2:inlineFooter?48:92;
  const pagerY=panelHeight-footerHeight-24,gridHeight=pagerY-26-gridTop;
  const rows=compact?1:clamp(Math.floor((gridHeight+gap)/(panelWidth<560?126:176)),1,panelWidth<560?3:2);
  const cardHeight=Math.min(256,Math.round(cardWidth*1.42),Math.floor((gridHeight-(rows-1)*gap)/rows));
  return {frame,panelWidth,panelHeight,mini,inlineFooter,scrollbar,gap,contentWidth,columns,cardWidth,cardHeight,gridTop,pagerY,capacity:columns*rows,
    mastheadTop,mastheadHeight,mastheadPad,logoWidth,logoHeight,stackedLogo,tabsTop};
}

export function cgGridPage(grid,count,anchor){
  const pages=Math.ceil(count/grid.capacity),page=Math.min(pages-1,Math.floor(anchor/grid.capacity)),first=page*grid.capacity;
  return {...grid,pages,page,first};
}

export function cgViewerLayout(width,height){
  const wide=width>=560&&width/height>=1.22;
  const gutter=width<450?10:16;
  const controlGap=width<450?16:22,downloadWidth=width<380?108:132;
  const closeX=width-gutter-22,downloadLeft=closeX-22-controlGap-downloadWidth;
  return {wide,gutter,barHeight:54,controlY:27,downloadWidth,closeX,downloadLeft,
    art:{x:wide?62:gutter,y:56,width:width-2*(wide?62:gutter),height:height-56-(wide?8:62)}};
}
