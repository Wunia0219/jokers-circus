import {CHARACTERS,characterRule} from './characters.js';

const ROOT='jokers-circus:yakyuken:archive:v1:';
const ID=/^[A-Za-z0-9_-]{8,80}$/;
const number=value=>Number.isSafeInteger(value) && value>=0;
const stateNames=new Set(['playing','won','lost','left']);
const safeStorage=()=>{try{return globalThis.localStorage;}catch{return null;}};

function validRecord(record,id){
  if(!record || record.id!==id || !ID.test(id) || !CHARACTERS.some(c=>c.id===record.characterId))return false;
  const rule=characterRule(record.characterId);
  if(record.reward!==undefined && record.reward!==(record.status==='won'?rule.reward:0))return false;
  if(![record.wins,record.losses,record.startedAt,record.updatedAt].every(number))return false;
  if(record.wins>rule.winsRequired || record.losses>rule.lossLimit || record.updatedAt<record.startedAt || !stateNames.has(record.status))return false;
  if(record.wins===rule.winsRequired)return record.status==='won' && record.losses<rule.lossLimit;
  if(record.losses===rule.lossLimit)return record.status==='lost';
  return record.status==='playing' || record.status==='left';
}

// Each match and CG has its own key. Independent tabs cannot replace another
// match's history or remove a CG unlocked by a different tab.
export class PlayerArchive {
  constructor({playerId='local-guest',storage=safeStorage(),clock=Date.now,id=()=>crypto.randomUUID()}={}){
    if(typeof playerId!=='string' || !playerId.trim() || playerId.length>120)throw new Error('Invalid player identity');
    Object.assign(this,{storage,clock,id});this.prefix=ROOT+encodeURIComponent(playerId)+':';this.memory=new Map();this.pending=new Set();this.readable=this.persistent=!!storage;
  }
  owns(key){return typeof key==='string' && key.startsWith(this.prefix);}
  read(key){
    if(this.pending.has(key))return this.memory.get(key) ?? null;
    if(this.readable){try{const value=this.storage.getItem(key);if(value!==null)this.memory.set(key,value);return value;}catch{this.readable=this.persistent=false;}}
    return this.memory.get(key) ?? null;
  }
  write(key,value){
    this.memory.set(key,value);
    if(this.persistent){try{this.storage.setItem(key,value);this.pending.delete(key);return;}catch{this.persistent=false;}}
    this.pending.add(key);
  }
  keys(){
    const keys=new Set(this.memory.keys());
    if(this.readable){try{for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(this.owns(key))keys.add(key);}}catch{this.readable=this.persistent=false;}}
    return [...keys];
  }
  getRecord(id){
    if(!ID.test(id || ''))return null;
    try{
      const record=JSON.parse(this.read(this.prefix+'match:'+id));if(!validRecord(record,id))return null;
      // Project legacy records onto the current shape, dropping throw/draw counts.
      const {characterId,wins,losses,status,startedAt,updatedAt}=record;
      return {id,characterId,wins,losses,status,startedAt,updatedAt,reward:record.reward ?? (status==='won'?characterRule(characterId).reward:0)};
    }catch{return null;}
  }
  records(){
    return this.keys().filter(key=>key.startsWith(this.prefix+'match:')).map(key=>this.getRecord(key.slice((this.prefix+'match:').length))).filter(Boolean)
      .sort((a,b)=>b.startedAt-a.startedAt || b.id.localeCompare(a.id));
  }
  unlock(characterId,pose){
    const rule=characterRule(characterId);
    if(!rule.enabled || !Number.isInteger(pose) || pose<0 || pose>2)return;
    const key=this.prefix+`cg:${characterId}:${pose}`;
    if(!this.isUnlocked(characterId,pose))this.write(key,String(this.clock()));
  }
  isUnlocked(characterId,pose){
    if(!CHARACTERS.some(c=>c.id===characterId && c.enabled) || !Number.isInteger(pose) || pose<0 || pose>2)return false;
    const value=this.read(this.prefix+`cg:${characterId}:${pose}`);
    return value!==null && /^\d{1,16}$/.test(value) && number(Number(value));
  }
  begin(characterId){
    const rule=characterRule(characterId),id=this.id(),now=this.clock();
    if(!rule.enabled || !ID.test(id) || !number(now))throw new Error('Invalid archive entry');
    const record={id,characterId,wins:0,losses:0,reward:0,status:'playing',startedAt:now,updatedAt:now};
    this.write(this.prefix+'match:'+id,JSON.stringify(record));this.unlock(characterId,0);return id;
  }
  update(id,challenge){
    if(challenge.last?.outcome==='draw')return false;
    const previous=this.getRecord(id);
    if(!previous || previous.status!=='playing' || previous.characterId!==challenge.characterId || challenge.wins+challenge.losses<=previous.wins+previous.losses)return false;
    const record={...previous,wins:challenge.wins,losses:challenge.losses,reward:challenge.reward,status:challenge.status,updatedAt:Math.max(previous.updatedAt,this.clock())};
    if(!validRecord(record,id))throw new Error('Invalid challenge archive state');
    this.write(this.prefix+'match:'+id,JSON.stringify(record));
    for(let pose=0;pose<=Math.min(challenge.wins,2);pose++)this.unlock(record.characterId,pose);
    return true;
  }
  leave(id){
    const record=this.getRecord(id);
    if(record?.status==='playing')this.write(this.prefix+'match:'+id,JSON.stringify({...record,status:'left',updatedAt:Math.max(record.updatedAt,this.clock())}));
  }
}
