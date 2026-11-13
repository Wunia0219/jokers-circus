import {inflateSync} from 'node:zlib';
import {receiptFrame, receiptGlyphs, receiptLabels, receiptLayout} from './casino-receipt-art.js';
import {rgbPng} from './rgb-png.js';

export const RECEIPT_NAME = 'casino-receipt.png';
export const receiptColors = {gain: 0xf17b85, loss: 0x65be98, even: 0xba8d61};
const {width, height, numberTop, glyphHeight} = receiptLayout;
const stride = width * 3;
const ink = {gain: [255, 135, 146], loss: [122, 227, 169], even: [248, 232, 209]};
const format = new Intl.NumberFormat('en-US');
const glyphs = Object.fromEntries(Object.entries(receiptGlyphs).map(([char, [advance, encoded]]) =>
  [char, {advance, alpha: inflateSync(Buffer.from(encoded, 'base64'))}]));

function writeNumber(pixels, text, x, y, maxWidth, color) {
  const digits = Array.from(text, char => glyphs[char]);
  const naturalWidth = digits.reduce((total, glyph) => total + glyph.advance, 0);
  const scale = Math.min(1, maxWidth / naturalWidth);
  const scaledHeight = Math.ceil(glyphHeight * scale);
  const top = y + Math.floor((glyphHeight - scaledHeight) / 2);
  let advance = 0;
  for (const glyph of digits) {
    const left = Math.round(advance * scale);
    advance += glyph.advance;
    const right = Math.round(advance * scale);
    for (let dy = 0; dy < scaledHeight; dy++) {
      const sy = Math.floor(dy * glyphHeight / scaledHeight);
      for (let dx = left; dx < right; dx++) {
        const sx = Math.floor((dx - left) * glyph.advance / (right - left));
        const opacity = glyph.alpha[sy * glyph.advance + sx] / 255;
        if (opacity === 0) continue;
        const pos = (top + dy) * stride + (x + dx) * 3;
        for (let c = 0; c < 3; c++) pixels[pos + c] += Math.round((color[c] - pixels[pos + c]) * opacity);
      }
    }
  }
}

export function receiptSummary(net, rounds) {
  const tone = net > 0 ? 'gain' : net < 0 ? 'loss' : 'even';
  const amount = (net > 0 ? '+' : net < 0 ? '−' : '') + format.format(Math.abs(net));
  const games = format.format(rounds);
  return {tone, amount, games,
    description: `${receiptLabels.amount} ${amount} 戲籌 · ${receiptLabels.rounds} ${games} 局`,
  };
}

export {receiptLabels};

export function renderCasinoReceipt(net, rounds) {
  const {tone, amount, games} = receiptSummary(net, rounds);
  const pixels = inflateSync(Buffer.from(receiptFrame, 'base64'));
  writeNumber(pixels, amount, 55, numberTop, 372, ink[tone]);
  writeNumber(pixels, games, 480, numberTop, 143, ink.even);
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return rgbPng(width, height, rows);
}
