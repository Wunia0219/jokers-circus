import './yakyuken.css';
import {arcadeHost} from '../../platform/arcade-session.js';
import {ProductionDuelWallet} from './production-wallet.js';
import {YakyukenScene} from './scene.js';

const root=document.getElementById('yakyuken-app'),host=arcadeHost();
let scene,loading;
try{
  if(!host)throw new Error('請從 Discord 遊戲大廳開啟。');
  const activity=host.connect(window);
  loading=host.entryLoading?.(window);
  const wallet=new ProductionDuelWallet(activity.session,host.fetch);
  await wallet.refresh();
  loading?.update(20,'正在準備舞台…');
  scene=new YakyukenScene({wallet,music:host.music,onLobby:()=>host.back(window)});
  scene.activity=activity;
  addEventListener('pagehide',event=>event.persisted?scene.pause():void scene.destroy());
  addEventListener('pageshow',event=>{if(event.persisted)scene.resume();});
  await scene.init(root);
  if(scene.app.canvas.dataset.phase==='error')throw new Error('舞台素材載入失敗。');
  if(await scene.beginEntry('game',{loading})&&wallet.active())await scene.beginEntry('table',{resume:true});
}catch(error){
  await scene?.destroy();
  if(loading)loading.fail(error.message);
  else{
    const message=document.createElement('p'),retry=document.createElement('button');
    message.role='status';message.textContent=error.message||'舞台暫時無法載入。';
    retry.textContent='重新載入';retry.onclick=()=>location.reload();
    const back=document.createElement('button');
    back.textContent='返回大廳';back.onclick=()=>host?.back(window);back.hidden=!host;
    root.replaceChildren(message,retry,back);
  }
}
