import {createWeeklyCheckin} from '../../ui/dialogs/weekly-checkin.js';
import {icon} from '../../ui/shared/icons.js';

export function createCheckinDialog(host,onClaim){
  const dialog=document.createElement('dialog');
  dialog.className='checkin-dialog';
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">週簽到</h2>
    <button type="button" aria-label="關閉視窗" autofocus>${icon('close')}</button></div><div id="dialog-body"></div>`;
  const body=dialog.querySelector('#dialog-body');
  const panel=createWeeklyCheckin({onClaim});
  body.append(panel.element);
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  host.append(dialog);
  return {
    get open(){return dialog.open;},
    show(){dialog.showModal();body.scrollTop=0;},
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
    destroy(){dialog.close();dialog.remove();},
  };
}
