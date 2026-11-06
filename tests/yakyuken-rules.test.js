import test from 'node:test';
import assert from 'node:assert/strict';
import {MOVES,roundOutcome} from '../src/games/yakyuken/rules.js';

test('all nine RPS outcomes and invalid moves',()=>{
  const expected=[['draw','loss','win'],['win','draw','loss'],['loss','win','draw']];
  MOVES.forEach((player,i)=>MOVES.forEach((dealer,j)=>assert.equal(roundOutcome(player,dealer),expected[i][j])));
  assert.throws(()=>roundOutcome('invalid','rock'));
  assert.throws(()=>roundOutcome('rock','invalid'));
});
