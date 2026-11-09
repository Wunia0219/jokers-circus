import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('card flip asset is a short mono recording at a quiet level',()=>{
  const wav=readFileSync(new URL('../src/games/yakyuken/card-flip.wav',import.meta.url));
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt16LE(20),1);
  assert.equal(wav.readUInt16LE(22),1);
  assert.equal(wav.readUInt16LE(34),16);
  const data=wav.indexOf('data',36);
  assert.ok(data>=36);
  const bytes=wav.readUInt32LE(data+4);
  assert.equal(bytes/2/wav.readUInt32LE(24),.165);
  let peak=0;
  for(let offset=data+8;offset<data+8+bytes;offset+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(offset)));
  assert.ok(peak/32768>.025&&peak/32768<.12);
});
