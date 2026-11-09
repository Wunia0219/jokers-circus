import {cgFromLocation} from '../games/yakyuken/cg-catalog.js';
import {characterRule} from '../games/yakyuken/characters.js';

const art=cgFromLocation(location),status=document.querySelector('#status');
if(!art)status.textContent='找不到這張圖片，請從遊戲中重新開啟。';
else{
  const download=document.querySelector('#download'),view=document.querySelector('#view'),image=document.querySelector('#art');
  // Legacy pages on the test Worker still serve the original asset location.
  const src=location.pathname==='/cg-download.html'?art.download:art.image;
  document.querySelector('h1').textContent=art.name;
  document.title=`${art.name} · Joker’s Circus`;
  image.alt=`${characterRule(art.characterId).name}・${art.name}`;
  download.href=view.href=src;download.download=art.filename;
  download.hidden=view.hidden=false;
  image.onload=()=>{status.hidden=true;image.hidden=false;};
  image.onerror=()=>{status.textContent='圖片暫時無法顯示，請點選下載圖片。';};
  image.src=src;
}
