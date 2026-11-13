import {MOVES,roundOutcome} from './rules.js';

import {characterRule} from './characters.js';

// Per-throw basis-point weights belong to the selected character.
// Clear/recovery targets are rounded table values, never a second outcome draw.
export function createChallenge(characterId='dealer'){
  characterRule(characterId);
  return Object.freeze({characterId,wins:0,losses:0,draws:0,rounds:0,status:'playing',reward:0,last:null});
}

export function weightedDuel(characterId,player,cryptoSource=globalThis.crypto){
  characterRule(characterId);
  if(!MOVES.includes(player))throw new Error('不支援的出拳');
  return duelForOutcome(player,drawOutcome(characterId,cryptoSource));
}

function drawOutcome(characterId,cryptoSource,rule=characterRule(characterId)){
  const values=new Uint32Array(1),total=10000,ceiling=Math.floor(2**32/total)*total;
  do{cryptoSource.getRandomValues(values);}while(values[0]>=ceiling);
  const weight=values[0]%total;
  return weight<rule.winWeight?'win':weight<rule.winWeight+rule.lossWeight?'loss':'draw';
}

export function duelForOutcome(player,outcome){
  if(!MOVES.includes(player)||!['win','loss','draw'].includes(outcome))throw new Error('不支援的出拳結果');
  const dealer=MOVES.find(move=>roundOutcome(player,move)===outcome);
  return Object.freeze({player,dealer,outcome});
}

// Sample the same independent throws, in the same order, before play starts.
// There is no separate clear-rate draw, draw cap or progress-dependent weight.
export function createChallengePlan(characterId,cryptoSource=globalThis.crypto,rule=characterRule(characterId)){
  let state={characterId,wins:0,losses:0,status:'playing'};const outcomes=[];
  while(state.status==='playing'){
    const outcome=drawOutcome(characterId,cryptoSource,rule);outcomes.push(outcome);
    state={...state,...challengeProgress(state,outcome,rule)};
  }
  return Object.freeze(outcomes);
}

export function applyChallengeDuel(state,last){
  return Object.freeze({...state,...challengeProgress(state,last.outcome),
    draws:(state.draws||0)+Number(last.outcome==='draw'),rounds:state.rounds+1,last});
}

// Only the active challenge and latest hand are retained. No game history.
export function playChallengeRound(state,player,cryptoSource=globalThis.crypto){
  if(state.status!=='playing')throw new Error('本場挑戰已結束');
  const last=weightedDuel(state.characterId,player,cryptoSource);
  return applyChallengeDuel(state,last);
}

// Shared by local presentation and authoritative settlement. Wallet effects
// and transient throw counters remain with their respective callers.
export function challengeProgress(state,outcome,rule=characterRule(state.characterId)){
  if(state.status!=='playing')throw new Error('本場挑戰已結束');
  if(!['win','loss','draw'].includes(outcome))throw new Error('不支援的出拳結果');
  const wins=state.wins+Number(outcome==='win'),losses=state.losses+Number(outcome==='loss');
  const status=wins>=rule.winsRequired?'won':losses>=rule.lossLimit?'lost':'playing';
  return {wins,losses,status,reward:status==='won'?rule.reward:0};
}

// Independent dynamic program, including free repeat throws on a draw.
export function characterOdds(id){
  const rule=characterRule(id),p=rule.winWeight/(rule.winWeight+rule.lossWeight);
  const rows=Array.from({length:rule.winsRequired+1},()=>Array.from({length:rule.lossLimit+1},()=>({clear:0,throws:0})));
  for(let l=0;l<rule.lossLimit;l++)rows[rule.winsRequired][l].clear=1;
  for(let w=rule.winsRequired-1;w>=0;w--)for(let l=rule.lossLimit-1;l>=0;l--){
    const win=rows[w+1][l],loss=rows[w][l+1];
    rows[w][l]={clear:p*win.clear+(1-p)*loss.clear,throws:1.25+p*win.throws+(1-p)*loss.throws};
  }
  return rows[0][0];
}
