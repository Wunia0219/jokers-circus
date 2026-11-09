// Rules are character data; future characters do not need another game engine.
export const ENTRY_FEE = 1000;
export const CHARACTERS = Object.freeze([
  {id:'dealer', name:'命運荷官', title:'THE DEALER', winsRequired:2, lossLimit:2, reward:2500, winWeight:3189, lossWeight:4811, clearRate:.35, recoveryRate:.125, enabled:true},
  {id:'guest-1', name:'優然', title:'YOURAN', winsRequired:3, lossLimit:2, reward:5000, winWeight:3135, lossWeight:4865, clearRate:.17, recoveryRate:.15, enabled:true},
  {id:'guest-2', name:'夏澄', title:'XIACHE', winsRequired:5, lossLimit:3, reward:10000, winWeight:3057, lossWeight:4943, clearRate:.08, recoveryRate:.20, enabled:true},
  {id:'guest-3', name:'瑟洛', title:'SELO', winsRequired:7, lossLimit:3, reward:25000, winWeight:3299, lossWeight:4701, clearRate:.03, recoveryRate:.25, enabled:true},
  {id:'guest-4', name:'萬世', title:'WANSHI', winsRequired:9, lossLimit:4, reward:50000, winWeight:3022, lossWeight:4978, clearRate:.01, recoveryRate:.50, enabled:true},
].map(character=>Object.freeze({...character,drawWeight:2000})));
export const DEALER = CHARACTERS[0];
export function canEnterCharacter(id){return CHARACTERS.some(character=>character.id===id && character.enabled);}
export function canUnlockPose(id,pose){return Number.isInteger(pose)&&pose>=0&&CHARACTERS.some(c=>c.id===id&&c.enabled&&pose<=c.winsRequired);}
export function characterRule(id){
  const character=CHARACTERS.find(character=>character.id===id);
  if(!character)throw new Error('不支援的角色');
  return character;
}
