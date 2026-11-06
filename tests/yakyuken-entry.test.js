import test from 'node:test';
import assert from 'node:assert/strict';
import {entryLoadingLayout,waitForEntryTask} from '../src/games/yakyuken/pixi/entry-state.js';

test('Yakyuken entry loader fits progress and recovery controls in portrait, landscape and panel viewports',()=>{
  for(const [width,height] of [[320,568],[390,844],[844,390],[544,680],[768,1024],[1600,900]]){
    for(const error of [false,true]){
      const l=entryLoadingLayout(width,height,{error});
      assert.ok(l.logoY>=0 && l.logoY+l.logoHeight<=height,'complete logo remains inside the viewport');
      assert.ok(l.logoWidth<=width-48 && l.barWidth<=width-48);
      assert.ok(l.barY>=0 && l.barY+12<height);
      if(error){assert.ok(l.actionY+24<=height);assert.ok(l.actionWidth>=44 && 2*l.actionWidth+12<=width-48);}
      else assert.ok(l.messageY+12<=height);
    }
  }
});

test('Yakyuken entry waits for actual preparation and keeps failures available to retry',async()=>{
  const controller=new AbortController();let complete;
  const task=new Promise(resolve=>{complete=resolve;});let ready=false;
  const waiting=waitForEntryTask(task,controller.signal).then(value=>{ready=value;});
  await Promise.resolve();assert.equal(ready,false);
  complete();await waiting;assert.equal(ready,true);
  await assert.rejects(waitForEntryTask(Promise.reject(new Error('decode failed')),controller.signal),/decode failed/);
});

test('Yakyuken entry disposal releases an unresolved GPU upload and consumes late failures',async()=>{
  const controller=new AbortController();let reject;
  const task=new Promise((resolve,no)=>{reject=no;});
  const waiting=waitForEntryTask(task,controller.signal);controller.abort();
  assert.equal(await waiting,false);
  reject(new Error('late decode failure'));await Promise.resolve();
  assert.equal(await waitForEntryTask(Promise.reject(new Error('already disposed')),controller.signal),false);
});
