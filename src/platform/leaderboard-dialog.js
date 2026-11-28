import './leaderboard-dialog.css';
import {prepareNumberFont,setBitmapNumber} from '../ui/shared/bitmap-number.js';

const format=new Intl.NumberFormat('en-US');
const resetDate=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric',day:'numeric'});
const panels=new WeakMap();
const markup=`
  <header class="leaderboard-header">
    <h2 id="leaderboard-title">總投入排行榜</h2>
    <button type="button" class="leaderboard-close" aria-label="關閉排行榜" data-action="close">×</button>
  </header>
  <div class="leaderboard-controls">
    <div class="leaderboard-periods" role="group" aria-label="統計期間">
      <button type="button" data-period="cycle">月排名</button>
      <button type="button" data-period="all">總排名</button>
    </div>
    <div class="leaderboard-games" role="group" aria-label="排名分類">
      <button type="button" data-game="total">總投入</button>
      <button type="button" data-game="slot">老虎機</button>
      <button type="button" data-game="duel" hidden></button>
    </div>
  </div>
  <p class="leaderboard-since"></p>
  <div class="leaderboard-results">
    <table>
      <thead><tr><th scope="col">名次</th><th scope="col">玩家</th><th scope="col">投入戲籌</th></tr></thead>
      <tbody></tbody>
    </table>
    <p role="status" class="leaderboard-status"></p>
    <button type="button" data-action="retry" hidden>重新載入</button>
  </div>
  <nav class="leaderboard-pages" aria-label="排行榜頁碼">
    <button type="button" data-action="prev">上一頁</button>
    <span aria-live="polite"></span>
    <button type="button" data-action="next">下一頁</button>
  </nav>`;

function createLeaderboard(button,{fetchBoard,getDuelTitle}){
  const dialog=document.createElement('dialog');
  dialog.className='leaderboard-dialog';
  dialog.setAttribute('aria-labelledby','leaderboard-title');
  dialog.innerHTML=markup;
  button.closest('main').append(dialog);
  const get=selector=>dialog.querySelector(selector);
  const results=get('.leaderboard-results'),table=get('table'),body=get('tbody'),status=get('.leaderboard-status');
  const pageLabel=get('.leaderboard-pages span'),since=get('.leaderboard-since');
  const previous=get('[data-action="prev"]'),next=get('[data-action="next"]'),retry=get('[data-action="retry"]');
  let period,game='total',page=1,pages=1,request,visibleRows=[];

  function drawRows(){
    body.replaceChildren(...visibleRows.map(({rank,name,amount})=>{
      const row=document.createElement('tr');
      const rankCell=row.insertCell(),nameCell=row.insertCell(),amountCell=row.insertCell();
      if(rank<=3)row.dataset.medal=String(rank);
      setBitmapNumber(rankCell,String(rank));
      nameCell.textContent=name;
      nameCell.title=name;
      setBitmapNumber(amountCell,format.format(amount));
      return row;
    }));
  }
  void prepareNumberFont().then(drawRows).catch(()=>{});

  async function load(target=page){
    request?.abort();
    request=new AbortController();
    const current=request;
    dialog.querySelectorAll('[data-period],[data-game]').forEach(tab=>{
      tab.setAttribute('aria-pressed',String(tab.dataset.period===period||tab.dataset.game===game));
    });
    const requestedPage=target;
    previous.disabled=next.disabled=true;
    retry.hidden=true;
    table.hidden=true;
    since.textContent='';
    pageLabel.textContent='';
    status.textContent='正在載入排行榜…';
    results.scrollTop=0;
    try{
      const params=new URLSearchParams({period,game,page:String(requestedPage)});
      const response=await fetchBoard(params,AbortSignal.any([current.signal,AbortSignal.timeout(14000)]));
      if(!response.ok){
        const error=await response.json().catch(()=>null);
        throw new Error(error?.error||'排行榜暫時無法載入。');
      }
      const board=await response.json();
      if(current.signal.aborted)return;
      ({page,pages}=board);
      visibleRows=board.rows;
      drawRows();
      table.hidden=!visibleRows.length;
      if(period==='cycle')since.textContent=board.lastReset?
        `自 ${resetDate.format(new Date(board.lastReset))} 重設後累積`:'尚未月重設，目前從開服累積';
      status.textContent=visibleRows.length?'':'這個榜單目前還沒有投入紀錄。';
      pageLabel.textContent=`${page} / ${pages}`;
      previous.disabled=page<=1;
      next.disabled=page>=pages;
    }catch(error){
      if(current.signal.aborted)return;
      status.textContent=error.name==='TimeoutError'?'排行榜載入逾時。':error.message;
      retry.hidden=false;
      retry.onclick=()=>void load(requestedPage);
    }
  }
  dialog.addEventListener('click',event=>{
    const control=event.target.closest('button');
    if(!control)return;
    const {period:nextPeriod,game:nextGame,action}=control.dataset;
    if(action==='close')dialog.close();
    if(action==='prev')void load(page-1);
    if(action==='next')void load(page+1);
    if(nextPeriod&&nextPeriod!==period){period=nextPeriod;void load(1);}
    if(nextGame&&nextGame!==game){game=nextGame;void load(1);}
  });
  dialog.addEventListener('close',()=>{request?.abort();button.focus({preventScroll:true});});
  return ()=>{
    if(dialog.open)return;
    const duel=get('[data-game="duel"]'),duelTitle=getDuelTitle?.();
    duel.hidden=!duelTitle;
    duel.textContent=duelTitle??'';
    duel.parentElement.classList.toggle('has-duel',Boolean(duelTitle));
    if(!duelTitle&&game==='duel')game='total';
    period='cycle';
    dialog.showModal();
    get('[data-action="close"]').focus({preventScroll:true});
    void load(1);
  };
}

export function openLeaderboard(button,options){
  if(!panels.has(button))panels.set(button,createLeaderboard(button,options));
  panels.get(button)();
}
