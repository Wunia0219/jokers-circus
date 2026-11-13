import {inflateSync} from 'node:zlib';
import {frames, fontMasks} from './discord-win-card-art.js';
import {rgbPng} from './rgb-png.js';

const fonts = Object.fromEntries(Object.entries(fontMasks).map(([size, masks]) => [size,
  Object.fromEntries(Object.entries(masks).map(([char, [advance, data]]) => [char,
    {advance, alpha: inflateSync(Buffer.from(data, 'base64'))},
  ])),
]));

export const winCardFilename = tier => `${tier}-win.png`;

export function renderWinCard(tier, multiplier) {
  const {width, height, fontSize, x, top, maxWidth, color, rows} = frames[tier];
  const scanlines = inflateSync(Buffer.from(rows, 'base64'));
  const stride = width * 3 + 1;
  const glyphs = Array.from(multiplier, char => fonts[fontSize][char]);
  const naturalWidth = glyphs.reduce((sum, glyph) => sum + glyph.advance, 0);
  const scale = Math.min(1, maxWidth / naturalWidth);
  const glyphHeight = fontSize + 12;
  const scaledHeight = Math.ceil(glyphHeight * scale);
  // Scale unusually long multipliers to fit and keep the text baseline fixed.
  const y = top + fontSize - Math.ceil(fontSize * scale);
  let advance = 0;
  for (const glyph of glyphs) {
    const left = Math.round(advance * scale);
    advance += glyph.advance;
    const right = Math.round(advance * scale);
    for (let dy = 0; dy < scaledHeight; dy++) {
      const sy = Math.floor(dy * glyphHeight / scaledHeight);
      for (let dx = left; dx < right; dx++) {
        const sx = Math.floor((dx - left) * glyph.advance / (right - left));
        const opacity = glyph.alpha[sy * glyph.advance + sx] / 255;
        if (!opacity) continue;
        const pos = (y + dy) * stride + 1 + (x + dx) * 3;
        for (let c = 0; c < 3; c++) scanlines[pos + c] += Math.round((color[c] - scanlines[pos + c]) * opacity);
      }
    }
  }
  return rgbPng(width, height, scanlines);
}
