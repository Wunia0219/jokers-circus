// Render the approved Discord card art at 1000px, independent of the client's
// installed fonts. Uses the project Chromium and the Windows design fonts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {accessSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {deflateSync} from 'node:zlib';
import {clearPreviews, exitPreviews} from '../../server/discord/casino-preview-design.js';

const fonts = 'C:/Windows/Fonts';
const output = 'test-results/casino-preview-art';
mkdirSync(output, {recursive: true});

const diamond='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1 19 10 10 19 1 10Z" fill="none" stroke="currentColor"/><path d="m10 5 5 5-5 5-5-5Z" fill="currentColor"/></svg>';
const icons={
 slot:'<svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-linejoin="round"><rect x="4.5" y="7.5" width="19" height="13" rx="2"/><path d="M11 8v12m6-12v12m-9-8 2 2-2 2-2-2Zm6 0 2 2-2 2-2-2Zm6 0 2 2-2 2-2-2Z"/></svg>',
 duel:'<svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-linejoin="round"><path d="m12 7-5-2-5 14 7 3 1-3m6-12 5-2 5 14-7 3-1-3"/><rect x="10" y="5" width="8" height="17" rx="1.5"/><path d="m14 10 2.4 3.5L14 17l-2.4-3.5Z"/></svg>'
};
const ticketFrame='<svg class="ticket-frame" viewBox="0 0 500 235" preserveAspectRatio="none" aria-hidden="true"><path d="M28 13H472L487 28V207L472 222H28L13 207V28Z" fill="none" stroke="currentColor" stroke-width="1" opacity=".78"/><path d="M31 18H469L482 31V204L469 217H31L18 204V31Z" fill="none" stroke="currentColor" stroke-width=".65" opacity=".38"/><path d="m13 28 6 6 6-6-6-6Zm462 0 6 6 6-6-6-6ZM13 207l6 6 6-6-6-6Zm462 0 6 6 6-6-6-6Z" fill="currentColor" opacity=".9"/></svg>';
const receiptFrame='<svg class="receipt-frame" viewBox="0 0 500 244" preserveAspectRatio="none" aria-hidden="true"><path d="M30 12H470Q474 28 488 30V214Q474 216 470 232H30Q26 216 12 214V30Q26 28 30 12Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M34 17H466Q471 30 483 34V210Q471 214 466 227H34Q29 214 17 210V34Q29 30 34 17Z" fill="none" stroke="currentColor" stroke-width=".6" opacity=".43"/><path d="m24 24 4-4 4 4-4 4Zm444 0 4-4 4 4-4 4ZM24 220l4-4 4 4-4 4Zm444 0 4-4 4 4-4 4Z" fill="currentColor" opacity=".9"/></svg>';
const css=String.raw`
:root{color-scheme:dark;--sans:"Noto Sans TC","Microsoft JhengHei",sans-serif;--serif:"Noto Serif TC","PMingLiU",serif;--paper:#f2e6d6}
*{box-sizing:border-box}
.ticket,.receipt{position:relative;isolation:isolate;overflow:hidden;width:100%;container-type:inline-size;border-radius:3px}
.ticket{aspect-ratio:500/235;background:var(--base);color:var(--ink)}
.ticket-frame,.receipt-frame{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
.stage{position:absolute;inset:0;background:linear-gradient(90deg,#100e17f2 3%,transparent 83%),radial-gradient(ellipse at 72% 37%,var(--halo),transparent 66%),var(--base);overflow:hidden}
.stage::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(106deg,transparent 0 9px,#fbeacd21 10px,transparent 11px 18px);mask-image:linear-gradient(100deg,transparent 42%,#0009 100%);opacity:.37}
.stage::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#100c18a0,transparent 39%)}
.orb{position:absolute;left:56%;top:7%;width:43%;aspect-ratio:1;border-radius:50%;border:1px solid color-mix(in srgb,var(--ink) 38%,transparent);background:radial-gradient(circle at 37% 24%,#fff0bd4f,transparent 65%);box-shadow:0 0 0 5px #160f181e,0 0 0 6px color-mix(in srgb,var(--ink) 15%,transparent)}
.ray{position:absolute;inset:0;background:conic-gradient(from 124deg at 88% -4%,transparent 0deg,#ffe9b638 58deg,transparent 74deg,transparent 360deg);opacity:.63}
.orbit{position:absolute;inset:13% -9% -52% 46%;border:1px solid color-mix(in srgb,var(--ink) 28%,transparent);border-radius:50%;transform:rotate(-21deg)}
.roman{position:absolute;right:6%;top:9%;font:500 11cqw/1 Georgia,serif;color:var(--ink);opacity:.24}
.ticket-frame{z-index:1}.portrait{position:absolute;z-index:2;top:var(--top);left:var(--pos);width:70%;height:auto;max-width:none;mask-image:linear-gradient(180deg,#000 0 33%,#000e 39%,transparent 53%);filter:drop-shadow(0 2px 8px #0b0914bb)}
.ticket::after{content:"";position:absolute;z-index:2;inset:0;background:linear-gradient(90deg,#120e18d9,transparent 66%),linear-gradient(0deg,#120f1bc2,transparent 25%);pointer-events:none}
.ticket-copy{position:absolute;left:8%;top:16%;z-index:3}
.eyebrow{display:flex;align-items:center;gap:1.35cqw;font-size:3.2cqw;font-weight:640;letter-spacing:.095em;white-space:nowrap}
.eyebrow svg{width:2.45cqw;height:2.45cqw;flex:none}
.role-name{margin-top:3.2cqw;color:#fff0dc;font:750 9.3cqw/1.16 var(--serif);letter-spacing:.032em;text-shadow:0 2px 12px #150d1b9a;white-space:nowrap}
.track{width:26cqw;height:1px;margin:2.4cqw 0 1.25cqw;background:linear-gradient(90deg,var(--ink),transparent);opacity:.73}
.clear-wins{display:flex;align-items:baseline;gap:1.5cqw;color:#f6e7d5;font-size:3.05cqw}
.clear-wins b{font:500 6.3cqw/1 Georgia,serif;color:var(--ink)}
.edition{font:500 1.85cqw/1 Georgia,serif;color:var(--ink);letter-spacing:.17em;margin-top:2.7cqw;opacity:.88}
.receipt{aspect-ratio:500/244;color:#d7ad79;background:radial-gradient(ellipse at 4% 0%,#37232c 0%,transparent 67%),linear-gradient(120deg,#22191f,#18151d 80%)}
.receipt:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,#ddae7b29 0 1px,transparent 1px 8px);mask-image:radial-gradient(ellipse at center,transparent 63%,#000 116%);opacity:.39;pointer-events:none}
.receipt::after{content:"";position:absolute;inset:9% 6%;z-index:-1;opacity:.065;background:repeating-radial-gradient(ellipse at 88% 8%,transparent 0 7px,#ebbb81 8px,transparent 9px 12px);mask-image:linear-gradient(120deg,transparent 44%,black)}
.receipt-head{position:absolute;top:10%;left:8.5%;right:8.5%;display:flex;justify-content:space-between;align-items:center}
.receipt-head .eyebrow{font-size:3.65cqw;gap:1.25cqw;letter-spacing:.13em}
.receipt-brand{font:500 2.5cqw/1 Georgia,serif;letter-spacing:.105em}
.total{position:absolute;left:8.5%;right:8.5%;top:22%;display:flex;align-items:baseline;gap:1.25cqw;flex-wrap:wrap}
.total>div{width:100%;font-size:3.8cqw;color:#f2ddc4;line-height:1.2}
.total strong{font:500 10.8cqw/.98 Georgia,serif;font-variant-numeric:lining-nums tabular-nums;letter-spacing:-.018em}
.total span{color:#f2ddc4;font-size:3.45cqw;font-weight:540}
.gain>.total strong,.record.gain strong{color:#ff9da4}
.loss>.total strong,.record.loss strong{color:#9bdfc0}
.even>.total strong,.record.even strong{color:#f6deb1}
.items{position:absolute;top:57%;left:8.5%;right:8.5%;border-top:1px dashed #e1b17c84;display:grid;color:#f4e3d3}
.record{display:grid;align-items:center;grid-template-columns:5cqw auto minmax(0,1fr) auto;gap:1.55cqw;min-height:8.55cqw}
.record+.record{border-top:1px solid #dca7713f}
.record b{font-size:3.6cqw;font-weight:660;white-space:nowrap}
.game-icon{color:#e5bc8b;width:5cqw;display:grid;place-items:center}
.game-icon svg{display:block;width:5cqw;height:5cqw}
.count{color:#e1cdbc;font-size:3.15cqw;white-space:nowrap}
.record strong{font:500 4.95cqw/1 Georgia,serif;white-space:nowrap}
.single .items{top:61%}
.single .record{min-height:9.2cqw}
`;
const renderTicket = role => {
  const {portrait, ink, base, halo, pos, top, serial, name, wins} = role;
  const src = readFileSync(join('images/yakyuken', portrait, 'stage-0.webp')).toString('base64');
  return `<div class="ticket" style="--ink:${ink};--base:${base};--halo:${halo};--pos:${pos};--top:${top}">
    <div class="stage"><div class="orb"></div><div class="ray"></div><div class="orbit"></div></div>
    <span class="roman">${serial}</span><img class="portrait" src="data:image/webp;base64,${src}">${ticketFrame}
    <div class="ticket-copy"><div class="eyebrow">${diamond}<span>野球拳　／　通關留影</span></div>
    <div class="role-name">${name}</div><div class="track"></div><div class="clear-wins"><span>累積</span><b>${wins}</b><span>勝</span></div>
    <div class="edition">JOKER’S CIRCUS</div></div></div>`;
};
const renderReceipt = receipt => `<div class="receipt ${receipt.tone} ${receipt.rows.length === 1 ? 'single' : ''}">${receiptFrame}
  <div class="receipt-head"><div class="eyebrow">${diamond}<span>賭場離場收據</span></div><span class="receipt-brand">JOKER’S CIRCUS</span></div>
  <div class="total"><div>本次戲籌變化</div><strong>${receipt.net}</strong><span>戲籌</span></div>
  <div class="items">${receipt.rows.map(row => `<div class="record ${row.tone}"><span class="game-icon">${icons[row.icon]}</span><b>${row.name}</b><span class="count">${row.count}</span><strong>${row.amount}</strong></div>`).join('')}</div></div>`;

