import {CHARACTERS, DEALER, ENTRY_FEE} from './characters.js';
import {MOVES, roundOutcome} from './rules.js';

export const PREVIEW_STORAGE_KEY = 'jokers-circus:yakyuken:preview:v1';
export const freshPreview = () => ({version:1, balance:10000, attempts:0, session:null});

export function beginChallenge(state, characterId = DEALER.id) {
  const character = CHARACTERS.find(value => value.id === characterId);
  if (!character?.enabled) throw new Error('這位角色尚未開放');
  if (state.session?.status === 'playing') throw new Error('請先完成目前挑戰');
  if (state.balance < ENTRY_FEE) throw new Error('試玩戲籌不足');
  return {...state, balance:state.balance - ENTRY_FEE, attempts:state.attempts + 1,
    session:{characterId, wins:0, losses:0, draws:0, rounds:0, status:'playing', last:null}};
}

export function playRound(state, player, dealer) {
  if (state.session?.status !== 'playing') throw new Error('目前沒有進行中的挑戰');
  const character = CHARACTERS.find(value => value.id === state.session.characterId);
  const outcome = roundOutcome(player, dealer);
  const session = {...state.session, rounds:state.session.rounds + 1, last:{player,dealer,outcome}};
  if (outcome === 'win') session.wins++;
  else if (outcome === 'loss') session.losses++;
  else session.draws++;
  session.status = session.wins >= character.winsRequired ? 'won' : session.losses >= character.lossLimit ? 'lost' : 'playing';
  return {...state, session, balance:state.balance + (session.status === 'won' ? character.reward : 0)};
}

export function restorePreview(serialized) {
  if (!serialized) return freshPreview();
  try {
    const value = JSON.parse(serialized);
    const integer = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e12;
    if (value?.version !== 1 || !integer(value.balance) || !integer(value.attempts)) throw new Error('Invalid preview');
    if (value.session !== null) {
      const s = value.session;
      if (s?.characterId !== DEALER.id || ![s.wins,s.losses,s.draws,s.rounds].every(integer)) throw new Error('Invalid session');
      if (s.wins > DEALER.winsRequired || s.losses > DEALER.lossLimit || s.rounds !== s.wins + s.losses + s.draws) throw new Error('Invalid progress');
      if (s.wins === DEALER.winsRequired && s.losses === DEALER.lossLimit) throw new Error('Invalid terminal state');
      const status = s.wins === DEALER.winsRequired ? 'won' : s.losses === DEALER.lossLimit ? 'lost' : 'playing';
      if (s.status !== status || value.attempts < 1) throw new Error('Invalid status');
      if (s.rounds > 0 && (!MOVES.includes(s.last?.player) || !MOVES.includes(s.last?.dealer) || roundOutcome(s.last.player,s.last.dealer) !== s.last.outcome)) throw new Error('Invalid round');
      if (s.rounds === 0 && s.last !== null) throw new Error('Unexpected round');
    }
    return {version:1,balance:value.balance,attempts:value.attempts,session:value.session};
  } catch { return freshPreview(); }
}
