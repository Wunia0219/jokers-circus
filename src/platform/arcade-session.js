export const ARCADE_SLOT_PATH='/arcade/slot';
export function canReturnToLobby({ready,busy,claiming,pending}){
  return !!ready&&!busy&&!claiming&&!pending;
}

export function arcadeHost(){
  try{
    if(window.parent!==window&&window.parent.location.origin===location.origin)return window.parent.__circusArcade;
  }catch{}
  return null;
}

export function createArcadeHost(activity,renew,frame,music,{entryLoading,onMaintenance}={}){
  let renewal;
  const owns=child=>child===frame.contentWindow&&child.location.origin===location.origin&&child.location.pathname===new URL(frame.src).pathname;
  return Object.freeze({
    music,
    connect(child){
      if(!owns(child))throw new Error('遊戲連線範圍不符。');
      return activity;
    },
    entryLoading(child){return owns(child)?entryLoading?.():null;},
    async fetch(path,options){
      const target=new URL(path,location.href);
      if(target.origin!==location.origin||!target.pathname.startsWith('/api/'))throw new Error('遊戲連線範圍不符。');
      const send=()=>{
        const headers=new Headers(options.headers);
        headers.set('Authorization','Bearer '+activity.session.token);
        return fetch(target,{...options,headers});
      };
      let response=await send();
      if(response.status===401){
        renewal ||= renew().then(next=>{
          const {session}=activity;
          if(next.session.environment!==session.environment||next.session.userId!==session.userId||
            next.session.guildId!==session.guildId||next.session.walletEpoch!==session.walletEpoch)
            throw new Error('登入資訊已更新，請關閉遊戲後重新開啟。');
          activity.session=next.session;
        }).finally(()=>{renewal=null;});
        await renewal;
        response=await send();
      }
      if(onMaintenance&&response.status===409){
        const {code}=await response.clone().json().catch(()=>({}));
        if(code==='SLOT_MAINTENANCE'||code==='DUEL_MAINTENANCE')onMaintenance();
      }
      return response;
    },
    back(child){
      if(owns(child))frame.dispatchEvent(new Event('return-to-lobby'));
    },
  });
}
