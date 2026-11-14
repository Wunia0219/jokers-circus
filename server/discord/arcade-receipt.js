import {inflateSync} from 'node:zlib';
import {rgbPng} from './rgb-png.js';
import {exitFrames,exitGlyphs} from './casino-exit-art.js';

export const ARCADE_RECEIPT_NAME='casino-arcade-receipt.png';
const signed=n=>(n>0?'+':n<0?'−':'')+Math.abs(n).toLocaleString('en-US');
const tone=n=>n>0?'gain':n<0?'loss':'even';
const colors={gain:[255,157,164],loss:[155,223,192],even:[246,222,177],count:[225,205,188]};
export function arcadeReceiptSummary({slot,duel}){
  for(const n of [slot.rounds,slot.net,duel.entries,duel.clears,duel.net])if(!Number.isSafeInteger(n))throw new Error('Invalid arcade receipt');
  if(slot.rounds<0||duel.entries<0||duel.clears<0)throw new Error('Invalid arcade receipt counts');
  const rows=[];
  if(slot.rounds)rows.push({name:'老虎機',count:`${slot.rounds.toLocaleString('en-US')} 局`,net:slot.net});
  if(duel.entries||duel.clears)rows.push({name:'野球拳',count:`入場 ${duel.entries.toLocaleString('en-US')} 場 · 通關 ${duel.clears.toLocaleString('en-US')} 場`,net:duel.net});
  const net=slot.net+duel.net;if(!Number.isSafeInteger(net))throw new Error('Invalid arcade total');
  const key=rows.length===2?'exit-mixed':slot.rounds?'exit-slot':'exit-duel';
  return {key,rows,net,tone:tone(net),amount:signed(net),description:[`本次戲籌變化 ${signed(net)} 戲籌`,...rows.map(r=>`${r.name} ${r.count}：${signed(r.net)} 戲籌`)].join('；')};
}
export function renderArcadeReceipt(receipt){
  const summary=arcadeReceiptSummary(receipt),frame=exitFrames[summary.key];
  const pixels=inflateSync(Buffer.from(frame.rgb,'base64')),{width,height}=frame;
  const write=(field,text,color)=>{
    const glyphs=exitGlyphs[field.font],letters=Array.from(text,c=>glyphs[c]);
    if(letters.some(c=>!c))throw new Error('Unsupported receipt glyph');
    const natural=letters.reduce((n,c)=>n+c.advance,0),scale=Math.min(1,field.width/natural,field.height/field.fontHeight);
    let x=field.right?field.x+field.width-natural*scale:field.x;
    for(const glyph of letters){
      const alpha=inflateSync(Buffer.from(glyph.alpha,'base64')),w=Math.max(1,Math.round(glyph.width*scale)),h=Math.max(1,Math.round(glyph.height*scale));
      for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){
        const px=Math.round(x)+dx,py=Math.round(field.y)+dy;if(px<0||px>=width||py<0||py>=height)continue;
        const a=alpha[Math.min(glyph.height-1,Math.floor(dy/scale))*glyph.width+Math.min(glyph.width-1,Math.floor(dx/scale))]/255,p=(py*width+px)*3;
        for(let c=0;c<3;c++)pixels[p+c]+=Math.round((color[c]-pixels[p+c])*a);
      }
      x+=glyph.advance*scale;
    }
  };
  write(frame.fields.total,summary.amount,colors[summary.tone]);
  summary.rows.forEach((row,i)=>{write(frame.fields.rows[i].count,row.count,colors.count);write(frame.fields.rows[i].amount,signed(row.net),colors[tone(row.net)]);});
  const scan=Buffer.alloc((width*3+1)*height);
  for(let y=0;y<height;y++)pixels.copy(scan,y*(width*3+1)+1,y*width*3,(y+1)*width*3);
  return rgbPng(width,height,scan);
}
