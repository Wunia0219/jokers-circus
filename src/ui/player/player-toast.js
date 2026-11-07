import {icon} from '../shared/icons.js';
import './player-toast.css';

export function createPlayerToast(element){
  let timer;
  return {
    show(message,tone='success'){
      clearTimeout(timer);
      const symbol=document.createElement('span'),text=document.createElement('span');
      symbol.innerHTML=icon(tone==='success'?'check':'info');
      symbol.setAttribute('aria-hidden','true');text.textContent=message;
      element.replaceChildren(symbol,text);element.dataset.tone=tone;element.hidden=false;
      timer=setTimeout(()=>{element.hidden=true;},5500);
    },
    destroy(){clearTimeout(timer);element.remove();},
  };
}
