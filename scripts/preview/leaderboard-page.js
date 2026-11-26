import '../../src/platform/arcade-lobby.css';
import {createArcadeLobbyView} from '../../src/platform/arcade-lobby-view.js';
import {openLeaderboard} from '../../src/platform/leaderboard-dialog.js';
import {icon} from '../../src/ui/shared/icons.js';

const rankButton=document.getElementById('lobby-leaderboard');
rankButton.innerHTML=icon('trophy');
rankButton.addEventListener('click',()=>openLeaderboard(rankButton,{
  getDuelTitle:()=>'野球拳',
  fetchBoard:(params,signal)=>fetch('/api/arcade/leaderboard?'+params,{signal,cache:'no-store'}),
}));
document.querySelector('button[aria-label="背景音樂"]').innerHTML=icon('musicMuted');
const names=['紅幕旅人','金邊紙牌','月下荷官','黑桃爵士','絨幕觀眾','星光巡演','戒指魔術師',
  '夜場常客','花牌騎士','木偶收藏家','彩帶行者','霧光信使','馬戲見習生','初登舞台'];
const text=value=>value.replace(/<@(\d+)>/g,(_,id)=>names[Number(id.slice(-2))]??'玩家');
const tools=document.getElementById('preview-tools'),notices=document.getElementById('preview-notices');
tools.addEventListener('click',async event=>{
  const action=event.target.closest('button')?.dataset.action;
  if(!action)return;
  const buttons=[...tools.querySelectorAll('button')];
  for(const button of buttons)button.disabled=true;
  try{
    const response=await fetch('/api/local-leaderboard-preview?action='+action,{method:'POST'});
    if(!response.ok)throw new Error('本機預覽無法更新。');
    const {notices:messages}=await response.json();
    notices.textContent=messages.length?messages.map(({content,embeds})=>[
      content.replace(/<@&\d+>/g,'@試運者｜Aleator'),
      ...embeds.map(embed=>text(embed.title+'\n'+embed.description).replaceAll('**','')),
    ].join('\n\n')).join('\n\n'):'這次沒有排行廣播。';
  }catch(error){notices.textContent=error.message;}
  finally{for(const button of buttons)button.disabled=false;}
});
const lifetime=new AbortController();
addEventListener('pagehide',()=>lifetime.abort(),{once:true});
try{
  const view=await createArcadeLobbyView(document.getElementById('lobby-stage'),lifetime.signal);
  const cover=await view.loadCover(new URL('/images/lobby/yakyuken-cover-v3.webp',location.href).href);
  view.show({slot:{},feature:{texture:cover,name:'野球拳'}});
  view.setVisible(true);
}catch{notices.textContent='舞台背景無法載入，排行榜仍可預覽。';}
