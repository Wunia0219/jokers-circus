import test from 'node:test';
import assert from 'node:assert/strict';
import {earnedPose,resultDialogue,wardrobeFrame,WARDROBE_DURATION} from '../src/games/yakyuken/duel-presentation.js';

test('winning hands advance to the next existing artwork, capped at the final pose',()=>{
  assert.deepEqual([0,1,2,3,9].map(wins=>earnedPose(wins,3)),[0,1,2,2,2]);
});

test('dialogue covers each outcome and respects terminal wins/losses without rerolling on resize',()=>{
  for(const outcome of ['win','loss','draw']){
    const lines=[1,2,3].map(round=>resultDialogue({outcome,round,status:'playing'}));
    assert.equal(new Set(lines).size,3);
    for(const [index,line] of lines.entries()){
      assert.equal(line,resultDialogue({outcome,round:index+1,status:'playing'}));assert.match(line,/[。？]$/);
    }
  }
  assert.match(resultDialogue({outcome:'win',round:2,status:'won'}),/你贏了/);
  assert.match(resultDialogue({outcome:'loss',round:2,status:'lost'}),/下次/);
  assert.throws(()=>resultDialogue({outcome:'invalid',round:1}));
});

test('wardrobe presents only the new outfit and commits when its fade-in completes',()=>{
  const start=wardrobeFrame(0),middle=wardrobeFrame(400),end=wardrobeFrame(WARDROBE_DURATION);
  assert.equal(start.focus,0);assert.equal(start.newAlpha,0);assert.equal(start.committed,false);
  assert.equal(Object.hasOwn(middle,'oldAlpha'),false);assert.ok(middle.newAlpha>0 && middle.newAlpha<1);
  assert.equal(middle.focus,1);assert.equal(middle.committed,false);
  assert.equal(wardrobeFrame(640).committed,true);
  assert.equal(end.focus,0);assert.equal(end.newAlpha,1);assert.equal(end.complete,true);
  assert.equal(wardrobeFrame(10000).complete,true,'a late frame still completes the presentation');
});
