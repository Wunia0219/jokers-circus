import {YakyukenScene} from './scene.js';
import {TestWalletClient} from './test-wallet-client.js';

const root=document.querySelector('#yakyuken-app');
const testWallet=import.meta.env.VITE_YAKYUKEN_CLOUD_TEST==='true'?new TestWalletClient({player:new URLSearchParams(location.search).get('testPlayer')||'qa-a'}):null;
const scene=new YakyukenScene({wallet:testWallet});
const leave=event => {if(event.persisted)scene.pause();else void scene.destroy();};
const restore=event => {if(event.persisted)scene.resume();};
addEventListener('pagehide',leave);addEventListener('pageshow',restore);
if(import.meta.hot)import.meta.hot.dispose(() => {removeEventListener('pagehide',leave);removeEventListener('pageshow',restore);void scene.destroy();});
try {if(testWallet)await testWallet.refresh();await scene.init(root);}
catch(error){
  console.error(error);await scene.destroy();
  root.textContent=testWallet?'測試雲端暫時無法連線，請重新載入。':'無法啟動遊戲繪圖，請重新載入或確認瀏覽器支援 WebGL。';
}
