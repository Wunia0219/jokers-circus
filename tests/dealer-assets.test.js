import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {dealerFrameSequence} from '../src/ui/dealer/dealer-motion.js';
import {ALL_CG} from '../src/games/yakyuken/cg-catalog.js';
import {webpSize} from './helpers/webp.js';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('images/dealer/v4/dealer.json',root),'utf8'));

test('shipping dealer atlas contains complete authored idle/win sequences and actual WebP files',()=>{
  assert.deepEqual(Object.keys(manifest.clips).sort(),['idle','win']);
  assert.deepEqual(manifest.frameSize,[576,832]);
  const region=manifest.runtimePacking?.region||{x:0,y:0,w:576,h:832};
  for(const [name,count] of [['idle',96],['win',108]]){
    const clip=manifest.clips[name],sequence=dealerFrameSequence(clip,manifest.fps);
    assert.equal(sequence.length,count);assert.equal(clip.frames,count);
    assert.ok(Math.abs(sequence.reduce((sum,frame)=>sum+frame.durationMs,0)-count/30*1000)<1e-6);
    for(const page of clip.pages){
      assert.match(page.file,/\.webp$/);
      const bytes=readFileSync(new URL('images/dealer/v4/'+page.file,root));
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
      assert.deepEqual(webpSize(new URL('images/dealer/v4/'+page.file,root)),[region.w*2,region.h*2]);
      assert.deepEqual(page.meta.size,{w:region.w*2,h:region.h*2});
      for(const {frame:f,sourceSize,spriteSourceSize} of Object.values(page.frames)){
        assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=page.meta.size.w&&f.y+f.h<=page.meta.size.h);
        assert.deepEqual(sourceSize,{w:576,h:832});
        assert.deepEqual(spriteSourceSize,region);
        assert.equal(f.w,region.w);assert.equal(f.h,region.h);
      }
    }
  }
});

const downloadPNGs=ALL_CG.map(art=>'public'+art.download);
const reviewPNGs=JSON.parse(readFileSync(new URL('art/launch-screen/review-sources.json',root),'utf8')).images;
const assertPNGInventory=files=>assert.deepEqual([...files].sort(),[...downloadPNGs,...reviewPNGs.map(r=>r.file)].sort());
test('PNG inventory allows catalogued CG downloads and recorded offline review originals with exact provenance',()=>{
  const files=[];
  function scan(path){for(const entry of readdirSync(path,{withFileTypes:true})){
    const file=join(path,entry.name);
    if(entry.isDirectory())scan(file);else if(/\.png$/i.test(entry.name))files.push(relative(fileURLToPath(root),file).replaceAll('\\','/'));
  }}
  for(const directory of ['images','art','public'])scan(fileURLToPath(new URL(directory,root)));
  assertPNGInventory(files);
  for(const record of reviewPNGs){
    assert.match(record.file,/^art\/launch-screen\/review-v\d+\/[\w-]+\.png$/);
    const bytes=readFileSync(new URL(record.file,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],record.dimensions);
  }
  for(const file of downloadPNGs){
    const png=readFileSync(new URL(file,root));assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(png.toString('ascii',12,16),'IHDR');assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1536);assert.equal(png[24],8);assert.equal(png[25],6,'full 8-bit RGBA');
    const data=[];for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);assert.ok(offset+length+12<=png.length);if(png.toString('ascii',offset+4,offset+8)==='IDAT')data.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
    const pixels=inflateSync(Buffer.concat(data));assert.equal(pixels.length,1536*(1024*4+1));
    let previous=Buffer.alloc(1024),minimum=255,maximum=0;
    for(let y=0;y<1536;y++){
      const row=Buffer.alloc(1024),offset=y*(1024*4+1),filter=pixels[offset];assert.ok(filter<=4);
      for(let x=0;x<1024;x++){
        const left=x?row[x-1]:0,up=previous[x],corner=x?previous[x-1]:0,p=left+up-corner;
        const paeth=Math.abs(p-left)<=Math.abs(p-up)&&Math.abs(p-left)<=Math.abs(p-corner)?left:Math.abs(p-up)<=Math.abs(p-corner)?up:corner;
        row[x]=(pixels[offset+1+x*4+3]+[0,left,up,Math.floor((left+up)/2),paeth][filter])&255;minimum=Math.min(minimum,row[x]);maximum=Math.max(maximum,row[x]);
      }previous=row;
    }
    assert.equal(minimum,0,'download retains fully transparent background pixels');assert.ok(maximum>127,'character is visible');
  }
});
test('CG download exception still rejects new runtime PNGs and missing originals',()=>{
  const expected=[...downloadPNGs,...reviewPNGs.map(r=>r.file)];
  assert.throws(()=>assertPNGInventory([...expected,'images/dealer/unexpected.png']));
  assert.throws(()=>assertPNGInventory([...expected,'public/downloads/yakyuken/extra.png']));
  assert.throws(()=>assertPNGInventory([...expected,'art/launch-screen/review-v99/unregistered.png']));
  assert.throws(()=>assertPNGInventory(expected.slice(1)));
  assert.throws(()=>assertPNGInventory(expected.slice(0,-1)));
});
