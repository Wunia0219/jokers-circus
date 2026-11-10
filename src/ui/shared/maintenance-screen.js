import poster from './maintenance-poster.svg';
import './maintenance-screen.css';

export function showMaintenanceScreen({pending = false} = {}) {
  const screen = document.createElement('main');
  screen.className = 'maintenance-screen';
  screen.setAttribute('aria-labelledby', 'maintenance-title');
  screen.innerHTML = `
    <section class="maintenance-notice">
      <img src="${poster}" width="640" height="360" alt="">
      <p class="maintenance-brand" lang="en">Joker’s Circus</p>
      <h1 id="maintenance-title" tabindex="-1">維修中</h1>
      <p>馬戲團暫時拉上布幕，請留意 Discord 的開放公告。</p>
      ${pending ? '<p>上一局的結果仍待確認。開放後請從原頁面重新開啟遊戲，再確認上一局。</p>' : ''}
      <button type="button">重新檢查</button>
    </section>`;
  screen.querySelector('button').addEventListener('click', () => location.reload());
  document.body.append(screen);
  screen.querySelector('h1').focus({preventScroll:true});
}
