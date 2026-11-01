// Rules are character data; future characters do not need another game engine.
export const ENTRY_FEE = 1000;
export const CHARACTERS = Object.freeze([
  Object.freeze({id:'dealer', name:'命運荷官', title:'THE DEALER', winsRequired:2, lossLimit:2, reward:2000, enabled:true}),
  Object.freeze({id:'guest-1', name:'第二位來賓', title:'COMING SOON', winsRequired:3, lossLimit:null, reward:5000, enabled:false}),
  Object.freeze({id:'guest-2', name:'第三位來賓', title:'COMING SOON', winsRequired:5, lossLimit:null, reward:10000, enabled:false}),
  Object.freeze({id:'guest-3', name:'第四位來賓', title:'COMING SOON', winsRequired:7, lossLimit:null, reward:25000, enabled:false}),
  Object.freeze({id:'guest-4', name:'第五位來賓', title:'COMING SOON', winsRequired:9, lossLimit:null, reward:50000, enabled:false}),
]);
export const DEALER = CHARACTERS[0];
