import {problem} from '../server/wallet/wallet-common.js';

const initial=Object.freeze({slot:'open',feature:'hidden',featureMaintenance:'open',revision:0});
export const arcadeEnabled=env=>env.ARCADE_RELEASE_ENABLED==='true';
export const liveSlotMaintenance=env=>env.APP_ENV==='production'&&!arcadeEnabled(env)&&operatorEnabled(env);
export function readArcade(state){
  const saved=state.get('arcade-controls');
  if(!saved)return initial;
  if(saved.feature==='paused')return {...saved,feature:'open',featureMaintenance:'maintenance'};
  return {...initial,...saved};
}
export function operatorEnabled(env){
  if(typeof env.ARCADE_CONSOLE_TOKEN!=='string'||!/^[a-f0-9]{64}$/i.test(env.ARCADE_CONSOLE_TOKEN))return false;
  const key=env.ARCADE_CONSOLE_TOKEN.toLowerCase();
  return ![env.CLOUD_ADMIN_TOKEN,env.CLOUD_MONITOR_TOKEN].some(value=>typeof value==='string'&&value.toLowerCase()===key);
}
const transitions={
  slot:{open:['maintenance'],maintenance:['open']},
  feature:{hidden:['open'],open:['hidden']},
  featureMaintenance:{open:['maintenance'],maintenance:['open']},
};

export function changeArcade(project,actor,game,mode,revision,queue){
  const apply=()=>{
    const before=readArcade(project.state);
    if(!Number.isSafeInteger(revision)||revision!==before.revision)throw problem(409,'開關已更新，請重新開啟遊戲營運面板。','ARCADE_REVISION');
    if(!Object.hasOwn(transitions,game)||(game!=='slot'&&!arcadeEnabled(project.env))||!transitions[game][before[game]].includes(mode))
      throw problem(400,'此遊戲狀態無法切換。','ARCADE_MODE');
    if(game==='feature'&&mode==='open'&&!project.ready())throw problem(503,'帳本與備份尚未就緒。','ARCADE_READINESS');
    const next={...before,[game]:mode,revision:revision+1,updatedAt:Date.now(),actor};
    project.state.set('arcade-controls',next);
    project.arcadeChanged?.();
    return next;
  };
  return queue?queue.run(apply):apply();
}

export function arcadeControls(project,store){
  const operators=(project.env.ARCADE_OPERATOR_IDS??'').split(',').map(id=>id.trim()).filter(Boolean);
  const canOperate=id=>operators.every(value=>/^\d{17,20}$/.test(value))&&operators.includes(id);
  const read=()=>readArcade(project.state);
  const change=(actor,game,mode,revision)=>{
    if(!canOperate(actor))throw problem(403,'只有指定的遊戲營運管理員可以操作。','ARCADE_OPERATOR');
    return changeArcade(project,actor,game,mode,revision,store.settlementQueue);
  };
  return {canOperate,read,change};
}
