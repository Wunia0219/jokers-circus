import {createWeeklyCheckin} from '../../ui/dialogs/weekly-checkin.js';
import {icon} from '../../ui/shared/icons.js';
import {createPlayerToast} from '../../ui/player/player-toast.js';

export function createCheckinDialog(host,onClaim){
  const dialog=document.createElement('dialog');
  dialog.id='dialog';dialog.className='checkin-dialog';
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">週簽到</h2>
    <button id="close-dialog" class="icon-button" type="button" aria-label="關閉視窗" autofocus>${icon('close')}</button></div><div id="dialog-body"></div>`;
  const body=dialog.querySelector('#dialog-body'),title=dialog.querySelector('h2');
  const panel=createWeeklyCheckin({onClaim});
  body.append(panel.element);
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  const toastElement=document.createElement('div');
  toastElement.className='player-toast';toastElement.hidden=true;
  toastElement.setAttribute('role','status');toastElement.setAttribute('aria-live','polite');toastElement.setAttribute('aria-atomic','true');
  const toast=createPlayerToast(toastElement);
  host.append(dialog,toastElement);
  return {
    get open(){return dialog.open;},
    show(){
      dialog.className='checkin-dialog';title.textContent='週簽到';body.replaceChildren(panel.element);
      dialog.showModal();body.scrollTop=0;
    },
    update(wallet,claiming){
      panel.update(wallet?.wallet?.checkinView??{},{
        ready:!!wallet?.wallet,
        busy:!!wallet?.pending&&wallet.pending.action!=='checkin',
        preview:!wallet,
        claiming,
        retry:wallet?.pending?.action==='checkin',
      });
    },
    message:panel.message,
    feedback({message,tone,title:heading,reconnect}){
      if(reconnect){
        dialog.className='notice-dialog';title.textContent=heading;
        const text=document.createElement('p'),action=document.createElement('button');
        text.textContent=message;action.textContent='重新開啟遊戲';action.className='notice-action';
        action.addEventListener('click',()=>location.reload());body.replaceChildren(text,action);
        if(!dialog.open)dialog.showModal();
      }else if(dialog.open)panel.message(message,tone);
      else toast.show(message,tone);
    },
    destroy(){dialog.close();dialog.remove();toast.destroy();},
  };
}
