import test from 'node:test';
import assert from 'node:assert/strict';
import {DIFFICULTIES,createChallenge,difficultyOdds,difficultyRule,playChallengeRound,weightedDuel} from '../src/games/yakyuken/challenge.js';
import {MOVES,roundOutcome} from '../src/games/yakyuken/rules.js';

const source=value=>({getRandomValues:values=>{values[0]=value;}});
const hand=(state,outcome)=>playChallengeRound(state,'rock',source({win:0,loss:4000,draw:8000}[outcome]));

test('challenge: all five table rows and every one of the 10,000 weights match for every player hand',()=>{
  const expected=[[2500,2,2,3189,4811,.35,.125],[5000,3,2,3135,4865,.17,.15],[10000,5,3,3057,4943,.08,.2],[25000,7,3,3299,4701,.03,.25],[50000,9,4,3022,4978,.01,.5]];
  for(const [index,rule] of DIFFICULTIES.entries()){
    assert.deepEqual([rule.reward,rule.winsRequired,rule.lossLimit,rule.winWeight,rule.lossWeight,rule.clearRate,rule.recoveryRate],expected[index]);
    assert.equal(rule.drawWeight,2000);
    for(const player of MOVES){
      const counts={win:0,loss:0,draw:0};
      for(let weight=0;weight<10000;weight++){
        const duel=weightedDuel(rule.id,player,source(weight));counts[duel.outcome]++;
        assert.equal(roundOutcome(player,duel.dealer),duel.outcome);
      }
      assert.deepEqual(counts,{win:rule.winWeight,loss:rule.lossWeight,draw:2000});
    }
  }
});

test('challenge: free draws and losses preserve wins; each exact win/loss threshold ends only once',()=>{
  for(const rule of DIFFICULTIES){
    let state=hand(createChallenge(rule.id),'win');
    state=hand(hand(state,'loss'),'draw');
    assert.deepEqual([state.wins,state.losses,state.draws,state.rounds,state.status,state.reward],[1,1,1,3,'playing',0]);
    for(let wins=1;wins<rule.winsRequired;wins++){
      const previous=state;state=hand(state,'win');
      assert.equal(previous.wins,wins,'state does not mutate');
      assert.equal(state.status,wins+1===rule.winsRequired?'won':'playing');
    }
    assert.equal(state.reward,rule.reward);
    assert.throws(()=>hand(state,'win'),/已結束/);
    let losing=createChallenge(rule.id);
    for(let losses=1;losses<=rule.lossLimit;losses++){
      losing=hand(losing,'loss');assert.equal(losing.status,losses===rule.lossLimit?'lost':'playing');
    }
    assert.equal(losing.reward,0);assert.throws(()=>hand(losing,'draw'),/已結束/);
    assert.deepEqual(Object.keys(state).sort(),['difficulty','wins','losses','draws','rounds','status','reward','last'].sort());
    assert.equal(createChallenge(rule.id).rounds,0);
  }
});

test('challenge: theoretical clear rates use an independent decisive-sequence enumeration',()=>{
  function enumerate(wins,losses,p){
    if(wins===0)return 1;if(losses===0)return 0;
    return p*enumerate(wins-1,losses,p)+(1-p)*enumerate(wins,losses-1,p);
  }
  for(const rule of DIFFICULTIES){
    const odds=difficultyOdds(rule.id),independent=enumerate(rule.winsRequired,rule.lossLimit,rule.winWeight/8000);
    assert.ok(Math.abs(odds.clear-independent)<1e-14);
    assert.ok(Math.abs(odds.clear-rule.clearRate)<.0001,'rounded table has less than 0.01 percentage point error');
    assert.ok(odds.throws>rule.lossLimit);
  }
});

test('challenge: entropy overflow is rejected; invalid difficulty/hand never consumes randomness',()=>{
  const sequence=[4294967295,4294960000,3189],random={getRandomValues:values=>{values[0]=sequence.shift();}};
  assert.equal(weightedDuel(1,'rock',random).outcome,'loss');assert.equal(sequence.length,0);
  const unused={getRandomValues:()=>assert.fail('invalid input must not draw')};
  for(const id of [0,6,'1',null,NaN]){
    assert.throws(()=>difficultyRule(id));assert.throws(()=>createChallenge(id));assert.throws(()=>weightedDuel(id,'rock',unused));
  }
  assert.throws(()=>weightedDuel(1,'invalid',unused));
});
