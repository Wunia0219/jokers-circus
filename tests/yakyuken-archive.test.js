import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerArchive} from '../src/games/yakyuken/player-archive.js';
import {createChallenge,playChallengeRound} from '../src/games/yakyuken/challenge.js';

function storage(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i] ?? null,getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value),data};}
const fixtures=(store,playerId='A')=>{let n=0,clock=1700000000000;return new PlayerArchive({storage:store,playerId,id:()=>`match_${playerId}_${++n}`,clock:()=>clock++});};
const hand=(s,outcome)=>playChallengeRound(s,'rock',{getRandomValues:v=>{v[0]={win:0,loss:4000,draw:8000}[outcome];}});

test('archive keeps one record per match across draws, wins, losses, resize-style repeats and reload',()=>{
  const disk=storage(),archive=fixtures(disk),id=archive.begin('dealer');let state=createChallenge();
  assert.equal(archive.isUnlocked('dealer',0),true);assert.equal(archive.isUnlocked('dealer',1),false);
  for(const outcome of ['draw','loss','win','win']){
    state=hand(state,outcome);assert.equal(archive.update(id,state),outcome!=='draw');assert.equal(archive.update(id,state),false);
    assert.equal(archive.records().length,1);
  }
  archive.leave(id);const restored=fixtures(disk).records()[0];
  assert.deepEqual([restored.wins,restored.losses,restored.status],[2,1,'won']);assert.equal(Object.hasOwn(restored,'draws'),false);assert.equal(Object.hasOwn(restored,'rounds'),false);
  assert.equal(restored.reward,2500);
  assert.equal(fixtures(disk).isUnlocked('dealer',2),true);
  const losing=archive.begin('dealer');let loss=createChallenge();
  for(let i=0;i<2;i++){loss=hand(loss,'loss');archive.update(losing,loss);}
  assert.equal(archive.getRecord(losing).status,'lost');assert.equal(archive.getRecord(losing).reward,0);assert.equal(archive.records().length,2);
});

test('leaving saves partial results; watching a CG does not unlock later stages',()=>{
  const archive=fixtures(storage()),id=archive.begin('dealer');archive.update(id,hand(createChallenge(),'win'));archive.leave(id);
  assert.equal(archive.getRecord(id).status,'left');assert.equal(archive.getRecord(id).wins,1);
  assert.equal(archive.getRecord(id).reward,0);
  for(let i=0;i<4;i++)assert.equal(archive.isUnlocked('dealer',2),false);
  assert.equal(archive.isUnlocked('guest-1',0),false);
});

test('legacy match rewards remain readable; invalid prize amounts are rejected',()=>{
  const disk=storage(),archive=fixtures(disk),id=archive.begin('dealer');
  archive.update(id,hand(hand(createChallenge(),'win'),'win'));
  const key=archive.prefix+'match:'+id,legacy=JSON.parse(disk.getItem(key));delete legacy.reward;disk.setItem(key,JSON.stringify(legacy));
  assert.equal(fixtures(disk).getRecord(id).reward,2500);
  disk.setItem(key,JSON.stringify({...legacy,reward:50000}));assert.equal(fixtures(disk).getRecord(id),null);
});

test('different players are isolated; two stale tabs retain independent matches and monotonic CG unlocks',()=>{
  const disk=storage(),a=fixtures(disk,'A'),b=fixtures(disk,'B'),tab=fixtures(disk,'A');
  const first=a.begin('dealer');
  tab.id=()=> 'match_A_other';const second=tab.begin('dealer');
  let win=hand(hand(createChallenge(),'win'),'win');a.update(first,win);
  tab.update(second,hand(createChallenge(),'loss'));
  assert.equal(a.records().length,2);assert.equal(tab.isUnlocked('dealer',2),true);
  assert.equal(b.records().length,0);assert.equal(b.isUnlocked('dealer',0),false);
  b.begin('dealer');assert.equal(a.records().length,2);assert.equal(b.records().length,1);
});

test('blocked or full storage remains playable without hiding existing saved history',()=>{
  const disk=storage(),saved=fixtures(disk),old=saved.begin('dealer');saved.leave(old);
  const archive=fixtures(disk);archive.id=()=> 'match_A_fallback';
  disk.setItem=()=>{throw new Error('Quota exceeded');};const id=archive.begin('dealer');
  archive.update(id,hand(createChallenge(),'win'));
  assert.equal(archive.persistent,false);assert.equal(archive.records().length,2);
  assert.equal(archive.getRecord(id).wins,1);assert.equal(archive.isUnlocked('dealer',1),true);
  const blocked=new PlayerArchive({playerId:'blocked',storage:{getItem(){throw new Error('Blocked');},setItem(){throw new Error('Blocked');},get length(){throw new Error('Blocked');}},id:()=> 'match_blocked'});
  const entry=blocked.begin('dealer');blocked.leave(entry);assert.equal(blocked.records()[0].status,'left');
});

test('corrupt entries are ignored individually and earned CG unlocks repair malformed values',()=>{
  const disk=storage(),archive=fixtures(disk),id=archive.begin('dealer'),prefix=archive.prefix;
  disk.setItem(prefix+'match:broken_key','not json');disk.setItem(prefix+'match:forged_id',JSON.stringify({...archive.getRecord(id),id:'forged_id',wins:100}));
  disk.setItem(prefix+'cg:dealer:1','broken');assert.equal(archive.isUnlocked('dealer',1),false);
  archive.update(id,hand(createChallenge(),'win'));assert.equal(archive.records().length,1);assert.equal(archive.isUnlocked('dealer',1),true);
});
