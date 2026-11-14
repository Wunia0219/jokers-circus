import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMusicContinuity} from '../scripts/qa/helpers/music-continuity.js';
const before={count:1,paused:false,pauses:1,positionWrites:0,empties:0,source:'/music.mp3',advances:20,time:59.9};
test('soundtrack progress accepts an observed natural loop across slow navigation',()=>{
  assert.doesNotThrow(()=>assertMusicContinuity(before,{...before,time:.2,advances:21}));
});
test('soundtrack continuity rejects frozen playback, seeks, reloads, replacements and pauses',()=>{
  for(const broken of [{advances:20},{positionWrites:1},{empties:1},{source:'/other.mp3'},{count:2},{paused:true},{pauses:2}])
    assert.throws(()=>assertMusicContinuity(before,{...before,time:.2,advances:21,...broken}));
});
