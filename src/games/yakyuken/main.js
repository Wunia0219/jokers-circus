import {YakyukenScene} from './scene.js';
import {TestWalletClient} from './test-wallet-client.js';
import {connectDiscordTestActivity,discordTestBuild,testReauthorization} from '../../platform/discord-test-activity.js';

const root=document.querySelector('#yakyuken-app');
let testWallet=null,activity=null;
if(discordTestBuild){
  try{activity=await connectDiscordTestActivity();testWallet=new TestWalletClient({session:activity.session,reauthorize:testReauthorization(activity)});}
  catch(error){root.textContent=error.message;throw error;}
}else if(import.meta.env.VITE_YAKYUKEN_CLOUD_TEST==='true')testWallet=new TestWalletClient({player:new URLSearchParams(location.search).get('testPlayer')||'qa-a'});
const scene=new YakyukenScene({wallet:testWallet});
scene.activity=activity;
const leave=event => {if(event.persisted)scene.pause();else void scene.destroy();};
const restore=event => {if(event.persisted)scene.resume();};
addEventListener('pagehide',leave);addEventListener('pageshow',restore);
if(import.meta.hot)import.meta.hot.dispose(() => {removeEventListener('pagehide',leave);removeEventListener('pageshow',restore);void scene.destroy();});
try {if(testWallet)await testWallet.refresh();await scene.init(root);}
catch(error){
  console.error(error);await scene.destroy();
  root.textContent=testWallet?'測試雲端暫時無法連線，請重新載入。':'無法啟動遊戲繪圖，請重新載入或確認瀏覽器支援 WebGL。';
}
