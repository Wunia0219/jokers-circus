import test from 'node:test';
import assert from 'node:assert/strict';
import {RewardAudio} from '../src/games/yakyuken/reward-audio.js';
import {cueVoices} from '../src/ui/audio/audio-cues.js';

test('reward bells follow the visual count, skip late beats, and finish once',()=>{
  const events=[],sound={playVoices:voices=>events.push(voices),cancelCues:()=>events.push('stop'),win:kind=>events.push(kind)},r=new RewardAudio(sound);
  const award={id:'one',stage:'holding',elapsed:0};r.sync(award);r.sync({...award,stage:'showcase'});assert.equal(events.length,0);
  award.stage='counting';r.sync(award);assert.deepEqual(events[0],cueVoices('big').filter(v=>v.at===0));
  r.sync(award);assert.equal(events.length,1,'same frame never repeats a tone');
  award.elapsed=900;r.sync(award);assert.equal(events.length,2,'late frames emit only the current beat, not a burst of missed bells');
  assert.ok(events[1].every(v=>v.at===0));
  award.stage='settled';r.sync(award);r.sync(award);assert.deepEqual(events.slice(2),['stop','return']);
  r.sync({...award,stage:'idle'});assert.equal(events.length,4);
  r.sync({id:'two',stage:'settled',elapsed:0});assert.equal(events.at(-1),'return','reduced motion has just one completion chime');
});

test('silent frames advance reward sound so unmuting never replays the count',()=>{
  const heard=[],sound={enabled:false,playVoices(v){if(this.enabled)heard.push(v);},cancelCues(){},win(){}};
  const r=new RewardAudio(sound),award={id:'one',stage:'counting',elapsed:600};r.sync(award);sound.enabled=true;r.sync(award);assert.equal(heard.length,0);
  r.sync({...award,elapsed:700});assert.equal(heard.length,1);r.sync({...award,stage:'idle'});r.sync({...award,stage:'settled'});assert.equal(heard.length,1);
});
