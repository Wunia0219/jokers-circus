import test from 'node:test';
import assert from 'node:assert/strict';
import {CG_ORIGIN,DEALER_CG,cgFromLocation} from '../src/games/yakyuken/cg-catalog.js';

test('public CG links distinguish all three artworks without player or hosting account identifiers',()=>{
  assert.equal(new URL(CG_ORIGIN).hostname,'jokers-circus-gallery.pages.dev');
  assert.equal(new Set(DEALER_CG.map(art=>art.path)).size,3);
  for(const art of DEALER_CG){
    const url=new URL(art.path,CG_ORIGIN);
    assert.equal(url.search,'');assert.equal(url.hash,'');
    assert.equal(cgFromLocation(url),art);
    assert.equal(cgFromLocation({pathname:art.path+'/'}),art);
    assert.equal(cgFromLocation({pathname:'/cg-download.html',search:`?stage=${art.index}`}),art);
  }
  for(const pathname of ['/cg/yakyuken/unknown/first-win','/cg/yakyuken/dealer/unknown','/','/cg/yakyuken/dealer/../../first-win'])assert.equal(cgFromLocation({pathname}),null);
  for(const stage of ['','-1','3','1.5','01','first-win'])assert.equal(cgFromLocation({pathname:'/cg-download.html',search:`?stage=${stage}`}),null);
});
