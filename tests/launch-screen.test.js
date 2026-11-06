import test from 'node:test';
import assert from 'node:assert/strict';
import {LAUNCH_ART,chooseLaunchArt} from '../src/platform/launch-art.js';
import {reportLobbyBoot,LOBBY_READY_EVENT,LOBBY_FAILED_EVENT} from '../src/platform/launch-protocol.js';

test('a launch selects exactly one approved artwork across all three random intervals',()=>{
  assert.deepEqual(LAUNCH_ART.map(a=>a.id),['golden-salon','last-spin','curtain-rises']);
  for(const [value,index] of [[0,0],[.333,0],[1/3,1],[.666,1],[2/3,2],[.999999,2],[1,2],[-1,0],[NaN,0]]){
    let calls=0;assert.equal(chooseLaunchArt(()=>{calls++;return value;}),LAUNCH_ART[index]);assert.equal(calls,1);
  }
});

test('lobby readiness reports no private data and stays inside its same-origin outer host',()=>{
  const oldWindow=globalThis.window,oldLocation=globalThis.location,events=[];
  const parent={location:{origin:'https://test.invalid'},postMessage:(data,origin)=>events.push({data,origin})};
  globalThis.window={parent};globalThis.location={origin:'https://test.invalid'};
  try{
    reportLobbyBoot(true);reportLobbyBoot(false);
    assert.deepEqual(events,[{data:{type:LOBBY_READY_EVENT},origin:'https://test.invalid'},{data:{type:LOBBY_FAILED_EVENT},origin:'https://test.invalid'}]);
    parent.location.origin='https://discord.com';reportLobbyBoot(true);assert.equal(events.length,2);
    globalThis.window.parent=globalThis.window;reportLobbyBoot(true);assert.equal(events.length,2);
  }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;}
});