const verifyFonts = async page => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const {root} = await cdp.send('DOM.getDocument');
  for (const [selector, family] of [['.eyebrow span','Noto Sans TC'], ['.role-name','Noto Serif TC'], ['.clear-wins b, .total strong','Georgia']]) {
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
    if (!nodeId) continue;
    const {fonts} = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
    assert.ok(fonts.length && fonts.every(font => font.familyName === family), `Missing design font: ${family}`);
  }
  await cdp.detach();
};

for (const file of ['NotoSansTC-VF.ttf', 'NotoSerifTC-VF.ttf', 'georgia.ttf']) accessSync(join(fonts, file));
const browser = await chromium.launch({channel: 'chromium', args: ['--disable-gpu']});
try {
  const page = await browser.newPage({viewport: {width: 500, height: 250}, deviceScaleFactor: 2});
  const assets = {},exitFrames={},exitGlyphs={};
  for (const [previews, render] of [[clearPreviews, renderTicket], [exitPreviews, renderReceipt]]) {
    for (const preview of previews) {
      await page.setContent(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><style>${css}
        body{margin:0;font:15px/1.55 var(--sans);color:var(--paper)}
        </style>${render(preview)}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(img => img.decode()));
      });
      await verifyFonts(page);
      const png = join(output, preview.key + '.png');
      const webp = join(output, preview.key + '.webp');
      await page.locator('.ticket, .receipt').screenshot({path: png});
      // Lossless encodes the exact rendered glyphs and colors, with no runtime fonts.
      execFileSync(process.env.CASINO_PREVIEW_PYTHON || 'python', ['-c',
        'from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGB"); im.save(sys.argv[2], lossless=True, method=6); assert Image.open(sys.argv[2]).convert("RGB").tobytes()==im.tobytes()',
        png, webp], {stdio: 'inherit'});
      if(!preview.key.startsWith('exit-'))assets[preview.key] = readFileSync(webp).toString('base64');
      if(preview.key.startsWith('exit-')){
        await page.addStyleTag({content:'.total{top:20%}.total strong{width:68%;font-size:9.8cqw;line-height:1.1}.total span{position:absolute;right:0;bottom:10px}.record{grid-template-columns:5cqw 14cqw minmax(0,1fr) 24cqw}.record strong{text-align:right}.count{overflow:hidden}'});
        const info=await page.evaluate(()=>{
          const fields=[],measure=(selector,font,right=false)=>{
            const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);
            const value={x:Math.round(r.x*2),y:Math.round(r.y*2),width:Math.round(r.width*2),height:Math.round(r.height*2),font,right,fontHeight:Math.round(r.height*2)};
            fields.push({value,style:{size:parseFloat(s.fontSize)*2,family:s.fontFamily,weight:s.fontWeight}});el.style.visibility='hidden';return value;
          };
          const result={total:measure('.total strong','total'),rows:[...document.querySelectorAll('.record')].map((_,i)=>({count:measure(`.record:nth-child(${i+1}) .count`,'count'),amount:measure(`.record:nth-child(${i+1}) strong`,'amount',true)}))};
          const glyphs={};
          for(const {value,style} of fields){
            if(glyphs[value.font])continue;const chars=value.font==='count'?'0123456789, 局入場·通關':'0123456789,+−';
            glyphs[value.font]={};
            for(const char of chars){
              const canvas=document.createElement('canvas');let ctx=canvas.getContext('2d');const font=`${style.weight} ${style.size}px ${style.family}`;ctx.font=font;
              const metric=ctx.measureText(char),advance=metric.width,width=Math.ceil(Math.max(advance,metric.actualBoundingBoxRight))+2,height=value.height;
              canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');ctx.font=font;ctx.fillStyle='white';
              const baseline=(height-metric.fontBoundingBoxAscent-metric.fontBoundingBoxDescent)/2+metric.fontBoundingBoxAscent;
              ctx.fillText(char,0,baseline);const rgba=ctx.getImageData(0,0,width,height).data,alpha=[];
              for(let p=3;p<rgba.length;p+=4)alpha.push(rgba[p]);glyphs[value.font][char]={advance,width,height,alpha};
            }
          }
          return {fields:result,glyphs};
        });
        for(const [font,glyphs] of Object.entries(info.glyphs))exitGlyphs[font]=Object.fromEntries(Object.entries(glyphs).map(([char,g])=>[char,{...g,alpha:deflateSync(Buffer.from(g.alpha)).toString('base64')}]));
        const frame=join(output,preview.key+'-frame.png');await page.locator('.receipt').screenshot({path:frame});
        const pixels=JSON.parse(execFileSync(process.env.CASINO_PREVIEW_PYTHON||'python',['-c','from PIL import Image; import json,sys,zlib,base64; im=Image.open(sys.argv[1]).convert("RGB"); print(json.dumps(dict(width=im.width,height=im.height,rgb=base64.b64encode(zlib.compress(im.tobytes(),9)).decode())))',frame],{encoding:'utf8'}));
        exitFrames[preview.key]={...pixels,fields:info.fields};
      }
    }
  }
  writeFileSync('server/discord/casino-preview-art.js',
    '// Generated by scripts/assets/build-casino-preview-art.js. Lossless WebP.\nexport const previewArt = '+JSON.stringify(assets, null, 2)+';\n');
  writeFileSync('server/discord/casino-exit-art.js','// Generated by scripts/assets/build-casino-preview-art.js. Runtime receipt frames and glyph masks.\nexport const exitFrames='+JSON.stringify(exitFrames)+';\nexport const exitGlyphs='+JSON.stringify(exitGlyphs)+';\n');
} finally {
  await browser.close();
}
