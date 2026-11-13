import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {challengeProgress,createChallengePlan,duelForOutcome} from '../../src/games/yakyuken/challenge.js';
import {MOVES} from '../../src/games/yakyuken/rules.js';
import {problem} from './wallet-common.js';
import {DUEL_ENTRY_FEE,DUEL_RULES,DUEL_RULE_VERSION} from '../../src/games/yakyuken/settlement-rules-v1.js';

export const DUEL_LEDGER_KIND='duel';
const actions={begin:['requestId','characterId'],hand:['requestId','matchId','move','handIndex'],leave:['requestId','matchId']};
const validId=value=>typeof value==='string'&&/^[-a-zA-Z0-9]{16,80}$/.test(value);
export const duelKey=(user,id)=>`duel:${user}:${id}`;
const empty=()=>({records:[],unlocks:{},active:null});
export const duelDigest=state=>state===undefined?undefined:createHash('sha256').update(JSON.stringify(state)).digest('hex');

export function duelIntent(action,input){
  if(!Object.hasOwn(actions,action)||!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).length!==actions[action].length||!actions[action].every(key=>Object.hasOwn(input,key))||!validId(input.requestId)||
    (action==='begin'?typeof input.characterId!=='string'||!Object.hasOwn(DUEL_RULES,input.characterId):!validId(input.matchId))||
    (action==='hand'&&(!MOVES.includes(input.move)||!Number.isSafeInteger(input.handIndex)||input.handIndex<0)))
    throw problem(400,'遊戲請求格式有誤。','DUEL_INPUT');
  const fields=Object.fromEntries(actions[action].map(key=>[key,input[key]]));
  return {action,...fields};
}

export const duelFingerprint=intent=>JSON.stringify(intent);

export function settleDuel(previous,intent,now,makePlan=(character,rule)=>createChallengePlan(character,globalThis.crypto,rule)){
  const state=structuredClone(previous??empty());
  const {action,requestId,characterId,matchId,handIndex,move}=intent;
  const active=state.active;
  if(action==='begin'){
    if(active)return {state,delta:0,reason:'接續挑戰',matchId:active.id};
    const rule=DUEL_RULES[characterId],plan=makePlan(characterId,rule);
    if(!Array.isArray(plan)||!plan.length)throw new Error('Missing challenge plan');
    let check={characterId,wins:0,losses:0,status:'playing'};
    for(const outcome of plan)check={...check,...challengeProgress(check,outcome,rule)};
    if(check.status==='playing')throw new Error('Incomplete challenge plan');
    const record={id:requestId,characterId,wins:0,losses:0,rounds:0,status:'playing',fee:DUEL_ENTRY_FEE,reward:0,net:-DUEL_ENTRY_FEE,startedAt:now,updatedAt:now};
    state.records=[record,...state.records].slice(0,100);
    state.unlocks[characterId]=Math.max(0,state.unlocks[characterId]??-1);
    state.active={id:requestId,index:0,plan,ruleVersion:DUEL_RULE_VERSION};
    return {state,delta:-DUEL_ENTRY_FEE,reason:'挑戰入場',matchId:requestId,plan,ruleVersion:DUEL_RULE_VERSION};
  }
  const record=state.records[0];
  if(!active||active.id!==matchId||record?.id!==matchId||record.status!=='playing')
    throw problem(409,'此場挑戰已結束，請重新確認紀錄。','DUEL_MATCH');
  if(action==='leave'){
    Object.assign(record,{status:'left',updatedAt:now});state.active=null;
    return {state,delta:0,reason:'挑戰離場',matchId};
  }
  if(active.index!==handIndex)throw problem(409,'出牌進度已更新，請重新同步。','DUEL_HAND');
  const duel=duelForOutcome(move,active.plan[handIndex]);
  if(active.ruleVersion!==DUEL_RULE_VERSION)throw new Error('Unsupported challenge rules');
  Object.assign(record,challengeProgress(record,duel.outcome,DUEL_RULES[record.characterId]),{updatedAt:now});
  record.rounds++;
  record.net=record.reward-record.fee;
  state.unlocks[record.characterId]=Math.max(state.unlocks[record.characterId],record.wins);
  if(record.status==='playing')active.index++;
  else state.active=null;
  return {state,delta:record.reward,reason:record.reward?'挑戰通關派彩':'挑戰出拳',matchId,duel};
}

export function duelView(wallet,checkinView,environment){
  const {records,unlocks,active}=wallet.duel??empty();
  return {
    wallet:{player:`d_${wallet.guild}_${wallet.user}`,environment,cloud:true,balance:wallet.balance,revision:wallet.revision,
      records,unlocks,activeId:active?.id??null,checkinView},
    nextHand:active?{matchId:active.id,index:active.index}:null,
  };
}

export function validateDuelReceipt(operation,result,entry){
  try{
    const {action,...input}=JSON.parse(operation.fingerprint);
    const intent=duelIntent(action,input);
    const fields=Object.keys(entry);
    return fields.length===Object.keys(result.entry).length&&fields.every(key=>Object.hasOwn(result.entry,key)&&result.entry[key]===entry[key])&&
      operation.guild===entry.guild&&entry.kind===DUEL_LEDGER_KIND&&entry.actor===entry.user&&operation.key===duelKey(entry.user,entry.reference)&&
      intent.requestId===entry.reference&&duelFingerprint(intent)===operation.fingerprint&&
      typeof result.matchId==='string'&&(intent.action==='begin'||result.matchId===intent.matchId)&&
      (intent.action==='hand'?MOVES.includes(result.duel?.dealer)&&result.duel?.player===intent.move&&
        isDeepStrictEqual(duelForOutcome(intent.move,result.duel.outcome),result.duel):result.duel===undefined)&&
      (result.plan===undefined?result.ruleVersion===undefined:intent.action==='begin'&&Array.isArray(result.plan)&&result.ruleVersion===DUEL_RULE_VERSION)&&
      (entry.delta===0||intent.action==='begin'&&entry.delta===-DUEL_ENTRY_FEE||intent.action==='hand'&&entry.delta>0);
  }catch{return false;}
}

export function replayDuel(previous,operation,result,entry){
  if(!validateDuelReceipt(operation,result,entry))throw new Error('Invalid challenge receipt');
  const transition=settleDuel(previous,JSON.parse(operation.fingerprint),Date.parse(entry.time),()=>result.plan);
  if(transition.delta!==entry.delta||transition.reason!==entry.reason||transition.matchId!==result.matchId||
    !isDeepStrictEqual(transition.duel,result.duel)||!isDeepStrictEqual(transition.plan,result.plan))
    throw new Error('Challenge receipt does not match ledger');
  return transition.state;
}
