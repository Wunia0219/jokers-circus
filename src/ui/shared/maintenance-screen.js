import poster from './maintenance-poster.svg';
import './maintenance-screen.css';

export function showMaintenanceScreen({pending = false, onBack, title = onBack ? '維護中' : '維修中', message} = {}) {
  const screen = document.createElement('main');
  screen.className = 'maintenance-screen';
  screen.setAttribute('aria-labelledby', 'maintenance-title');
  screen.innerHTML = `
    <section class="maintenance-notice">
      <img src="${poster}" width="640" height="360" alt="">
      <p class="maintenance-brand" lang="en">Joker’s Circus</p>
      <h1 id="maintenance-title" tabindex="-1"></h1>
      <p>馬戲團暫時拉上布幕，請留意 Discord 的開放公告。</p>
      ${pending ? '<p>上一局的結果仍待確認。開放後請從原頁面重新開啟遊戲，再確認上一局。</p>' : ''}
      <button type="button">重新檢查</button>
    </section>`;
  const heading=screen.querySelector('h1'),button=screen.querySelector('button');
  heading.textContent=title;
  if(message)heading.nextElementSibling.textContent=message;
  if(onBack)button.textContent='返回大廳';
  button.addEventListener('click', onBack??(()=>location.reload()));
  document.body.append(screen);
  heading.focus({preventScroll:true});
  return screen;
}
