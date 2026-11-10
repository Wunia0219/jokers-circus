import {YakyukenScene} from './scene.js';
import {TestWalletClient} from './test-wallet-client.js';
import {connectDiscordTestActivity,discordTestBuild,discordTestMusic,testReauthorization} from '../../platform/discord-test-activity.js';
import {reportLobbyBoot} from '../../platform/launch-protocol.js';

const root=document.querySelector('#yakyuken-app');
let testWallet=null,activity=null;
if(discordTestBuild){
  try{activity=await connectDiscordTestActivity();testWallet=new TestWalletClient({session:activity.session,reauthorize:testReauthorization(activity)});}
  catch(error){reportLobbyBoot(false);root.textContent=error.message;throw error;}
}else if(import.meta.env.VITE_YAKYUKEN_CLOUD_TEST==='true')testWallet=new TestWalletClient({player:new URLSearchParams(location.search).get('testPlayer')||'qa-a'});
const scene=new YakyukenScene({wallet:testWallet,music:discordTestBuild?discordTestMusic():null});
scene.activity=activity;
const leave=event => {if(event.persisted)scene.pause();else void scene.destroy();};
const restore=event => {if(event.persisted)scene.resume();};
addEventListener('pagehide',leave);addEventListener('pageshow',restore);
if(import.meta.hot)import.meta.hot.dispose(() => {removeEventListener('pagehide',leave);removeEventListener('pageshow',restore);void scene.destroy();});
try {
  if(testWallet)await testWallet.refresh();await scene.init(root);
  if(discordTestBuild&&!scene.disposed){
    const ok=scene.app.canvas.dataset.phase!=='error';
    if(ok)scene.app.render();
    reportLobbyBoot(ok);
  }
}
catch(error){
  if(discordTestBuild)reportLobbyBoot(false);
  console.error(error);await scene.destroy();
  root.textContent=testWallet?'測試雲端暫時無法連線，請重新載入。':'無法啟動遊戲繪圖，請重新載入或確認瀏覽器支援 WebGL。';
}
