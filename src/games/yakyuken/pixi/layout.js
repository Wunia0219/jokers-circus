// All positions are in a single logical coordinate system, then scaled uniformly.
export function tableLayout(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('Viewport must have a positive size');
  const portrait = width / height < 1.05;
  const w = portrait ? 760 : 1600, h = w * height / width;
  const short = !portrait && h < 780;
  const compactPortrait = portrait && h < 1250;
  const top = Math.max(portrait ? 124 : 84,62/(width/w));
  const farEdge = h * (portrait ? .435 : short ? .4 : .465);
  const cardScale = portrait ? (compactPortrait ? .74 : 1) : short ? .68 : .9;
  const dealerScale = portrait ? (compactPortrait ? .5 : .7) : short ? .5 : .65;
  const dealerY = h * (portrait ? (compactPortrait ? .52 : .535) : short ? .49 : .55);
  const playerY = Math.min(h*.77,h-(portrait?210:118)-214*.84*cardScale/2-18);
  return {
    w,h,portrait,scale:width / w,top,
    dealer:{x:w / 2,y:top + (portrait ? 8 : 2),height:farEdge * 2.2},
    table:{x:w / 2,y:h * 1.05,rx:w * (portrait ? 1.17 : .76),ry:h * 1.05 - farEdge},
    dealerCards:{x:w / 2,y:dealerY,gap:portrait ? 132 : 142,scale:dealerScale},
    playerCards:{x:w / 2,y:playerY,gap:portrait ? 188 : 210,scale:cardScale},
    playZone:{x:w / 2,y:h * (portrait ? .67 : .69)},
    statusY:(dealerY+214*.84*dealerScale/2+playerY-214*.84*cardScale/2)/2,
    actionY:h - (portrait ? 118 : 72),
    cardWidth:156,cardHeight:214,
  };
}

export const TABLE_MOVES = Object.freeze(['rock','scissors','paper']);
export const TABLE_MOVE_NAMES = Object.freeze({rock:'拳頭',scissors:'剪刀',paper:'布'});
