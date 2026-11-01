import {CHARACTERS, DEALER, ENTRY_FEE} from './characters.js';
import {DEALER_ART} from './assets.js';
import {challengeOdds, MOVES, MOVE_NAMES} from './rules.js';
import {handIcon, soundIcon} from './icons.js';
import {changeWardrobe, pause} from './presentation.js';

const fmt = value => value.toLocaleString('en-US');
const pct = value => `${(value * 100).toFixed(2).replace(/\.00$/,'')}%`;
const copy = {win:['你贏了這一拳','好眼光。再靠近勝利一步。'],loss:['荷官拿下這一拳','別急，下一拳也許就能逆轉。'],draw:['默契，平手','不扣機會，再出一拳。']};

export function mountScene(root, audio) {
  const events = new AbortController();
  root.innerHTML = `
    <a class="skip-link" href="#duel-panel">跳到出拳區</a>
    <header class="topbar">
      <a class="brand" href="/" aria-label="Joker’s Circus 首頁"><span class="brand-mark" aria-hidden="true">J</span><span>JOKER’S CIRCUS<small>命運馬戲團</small></span></a>
      <span class="preview-label">獨立試玩 <span>PREVIEW</span></span>
      <div class="top-actions"><button id="sound-toggle" class="icon-button" aria-label="開啟音效" aria-pressed="false">${soundIcon(true)}</button><div class="preview-wallet"><span>試玩戲籌</span><strong id="balance">10,000</strong></div></div>
    </header>
    <main>
      <section class="theatre" aria-labelledby="game-title">
        <div class="stage-copy">
          <p class="eyebrow"><span></span> AN ENCOUNTER WITH FATE</p>
          <p class="act-number">第一幕 <span>NO. 01</span></p>
          <h1 id="game-title">野球拳<span>命運荷官</span></h1>
          <div class="title-rule" aria-hidden="true"><i></i><b>◆</b><i></i></div>
          <p class="intro">一拳，試探命運。<br>兩次勝利，揭開終幕。</p>
          <dl class="prize-summary"><div><dt>每次挑戰</dt><dd>1,000 <small>戲籌</small></dd></div><div><dt>通關獎勵</dt><dd>2,000 <small>戲籌</small></dd></div></dl>
          <p class="stage-quote">「準備好了嗎？<br>讓我看看你的運氣。」</p>
          <span class="signature">The Dealer</span>
        </div>
        <figure class="portrait" id="portrait" aria-label="命運荷官造型">
          <div class="portrait-halo" aria-hidden="true"></div>
          <div class="portrait-number" aria-hidden="true">01</div>
          <img id="dealer-art" src="${DEALER_ART[0].url}" alt="命運荷官：${DEALER_ART[0].description}" width="1024" height="1536" fetchpriority="high" />
          <figcaption><span id="art-stage">邀你入局</span><div class="art-dots" aria-hidden="true"><i class="active"></i><i></i><i></i></div><small>THE DEALER · 命運荷官</small></figcaption>
        </figure>
        <section class="duel-panel" id="duel-panel" aria-labelledby="duel-title" tabindex="-1" aria-busy="true">
          <div class="panel-heading"><span class="eyebrow">THE CHALLENGE</span><button class="text-button" id="show-rules">遊戲說明 <span aria-hidden="true">↗</span></button></div>
          <h2 id="duel-title">這一局，由你出手。</h2>
          <p class="panel-intro">累積 2 勝通關，輸第 2 次挑戰結束。</p>
          <div class="progress-row"><div><span>你的勝場</span><div id="wins-progress" class="progress-marks" aria-label="目前 0 勝，共需 2 勝"><i></i><i></i></div></div><div><span>剩餘機會</span><div id="lives-progress" class="progress-marks lives" aria-label="剩餘 2 次機會"><i class="filled"></i><i class="filled"></i></div></div></div>
          <div class="duel-arena"><div class="hand-side"><span>YOU <small>你</small></span><div class="hand-face" id="player-hand">${handIcon(null)}</div><strong id="player-move">等待出拳</strong></div><span class="versus">VS</span><div class="hand-side"><span>DEALER <small>荷官</small></span><div class="hand-face dealer-hand" id="dealer-hand">${handIcon(null)}</div><strong id="dealer-move">等待出拳</strong></div></div>
          <div id="round-feedback" class="round-feedback" role="status" aria-live="polite" aria-atomic="true"><strong id="feedback-title">舞台準備中</strong><p id="feedback-detail">正在準備三階段角色原畫。</p></div>
          <div class="move-buttons" role="group" aria-label="選擇出拳">${MOVES.map((move,index) => `<button class="move-button" data-move="${move}" disabled aria-label="出${MOVE_NAMES[move]}">${handIcon(move)}<span>${MOVE_NAMES[move]}</span><kbd>${index + 1}</kbd></button>`).join('')}</div>
          <button class="enter-button" id="enter-challenge" disabled><span id="enter-label">準備舞台中…</span><span class="button-arrow" aria-hidden="true">↗</span></button>
          <p class="panel-footnote" id="panel-footnote">每次挑戰扣 1,000 · 平手不扣機會</p>
        </section>
      </section>
      <section class="cast-section" aria-label="角色名單"><div class="cast-heading"><span>選擇你的對手</span><small>THE CAST</small></div><div class="cast-list">${CHARACTERS.map((character,index) => `<button class="cast-member ${character.enabled?'selected':''}" ${character.enabled?'aria-pressed="true"':'disabled'} aria-label="${character.name}${character.enabled?'，已選擇':'，尚未開放'}"><span class="cast-index">0${index + 1}</span>${character.enabled?`<span class="cast-avatar"><img src="${DEALER_ART[0].url}" alt="" /></span>`:'<span class="cast-seal" aria-hidden="true">◇</span>'}<span class="cast-name">${character.enabled?character.name:'神秘來賓'}<small>${character.winsRequired} 勝 · ${fmt(character.reward)} 戲籌</small></span><span class="cast-state">${character.enabled?'登場':'待登場'}</span></button>`).join('')}</div></section>
      <footer class="preview-footer"><p>本機獨立試玩 · 戲籌與進度僅保存在此分頁 · 未連接正式錢包</p><div><button class="text-button" id="show-art">三階段原畫</button><button class="text-button" id="show-odds">機會次數試算</button><button class="text-button" id="reset-preview" disabled>重設試玩</button></div></footer>
      <p id="storage-warning" class="storage-warning" hidden>此瀏覽器無法儲存試玩進度，重新整理後將重置。</p>
    </main>
    <div id="victory-overlay" class="victory-overlay" aria-hidden="true" hidden><div class="victory-emblem"><div class="victory-star"><svg viewBox="0 0 160 160" fill="none" aria-hidden="true"><path d="M80 4 95 54 146 29 108 71 156 80 108 89 146 131 95 106 80 156 65 106 14 131 52 89 4 80 52 71 14 29 65 54Z"/><path d="m80 28 39 52-39 52-39-52Z"/><circle cx="80" cy="80" r="28"/></svg><b>勝</b></div><p class="victory-count"></p><strong class="victory-title"></strong><span class="victory-prize"></span></div></div>
    <dialog id="review-dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><h2 id="dialog-title"></h2><button id="close-dialog" class="icon-button" aria-label="關閉視窗">×</button></div><div id="dialog-body"></div></dialog>`;
  const $ = selector => root.querySelector(selector);
  const on = (element,type,callback) => element.addEventListener(type,callback,{signal:events.signal});
  let controller, stage = 0, ready = false;
  const openDialog = (title,html) => { $('#dialog-title').textContent = title; $('#dialog-body').innerHTML = html; $('#review-dialog').showModal(); };
  const closeDialog = () => $('#review-dialog').close();
  on($('#close-dialog'),'click',closeDialog);
  on($('#review-dialog'),'click',event => { if (event.target === $('#review-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
  on($('#show-rules'),'click',() => openDialog('遊戲說明',`<p class="dialog-lead">先贏兩拳，揭開荷官的終幕。</p><ol class="rules-list"><li>每次挑戰支付 <b>1,000 戲籌</b>，挑戰中的每次出拳不另外收費。</li><li>石頭勝剪刀、剪刀勝布、布勝石頭。平手重猜，不扣機會。</li><li>勝場採累積制；落敗不會扣掉已獲得的勝場。</li><li>累積 <b>2 勝</b>即通關；輸第 <b>2 次</b>挑戰結束，可承受 1 次落敗。</li><li>通關發放 <b>2,000 戲籌</b>，包含入場成本的回收；淨增加 1,000 戲籌。失敗不發放獎勵。</li><li>開場、1 勝、2 勝對應三張完整人物圖。</li></ol><p class="dialog-note">本版為獨立本機試玩，未連接 Discord 或正式錢包。猜拳採等機率獨立出拳，平手不設次數上限。</p>`));
  on($('#show-art'),'click',() => openDialog('荷官 · 三階段原畫',`<p>同一位荷官，隨階段改變服裝、動作與髮型。勝利徽章在畫面中央登場時切換造型。</p><div class="art-gallery">${DEALER_ART.map((art,index) => `<figure><img src="${art.url}" width="1024" height="1536" alt="${art.description}"/><figcaption><span>0${index + 1} · ${art.name}</span><small>${index === 0?'開場':`${index} 勝`}</small></figcaption></figure>`).join('')}</div>`));
  on($('#show-odds'),'click',() => openDialog('機會次數 · 精確試算',`<p>假設公平且獨立猜拳、平手重猜不扣機會、累積勝場，入場費統一為 1,000。獎勵為通關總入帳。</p><div class="odds-scroll"><table><caption>每格依序為通關率／理論返還率</caption><thead><tr><th>角色門檻與獎勵</th>${[1,2,3].map(n => `<th>輸第 ${n} 次結束</th>`).join('')}</tr></thead><tbody>${CHARACTERS.map(character => `<tr><th>${character.winsRequired} 勝<small>${fmt(character.reward)} 戲籌</small></th>${[1,2,3].map(l => {const {clear} = challengeOdds(character.winsRequired,l);return `<td>${pct(clear)}<small>${pct(clear * character.reward / ENTRY_FEE)}</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="dialog-note">理論返還率＝通關率 × 獎勵 ÷ 入場費；不代表單次結果。荷官暫採輸第 2 次結束：通關率 50%，理論返還率 100%，平均 3.75 次出拳。其餘角色的失敗門檻尚未定案，獎勵倍率差距使整數機會次數無法保證相同返還率。正式經濟目標確認後再決定。</p>`));
  on($('#sound-toggle'),'click',async () => {
    try { const muted = await audio.toggle(); $('#sound-toggle').innerHTML = soundIcon(muted); $('#sound-toggle').setAttribute('aria-pressed',String(!muted)); $('#sound-toggle').setAttribute('aria-label',muted?'開啟音效':'關閉音效'); }
    catch { $('#sound-toggle').setAttribute('aria-label','此裝置無法啟用音效'); }
  });

  function setArt(next) {
    stage = Math.min(next,DEALER_ART.length - 1);
    const art = DEALER_ART[stage];
    $('#dealer-art').src = art.url; $('#dealer-art').alt = `命運荷官：${art.description}`;
    $('#portrait').dataset.stage = String(stage);
    $('#art-stage').textContent = art.name;
    $('.art-dots').querySelectorAll('i').forEach((dot,index) => dot.classList.toggle('active',index === stage));
  }
  function setBusy(busy) {
    const playing = controller?.state.session?.status === 'playing';
    $('#duel-panel').setAttribute('aria-busy',String(busy || !ready));
    root.querySelectorAll('[data-move]').forEach(button => { button.disabled = !ready || busy || !playing; });
    $('#enter-challenge').disabled = !ready || busy || playing || (controller?.state.balance ?? 0) < ENTRY_FEE;
    $('#reset-preview').disabled = !ready || busy || playing;
  }
  function feedback(title,detail,tone = '') {
    $('#feedback-title').textContent = title; $('#feedback-detail').textContent = detail;
    $('#round-feedback').dataset.tone = tone;
  }
  function renderProgress(state) {
    $('#balance').textContent = fmt(state.balance);
    const session = state.session, wins = session?.wins ?? 0, lives = DEALER.lossLimit - (session?.losses ?? 0);
    $('#wins-progress').setAttribute('aria-label',`目前 ${wins} 勝，共需 2 勝`);
    $('#lives-progress').setAttribute('aria-label',`剩餘 ${lives} 次機會`);
    $('#wins-progress').querySelectorAll('i').forEach((mark,index) => mark.classList.toggle('filled',index < wins));
    $('#lives-progress').querySelectorAll('i').forEach((mark,index) => mark.classList.toggle('filled',index < lives));
  }
  function renderHands(last) {
    for (const side of ['player','dealer']) {
      $(`#${side}-hand`).innerHTML = handIcon(last?.[side]);
      $(`#${side}-move`).textContent = last ? MOVE_NAMES[last[side]] : '等待出拳';
    }
  }
  function render(state,{busy = false,storageUnavailable = false} = {}) {
    const session = state.session, playing = session?.status === 'playing';
    $('.theatre').classList.toggle('has-challenge',!!session);
    renderProgress(state); setArt(session?.wins ?? 0); renderHands(session?.last);
    $('#storage-warning').hidden = !storageUnavailable;
    $('#enter-challenge').hidden = playing;
    $('.move-buttons').classList.toggle('is-playing',playing);
    $('#enter-label').textContent = state.balance < ENTRY_FEE ? '戲籌不足 · 可重設試玩' : session ? '再次挑戰 · 1,000 戲籌' : '開始挑戰 · 1,000 戲籌';
    $('#panel-footnote').textContent = playing ? `第 ${session.rounds + 1} 拳 · 平手不扣機會 · 可用鍵盤 1 / 2 / 3 出拳` : '每次挑戰扣 1,000 · 平手不扣機會';
    if (!ready) feedback('舞台準備中','正在準備三階段角色原畫。');
    else if (session?.status === 'won') feedback('終幕，為你揭開',`通關獲得 ${fmt(DEALER.reward)} 戲籌 · 本次淨獲得 1,000`,'win');
    else if (session?.status === 'lost') feedback('這次，命運站在他那邊','挑戰結束。準備好時，再赴一場約。','loss');
    else if (session?.last) feedback(...copy[session.last.outcome],session.last.outcome);
    else if (playing) feedback('你的第一拳','選擇石頭、布或剪刀。');
    else feedback('命運，等你入席','準備好與荷官一較高下了嗎？');
    setBusy(busy);
  }
  const view = {
    render,setBusy,
    bind(value) {
      controller = value;
      on($('#enter-challenge'),'click',() => {
        if (!controller.start()) return;
        root.querySelector('[data-move]').focus({preventScroll:true});
        if (matchMedia('(max-width:620px)').matches) window.scrollTo({top:0,behavior:'instant'});
      });
      on($('#reset-preview'),'click',() => controller.reset());
      const play = move => controller.play(move).catch(error => { if (!events.signal.aborted) feedback('演出暫停',error.message); });
      root.querySelectorAll('[data-move]').forEach(button => on(button,'click',() => play(button.dataset.move)));
      document.addEventListener('keydown',event => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || $('#review-dialog').open || document.hidden || !ready) return;
        if (['INPUT','SELECT','TEXTAREA'].includes(event.target?.tagName) || event.target?.isContentEditable) return;
        const move = MOVES[Number(event.key) - 1];
        if (move) { event.preventDefault(); void play(move); }
      },{signal:events.signal});
    },
    ready() { ready = true; controller.render(); },
    fail(message) { ready = false; feedback('舞台尚未就緒',message); setBusy(false); },
    async presentRound(before,after,signal) {
      const last = after.session.last;
      $('.duel-arena').classList.add('revealing');
      renderHands(null); feedback('石頭、剪刀、布——','雙方即將揭曉。');
      try {
        await pause(520,signal);
        if (signal.aborted) return;
        $('.duel-arena').classList.remove('revealing');
        renderHands(last); renderProgress(after); feedback(...copy[last.outcome],last.outcome);
        if (before.session.wins !== after.session.wins) {
          await pause(220,signal);
          await changeWardrobe({portrait:$('#portrait'),overlay:$('#victory-overlay'),setArt,stage:after.session.wins,signal,onReveal:() => audio.cue('win')});
        } else { audio.cue(last.outcome); await pause(350,signal); }
      } finally { $('.duel-arena').classList.remove('revealing'); }
    },
    destroy() { events.abort(); if ($('#review-dialog').open) closeDialog(); audio.destroy(); },
  };
  return view;
}
