// Reference: src/style.css and src/ui/player/player-ui.css.
// The slot game's files and layout/timing are not modified by this renderer.
export const SLOT_UI = Object.freeze({
  font:['Noto Sans TC','sans-serif'],serif:['Georgia','serif'],
  gold:0xf5d28c,cream:0xfff0d5,muted:0xd0bcc0,line:0xe7be71,
  headerHeight:80,mobileHeaderHeight:132,utilitySize:48,
  playerNameSize:15,playerDetailSize:12,dialogTitleSize:19,bodySize:13,
  englishButtonSize:22,chineseButtonSize:12,deckWidth:974,deckHeight:140,mobileDeckHeight:246,
});

export function slotChrome(width,height,touch=false) {
  const narrow=width<=700;
  const headerHeight=narrow?(width<=360?140:SLOT_UI.mobileHeaderHeight):height<=500?72:SLOT_UI.headerHeight;
  const mobile=touch && narrow && height>width;
  // Slot desktopGameScale uses a 1160px composition around its 974px deck.
  const scale=mobile?1:Math.min(1,(width-16)/1160);
  const deckWidth=mobile?width-16:SLOT_UI.deckWidth*scale;
  const deckHeight=mobile?SLOT_UI.mobileDeckHeight:SLOT_UI.deckHeight*scale;
  return {width,height,narrow,headerHeight,mobile,deck:{x:(width-deckWidth)/2,y:height-deckHeight-8,width:deckWidth,height:deckHeight,scale},
    gameTop:headerHeight,gameBottom:height-deckHeight-8};
}
