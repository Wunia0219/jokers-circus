import {dailyRewardView} from './player-copy.js';
import {icon} from '../shared/icons.js';
import './checkin-button.css';

export function createCheckinButton(onClick){
  const element=document.createElement('button');
  element.type='button';element.id='daily-checkin';element.className='daily-checkin';
  element.setAttribute('aria-haspopup','dialog');
  element.setAttribute('aria-controls','dialog');
  element.innerHTML=`${icon('gift')}<span><strong>週簽到</strong><small>查看七日獎勵</small></span>`;
  element.hidden=true;element.disabled=true;
  element.addEventListener('click',onClick);
  const title=element.querySelector('strong'),detail=element.querySelector('small');
  return {element,update({visible=true,preview=false,claiming=false,claimed=false,...state}){
    const view=preview?{title:'週簽到',detail:'查看七日獎勵',disabled:state.busy||!state.ready}:dailyRewardView({...state,claimed,claiming});
    element.hidden=!visible;element.disabled=view.disabled;
    title.textContent=view.title;detail.textContent=view.detail;
    element.classList.toggle('is-preview',preview);
    element.classList.toggle('is-claimed',claimed&&!claiming);
    element.classList.toggle('is-loading',claiming);
    element.setAttribute('aria-busy',String(claiming));
    element.title='查看七日簽到獎勵與目前進度';
    element.setAttribute('aria-label',`${view.title}，${view.detail}。${element.title}`);
  }};
}
