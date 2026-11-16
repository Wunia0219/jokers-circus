import {shortWideHeader} from '../../../ui/pixi/slot-theme.js';

// CSS-pixel geometry matching ui/player/player-ui.css, including the 1440px cap.
export function slotHeaderLayout(width,height){
  if(shortWideHeader(width,height)){
    const left=8,barWidth=width-16,toolsWidth=251,toolsX=left+barWidth-toolsWidth;
    return {narrow:true,small:false,compact:true,left,barWidth,avatarSize:32,identityY:30,
      toolsX,toolsY:6,toolsWidth,toolsHeight:48,centers:[27,75,128,176,224].map(x=>toolsX+x),
      headerHeight:60,logoWidth:0,checkin:{x:toolsX-8-128,y:6,width:128,height:48}};
  }
  const narrow=width<=700,small=width<=360;
  const padding=narrow?(small?8:12):Math.min(28,Math.max(12,width*.02));
  const barWidth=Math.min(1440,width-padding*2),left=(width-barWidth)/2;
  const toolsWidth=narrow?barWidth:293,toolsX=narrow?left:left+barWidth-toolsWidth;
  const toolsY=narrow?(small?80:72):height<=500?8:12,toolsHeight=narrow?52:56;
  const centers=narrow?[toolsX+29,toolsX+85,toolsX+toolsWidth-141,toolsX+toolsWidth-85,toolsX+toolsWidth-29]:[30,86,151,207,263].map(x=>toolsX+x);
  const checkinWidth=narrow?(small?124:140):164;
  const checkinX=narrow?left+barWidth-checkinWidth:toolsX-12-checkinWidth;
  const avatarSize=narrow?(small?32:40):height<=500?36:48;
  const identityY=narrow?(small?40:36):height<=500?36:40;
  const headerHeight=narrow?(small?140:132):height<=500?72:80;
  return {narrow,small,left,barWidth,avatarSize,identityY,toolsX,toolsY,toolsWidth,toolsHeight,centers,headerHeight,logoWidth:0,
    checkin:{x:checkinX,y:narrow?(small?12:8):toolsY,width:checkinWidth,height:56}};
}

// Both games use the same geometry; Yakyuken deliberately omits the logo.
export const yakyukenHeaderLayout=slotHeaderLayout;
