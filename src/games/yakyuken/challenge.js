import {MOVES,roundOutcome} from './rules.js';

// Per-throw weights are the user's published percentages, in basis points.
// Clear/recovery targets are rounded table values, not a second outcome draw.
export const DIFFICULTIES=Object.freeze([
  {id:1,name:'一',reward:2500,winsRequired:2,lossLimit:2,winWeight:3189,lossWeight:4811,clearRate:.35,recoveryRate:.125},
  {id:2,name:'二',reward:5000,winsRequired:3,lossLimit:2,winWeight:3135,lossWeight:4865,clearRate:.17,recoveryRate:.15},
  {id:3,name:'三',reward:10000,winsRequired:5,lossLimit:3,winWeight:3057,lossWeight:4943,clearRate:.08,recoveryRate:.20},
  {id:4,name:'四',reward:25000,winsRequired:7,lossLimit:3,winWeight:3299,lossWeight:4701,clearRate:.03,recoveryRate:.25},
  {id:5,name:'五',reward:50000,winsRequired:9,lossLimit:4,winWeight:3022,lossWeight:4978,clearRate:.01,recoveryRate:.50},
].map(rule=>Object.freeze({...rule,drawWeight:2000})));

export function difficultyRule(id){
  const rule=DIFFICULTIES.find(rule=>rule.id===id);
  if(!rule)throw new Error('不支援的難度');
  return rule;
}

export function createChallenge(difficulty=1){
  difficultyRule(difficulty);
  return Object.freeze({difficulty,wins:0,losses:0,draws:0,rounds:0,status:'playing',reward:0,last:null});
}

export function weightedDuel(difficulty,player,cryptoSource=globalThis.crypto){
  const rule=difficultyRule(difficulty);
  if(!MOVES.includes(player))throw new Error('不支援的出拳');
  const values=new Uint32Array(1),total=10000,ceiling=Math.floor(2**32/total)*total;
  do{cryptoSource.getRandomValues(values);}while(values[0]>=ceiling);
  const weight=values[0]%total;
  const outcome=weight<rule.winWeight?'win':weight<rule.winWeight+rule.lossWeight?'loss':'draw';
  const dealer=MOVES.find(move=>roundOutcome(player,move)===outcome);
  return Object.freeze({player,dealer,outcome});
}

// Only the active challenge and latest hand are retained. No game history.
export function playChallengeRound(state,player,cryptoSource=globalThis.crypto){
  if(state.status!=='playing')throw new Error('本場挑戰已結束');
  const rule=difficultyRule(state.difficulty),last=weightedDuel(state.difficulty,player,cryptoSource);
  const wins=state.wins+Number(last.outcome==='win'),losses=state.losses+Number(last.outcome==='loss');
  const status=wins>=rule.winsRequired?'won':losses>=rule.lossLimit?'lost':'playing';
  return Object.freeze({...state,wins,losses,draws:state.draws+Number(last.outcome==='draw'),rounds:state.rounds+1,
    status,reward:status==='won'?rule.reward:0,last});
}

// Independent dynamic program, including free repeat throws on a draw.
export function difficultyOdds(id){
  const rule=difficultyRule(id),p=rule.winWeight/(rule.winWeight+rule.lossWeight);
  const rows=Array.from({length:rule.winsRequired+1},()=>Array.from({length:rule.lossLimit+1},()=>({clear:0,throws:0})));
  for(let l=0;l<rule.lossLimit;l++)rows[rule.winsRequired][l].clear=1;
  for(let w=rule.winsRequired-1;w>=0;w--)for(let l=rule.lossLimit-1;l>=0;l--){
    const win=rows[w+1][l],loss=rows[w][l+1];
    rows[w][l]={clear:p*win.clear+(1-p)*loss.clear,throws:1.25+p*win.throws+(1-p)*loss.throws};
  }
  return rows[0][0];
}
