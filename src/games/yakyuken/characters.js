import {DUEL_ENTRY_FEE,DUEL_RULES} from './settlement-rules-v1.js';

// Rules are character data; future characters do not need another game engine.
export const ENTRY_FEE = DUEL_ENTRY_FEE;
export const CHARACTERS = Object.freeze([
  {id:'dealer', name:'命運荷官', title:'THE DEALER', clearRate:.35, recoveryRate:.125, enabled:true},
  {id:'guest-1', name:'優然', title:'YOURAN', clearRate:.17, recoveryRate:.15, enabled:true},
  {id:'guest-2', name:'夏澄', title:'XIACHE', clearRate:.08, recoveryRate:.20, enabled:true},
  {id:'guest-3', name:'瑟洛', title:'SELO', clearRate:.03, recoveryRate:.25, enabled:true},
  {id:'guest-4', name:'萬世', title:'WANSHI', clearRate:.01, recoveryRate:.50, enabled:true},
].map(character=>Object.freeze({...character,...DUEL_RULES[character.id],drawWeight:2000})));
export const DEALER = CHARACTERS[0];
export function canEnterCharacter(id){return CHARACTERS.some(character=>character.id===id && character.enabled);}
export function canUnlockPose(id,pose){return Number.isInteger(pose)&&pose>=0&&CHARACTERS.some(c=>c.id===id&&c.enabled&&pose<=c.winsRequired);}
export function characterRule(id){
  const character=CHARACTERS.find(character=>character.id===id);
  if(!character)throw new Error('不支援的角色');
  return character;
}
