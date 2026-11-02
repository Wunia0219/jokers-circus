import './yakyuken.css';
import {YakyukenScene} from './scene.js';

const root=document.querySelector('#yakyuken-app');
const scene=new YakyukenScene();
const leave=event => {if(event.persisted)scene.pause();else void scene.destroy();};
const restore=event => {if(event.persisted)scene.resume();};
addEventListener('pagehide',leave);addEventListener('pageshow',restore);
if(import.meta.hot)import.meta.hot.dispose(() => {removeEventListener('pagehide',leave);removeEventListener('pageshow',restore);void scene.destroy();});
try {await scene.init(root);}
catch(error){
  console.error(error);await scene.destroy();
  root.textContent='無法啟動遊戲繪圖，請重新載入或確認瀏覽器支援 WebGL。';
}
