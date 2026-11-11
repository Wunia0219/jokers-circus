import {problem} from '../server/wallet/wallet-common.js';

const initial=Object.freeze({slot:'open',feature:'hidden',revision:0});
export const arcadeEnabled=env=>env.ARCADE_RELEASE_ENABLED==='true';
export const readArcade=state=>state.get('arcade-controls')??initial;
const transitions={
  slot:{open:['maintenance'],maintenance:['open']},
  feature:{hidden:['open'],open:['paused'],paused:['open']},
};

export function arcadeControls(project,store){
  const operators=(project.env.ARCADE_OPERATOR_IDS??'').split(',').map(id=>id.trim()).filter(Boolean);
  const canOperate=id=>operators.every(value=>/^\d{17,20}$/.test(value))&&operators.includes(id);
  const read=()=>readArcade(project.state);
  const change=(actor,game,mode,revision)=>store.settlementQueue.run(()=>{
    if(!canOperate(actor))throw problem(403,'只有指定的遊戲營運管理員可以操作。','ARCADE_OPERATOR');
    const before=read();
    if(!Number.isSafeInteger(revision)||revision!==before.revision)throw problem(409,'開關已更新，請重新開啟遊戲營運面板。','ARCADE_REVISION');
    if(!Object.hasOwn(transitions,game)||!transitions[game][before[game]].includes(mode))
      throw problem(400,'此遊戲狀態無法切換。','ARCADE_MODE');
    if(game==='feature'&&mode==='open'&&!project.ready())throw problem(503,'帳本與備份尚未就緒。','ARCADE_READINESS');
    const next={...before,[game]:mode,revision:revision+1,updatedAt:Date.now(),actor};
    project.state.set('arcade-controls',next);
    return next;
  });
  return {canOperate,read,change};
}
