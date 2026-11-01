import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS} from '../src/games/yakyuken/characters.js';
import {challengeOdds, MOVES, randomMove, roundOutcome} from '../src/games/yakyuken/rules.js';
import {beginChallenge, freshPreview, playRound, PREVIEW_STORAGE_KEY, restorePreview} from '../src/games/yakyuken/state.js';
import {PreviewController} from '../src/games/yakyuken/controller.js';

test('yakyuken: all nine RPS outcomes, with inverse and invalid moves', () => {
  const expected = [['draw','loss','win'],['win','draw','loss'],['loss','win','draw']];
  MOVES.forEach((player,i) => MOVES.forEach((dealer,j) => assert.equal(roundOutcome(player,dealer),expected[i][j])));
  assert.throws(() => roundOutcome('invalid','rock'));
});

test('yakyuken: charge once, draw free, cumulative wins survive a loss and pay once', () => {
  let state = beginChallenge(freshPreview());
  assert.equal(state.balance,9000);
  assert.throws(() => beginChallenge(state));
  state = playRound(state,'paper','paper');
  assert.deepEqual([state.session.wins,state.session.losses,state.session.draws,state.balance],[0,0,1,9000]);
  state = playRound(state,'paper','rock');
  state = playRound(state,'rock','paper');
  assert.deepEqual([state.session.wins,state.session.losses,state.session.status],[1,1,'playing']);
  state = playRound(state,'scissors','paper');
  assert.equal(state.session.status,'won');
  assert.equal(state.balance,11000);
  assert.throws(() => playRound(state,'paper','rock'));
  const restored = restorePreview(JSON.stringify(state));
  assert.equal(restored.balance,11000);
  assert.throws(() => playRound(restored,'paper','rock'));
});

test('yakyuken: second defeat ends challenge without reward, no insufficient-funds entry', () => {
  let state = beginChallenge(freshPreview());
  state = playRound(playRound(state,'rock','paper'),'rock','paper');
  assert.equal(state.session.status,'lost'); assert.equal(state.balance,9000);
  assert.throws(() => playRound(state,'rock','paper'));
  assert.equal(beginChallenge(state).balance,8000);
  assert.throws(() => beginChallenge({...freshPreview(),balance:999}));
  assert.throws(() => beginChallenge(freshPreview(),'guest-1'));
});

test('yakyuken: exact odds match independent exhaustive decisive sequences for all five characters', () => {
  function enumerate(wins,losses) {
    if (wins === 0) return {clear:1,decisive:0};
    if (losses === 0) return {clear:0,decisive:0};
    const a = enumerate(wins-1,losses), b = enumerate(wins,losses-1);
    return {clear:(a.clear+b.clear)/2,decisive:1+(a.decisive+b.decisive)/2};
  }
  for (const {winsRequired} of CHARACTERS) for (const lossLimit of [1,2,3,4]) {
    const actual = challengeOdds(winsRequired,lossLimit), expected = enumerate(winsRequired,lossLimit);
    assert.equal(actual.clear,expected.clear);
    assert.equal(actual.throws,expected.decisive*1.5);
  }
  assert.deepEqual(challengeOdds(2,2),{clear:.5,throws:3.75});
  assert.equal(challengeOdds(3,2).clear,.3125);
  assert.equal(challengeOdds(5,2).clear,.109375);
  assert.equal(challengeOdds(7,2).clear,.03515625);
  assert.equal(challengeOdds(9,2).clear,.0107421875);
  for (const args of [[0,2],[2,0],[2.5,2],[2,Infinity]]) assert.throws(() => challengeOdds(...args));
});

test('yakyuken: unbiased random selection rejects overflow before selecting a move', () => {
  const sequence = [4294967295,2]; let calls = 0;
  assert.equal(randomMove({getRandomValues:values => {values[0] = sequence[calls++];}}),'scissors');
  assert.equal(calls,2);
});

test('yakyuken: malformed or impossible preview storage resets safely', () => {
  for (const serialized of ['garbage','null','{}',JSON.stringify({...freshPreview(),balance:-1}),JSON.stringify({...beginChallenge(freshPreview()),session:{characterId:'dealer',wins:2,losses:2,draws:0,rounds:4,status:'won',last:null}})]) {
    assert.deepEqual(restorePreview(serialized),freshPreview());
  }
  const state = playRound(beginChallenge(freshPreview()),'rock','rock');
  assert.deepEqual(restorePreview(JSON.stringify(state)),state);
});

test('yakyuken: opponent chosen before input, double clicks ignored and reload during reveal cannot double-pay', async () => {
  let saved, release, choices = 0;
  const storage = {getItem:() => saved,setItem:(key,value) => {assert.equal(key,PREVIEW_STORAGE_KEY);saved=value;}};
  const view = {render(){},setBusy(){},presentRound:() => new Promise(resolve => {release=resolve;})};
  const controller = new PreviewController({view,storage,chooseMove:() => {choices++; return 'rock';}});
  controller.start(); assert.equal(choices,1);
  const first = controller.play('paper');
  assert.equal(await controller.play('paper'),false);
  assert.equal(controller.state.session.wins,1); assert.equal(choices,1);
  release(); await first;
  assert.equal(choices,2);
  const second = controller.play('paper');
  assert.equal(JSON.parse(saved).balance,11000);
  const reloaded = new PreviewController({view:{render(){}},storage,chooseMove:() => {throw new Error('Terminal must not redraw');}});
  assert.equal(reloaded.state.balance,11000); assert.equal(await reloaded.play('paper'),false);
  release(); await second; assert.equal(controller.state.balance,11000);
});

test('yakyuken: presentation failure cannot reverse settlement, storage failure remains playable', async () => {
  const view = {render(){},setBusy(){},async presentRound(){throw new Error('Visual failed');}};
  const controller = new PreviewController({view,storage:{getItem(){throw new Error('Blocked');},setItem(){throw new Error('Blocked');}},chooseMove:() => 'rock'});
  assert.equal(controller.storageUnavailable,true); controller.start();
  await assert.rejects(controller.play('paper'),/Visual failed/);
  assert.equal(controller.state.session.wins,1); assert.equal(controller.busy,false);
  await assert.rejects(controller.play('paper'),/Visual failed/);
  assert.equal(controller.state.balance,11000);
  controller.destroy(); assert.equal(controller.start(),false);
});

test('yakyuken: leaving during reveal cancels once without redrawing or rendering after disposal', async () => {
  let renders = 0, destroys = 0, draws = 0;
  const view = {
    render(){renders++;},setBusy(){},destroy(){destroys++;},
    presentRound:(_before,_after,signal) => new Promise(resolve => signal.addEventListener('abort',resolve,{once:true})),
  };
  const controller = new PreviewController({view,chooseMove:() => {draws++;return 'rock';}});
  controller.start();
  const pending = controller.play('paper'), renderedBeforeDispose = renders;
  controller.destroy(); controller.destroy(); await pending;
  assert.equal(controller.state.session.wins,1);
  assert.equal(renders,renderedBeforeDispose);
  assert.equal(draws,1); assert.equal(destroys,1);
  assert.equal(await controller.play('paper'),false);
});
