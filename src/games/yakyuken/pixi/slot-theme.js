// Reference: src/style.css and src/ui/player/player-ui.css.
// The slot game's files and layout/timing are not modified by this renderer.
export const SLOT_UI = Object.freeze({
  font:['Noto Sans TC','sans-serif'],serif:['Georgia','serif'],
  gold:0xf5d28c,cream:0xfff0d5,muted:0xd0bcc0,line:0xe7be71,
  headerHeight:80,mobileHeaderHeight:132,utilitySize:48,
  playerNameSize:15,playerDetailSize:12,dialogTitleSize:19,bodySize:13,
  englishButtonSize:22,chineseButtonSize:12,
});
export const BALANCE_ROW_HEIGHT=40;

export function slotChrome(width,height,touch=false) {
  const narrow=width<=700;
  const headerHeight=narrow?(width<=360?140:SLOT_UI.mobileHeaderHeight):height<=500?72:SLOT_UI.headerHeight;
  const mobile=narrow && height>width;
  return {width,height,narrow,headerHeight,mobile,gameTop:headerHeight,gameBottom:height-12};
}
