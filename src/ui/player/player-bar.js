import './player-ui.css';
import { createCheckinButton } from './checkin-button.js';
import { discordAvatarUrl } from '../../platform/discord-avatar.js';

export function createPlayerBar({ icon, onCheckin, onHistory, onRules, onSound, onMusic, onLobby, avatarUrlForUser = discordAvatarUrl }) {
  const element = document.createElement('div');
  element.className = 'player-bar';
  element.innerHTML = `<div class="player-identity" role="group" aria-label="玩家資訊"><span class="player-avatar" aria-hidden="true"><span class="player-avatar-fallback">${icon('user')}</span><img class="player-avatar-image" alt="" decoding="async" referrerpolicy="no-referrer" hidden /><i></i></span><div class="player-identity-text"><strong id="player-name">歡迎來到馬戲團</strong><span id="player-id">正在準備遊戲</span></div></div>
    <nav class="player-tools" aria-label="遊戲工具"><div class="audio-controls" role="group" aria-label="聲音設定"><button id="sound" class="audio-toggle" aria-label="開啟音效" title="開啟音效" aria-pressed="false">${icon('muted')}</button><button id="music" class="audio-toggle" aria-label="開啟音樂" title="開啟音樂" aria-pressed="false">${icon('musicMuted')}</button></div><button id="help" class="utility" aria-label="遊戲規則" title="遊戲規則" aria-haspopup="dialog">${icon('info')}<span>遊戲規則</span></button><button id="all-history" class="utility" aria-label="遊玩紀錄" title="遊玩紀錄" aria-haspopup="dialog">${icon('clock')}<span>遊玩紀錄</span></button></nav>`;
  if(onLobby){
    const back=document.createElement('button');back.id='return-lobby';back.className='utility';
    back.setAttribute('aria-label','返回遊戲大廳');back.title='返回遊戲大廳';back.innerHTML=icon('lobby');
    back.addEventListener('click',onLobby);element.querySelector('.player-tools').append(back);
  }
  const checkin=createCheckinButton(onCheckin);
  element.querySelector('.player-tools').before(checkin.element);
  for (const [id, handler] of [['all-history', onHistory], ['help', onRules], ['sound', onSound], ['music', onMusic]]) if(handler)element.querySelector(`#${id}`).addEventListener('click', handler);
  const avatarImage = element.querySelector('.player-avatar-image');
  const avatarFallback = element.querySelector('.player-avatar-fallback');
  let avatarUrl = null;
  avatarImage.addEventListener('load', () => {
    if (avatarImage.currentSrc !== avatarUrl) return;
    avatarImage.hidden = false;
    avatarFallback.hidden = true;
  });
  avatarImage.addEventListener('error', () => {
    avatarImage.hidden = true;
    avatarFallback.hidden = false;
  });
  return {
    element,
    lobby({enabled,note}){
      const back=element.querySelector('#return-lobby');if(!back)return;
      back.disabled=!enabled;back.title=note || '返回遊戲大廳';
    },
    update({ user, connected = false, checkinPreview = false, localTest = false, ready = false, busy = false, claiming = false, claimed = false, daily, weeklyCheckin, storageAvailable = true }) {
      const name = user ? user.global_name || user.username : '訪客玩家';
      const nameNode = element.querySelector('#player-name');
      nameNode.textContent = name;
      nameNode.title = user ? `${name} (@${user.username})` : name;
      const idNode = element.querySelector('#player-id');
      idNode.textContent = localTest ? '測試帳號・進度保存在本機錢包' : user ? `ID ${user.id}` : storageAvailable ? '進度保存在這台裝置' : '離開後不會保留進度';
      element.querySelector('.player-identity').classList.toggle('is-connected', !!user);
      const nextAvatarUrl = avatarUrlForUser(user);
      if (nextAvatarUrl !== avatarUrl) {
        avatarUrl = nextAvatarUrl;
        avatarImage.hidden = true;
        avatarFallback.hidden = false;
        if (avatarUrl) avatarImage.src = avatarUrl;
        else avatarImage.removeAttribute('src');
      }
      checkin.update({visible:connected||checkinPreview,preview:checkinPreview,ready,busy,claiming,claimed,daily,weeklyCheckin});
    },
    audio({effectsEnabled=false,musicEnabled=false,musicAvailable=false}={}) {
      for(const [id,label,enabled,available,onIcon,offIcon] of [
        ['sound','音效',effectsEnabled,true,'sound','muted'],
        ['music','音樂',musicEnabled,musicAvailable,'music','musicMuted'],
      ]){
        const button=element.querySelector('#'+id);
        const action=available?(enabled?'關閉':'開啟')+label:'背景音樂尚未加入';
        button.innerHTML=icon(enabled?onIcon:offIcon);
        button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',action);
        button.title=action;button.disabled=!available;
      }
    },
  };
}
