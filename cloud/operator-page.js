export default String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>營運後台 · Joker’s Circus</title>
  <style>
    :root { color-scheme: light; font-family: "DM Sans", "Noto Sans TC", system-ui, sans-serif; color: #222d28; background: #f5f5ef; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; line-height: 1.55; }
    header { background: #203a30; color: #fffaf0; }
    header > div, main { width: min(100% - 2rem, 68rem); margin-inline: auto; }
    header > div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 4.75rem; }
    .brand { font: 600 1.25rem/1.2 "Instrument Serif", Georgia, serif; }
    .environment { border: 1px solid #a6b6a9; border-radius: 999px; padding: .15rem .65rem; font-size: .875rem; }
    main { padding-block: clamp(1.5rem, 4vw, 3rem); }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(1.65rem, 4vw, 2.2rem); letter-spacing: -.04em; }
    h2 { font-size: 1.2rem; }
    h3 { font-size: 1.06rem; }
    .heading, .card-heading, .actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: .65rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    section, .grid, .health { margin-top: 1rem; }
    .card, dialog { background: #fffefa; border: 1px solid #cbd1c9; border-radius: .9rem; padding: clamp(1rem, 2.5vw, 1.5rem); }
    .card > * + *, form > * + * { margin-top: .85rem; }
    .muted, small { color: #45554c; }
    small { display: block; font-size: .875rem; }
    .health { padding: .75rem 1rem; background: #e5eee5; border-radius: .65rem; color: #253f32; }
    .health[data-warning="true"] { background: #f8ead4; color: #704710; }
    .pill { background: #edf1ec; color: #31463b; border-radius: 999px; padding: .2rem .65rem; font-size: .875rem; }
    .pill[data-open="true"] { background: #deeddf; color: #244a35; }
    label { display: block; font-weight: 600; }
    input, select, textarea { display: block; width: 100%; margin-top: .3rem; }
    button, input, select, textarea { min-height: 44px; border: 1px solid #89988d; border-radius: .5rem; padding: .55rem .75rem; font: inherit; }
    input, select, textarea { background: #fff; color: #222d28; }
    textarea { resize: vertical; min-height: 6rem; }
    button { background: #274837; color: #fff; cursor: pointer; }
    button:hover:not(:disabled) { background: #1a3629; }
    button.secondary { background: #fffefa; color: #274837; }
    button.secondary:hover:not(:disabled) { background: #e8eee8; }
    button:disabled { background: #e4e9e3; color: #4b584e; cursor: default; }
    :focus-visible { outline: 3px solid #975500; outline-offset: 2px; }
    .actions { justify-content: flex-start; }
    .feedback { margin-top: .6rem; color: #405347; overflow-wrap: anywhere; }
    .feedback[data-error="true"] { color: #932c24; }
    .feedback:empty { display: none; }
    #login { max-width: 28rem; margin: 2rem auto; }
    #result { border-top: 1px solid #cbd1c9; padding-top: .9rem; }
    #result p { margin-bottom: .65rem; white-space: pre-line; overflow-wrap: anywhere; }
    dialog { width: min(100% - 2rem, 26rem); color: inherit; }
    dialog p, dialog .actions { margin-top: 1rem; }
    dialog::backdrop { background: #17291fb3; }
    @media (max-width: 42rem) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header><div><span class="brand">Joker’s Circus</span><span id="environment" class="environment" hidden></span></div></header>
  <main>
    <section id="login" class="card">
      <h1>營運後台</h1>
      <form id="sign-in">
        <label for="key">管理金鑰</label>
        <input id="key" type="password" required autocomplete="current-password" spellcheck="false">
        <button id="sign-in-button" type="submit">登入</button>
        <p id="login-message" class="feedback" role="alert"></p>
      </form>
    </section>
    <div id="console" hidden>
      <div class="heading">
        <h1>營運後台</h1>
        <div class="actions"><button id="refresh" class="secondary">更新狀態</button><button id="lock" class="secondary">登出</button></div>
      </div>
      <p id="health" class="health" role="status"></p>
      <p id="entry-message" class="feedback" role="status"></p>
      <section aria-labelledby="entry-heading">
        <h2 id="entry-heading">遊戲入口</h2>
        <div class="grid">
          <article class="card">
            <div class="card-heading"><h3>老虎機</h3><span id="slot-state" class="pill"></span></div>
            <p class="muted">關閉入口後停止新回合，已受理的轉輪仍可確認。</p>
            <button id="slot-button"></button>
          </article>
          <article class="card">
            <div class="card-heading"><h3 id="feature-title"></h3><span id="feature-state" class="pill"></span></div>
            <p id="feature-description" class="muted"></p>
            <button id="feature-button"></button>
          </article>
        </div>
      </section>
      <div class="grid">
        <section class="card" aria-labelledby="report-heading">
          <h2 id="report-heading">查詢玩家回報</h2>
          <form id="report-form">
            <label id="guild-field" for="guild" hidden>伺服器<select id="guild"></select></label>
            <label for="player">玩家 ID<input id="player" required inputmode="numeric" pattern="[0-9]{17,20}" maxlength="20" aria-describedby="player-hint"></label>
            <small id="player-hint">在 Discord 開啟開發者模式後，從玩家個人檔案複製使用者 ID。</small>
            <label for="code">回報碼<input id="code" required maxlength="82" autocapitalize="off" spellcheck="false" placeholder="S- 或 D- 開頭"></label>
            <button id="report-button" type="submit">取回原結果</button>
          </form>
          <p id="report-message" class="feedback" role="status"></p>
          <div id="result" hidden>
            <h3 id="result-title" tabindex="-1"></h3>
            <p id="result-detail"></p>
            <button id="copy" class="secondary">複製回覆給玩家</button>
            <textarea id="reply" aria-label="給玩家的回覆" readonly hidden></textarea>
          </div>
        </section>
        <section class="card" aria-labelledby="recovery-heading">
          <h2 id="recovery-heading">備份與服務恢復</h2>
          <p class="muted">最近有效備份 <strong id="backup-time"></strong></p>
          <p id="backup-status" class="muted" role="status"></p>
          <div class="actions">
            <button id="backup-button">更新備份</button>
            <button id="verify-button" class="secondary">核對備份</button>
          </div>
          <p id="backup-message" class="feedback" role="status"></p>
          <small>備份與服務就緒後，可在上方重新開放遊戲入口。</small>
        </section>
      </div>
    </div>
  </main>
  <dialog id="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-detail">
    <h2 id="confirm-title"></h2>
    <p id="confirm-detail"></p>
    <div class="actions"><button id="cancel" class="secondary" autofocus>取消</button><button id="apply">確認變更</button></div>
  </dialog>
  <script>
    const $=id=>document.getElementById(id);
    const labels={open:'開放中',maintenance:'維護中',hidden:'預告隱藏',paused:'暫停新場次'};
    const formatDate=new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Taipei'});
    const date=value=>value?formatDate.format(new Date(value))+'（台灣時間）':'尚無紀錄';
    const number=new Intl.NumberFormat('zh-TW');
    let session, snapshot, pendingChange, busy=false, pollTimer, reply='';

    function message(id,text,error=false){
      $(id).textContent=text;
      $(id).dataset.error=String(error);
    }
    async function request(action,data,active=session){
      const response=await fetch('/__operator/'+action,{
        method:data?'POST':'GET',headers:{Authorization:'Bearer '+active.key,...(data?{'Content-Type':'application/json'}:{})},
        ...(data?{body:JSON.stringify(data)}:{}),cache:'no-store',credentials:'omit',redirect:'error',
        signal:AbortSignal.any([active.abort.signal,AbortSignal.timeout(30000)]),
      });
      const value=await response.json();
      if(!response.ok)throw Object.assign(new Error(value.error||'暫時無法連上服務。'),{status:response.status});
      return value;
    }
    function setButtons(){
      if(!snapshot)return;
      $('refresh').disabled=busy;
      $('slot-button').disabled=busy||(!snapshot.ready&&snapshot.entry.slot!=='open');
      $('feature-button').disabled=busy||(!snapshot.ready&&snapshot.entry.feature!=='open');
      $('report-button').disabled=busy||!snapshot.guilds.length;
      $('backup-button').disabled=busy||snapshot.mode!=='active'||snapshot.backup.running||snapshot.backup.retryAt>Date.now();
      $('verify-button').disabled=busy||!snapshot.backup.at;
    }
    function schedulePoll(){
      clearTimeout(pollTimer);
      if(!session||document.hidden||$('confirm').open||(!snapshot?.backup.running&&!snapshot?.backup.retryAt))return;
      pollTimer=setTimeout(async()=>{
        if(!busy)await run('entry-message',async active=>render(await request('status',null,active)),{quiet:true});
        if(session)schedulePoll();
      },5000);
    }
    function render(value){
      const previousBackup=snapshot?.backup;
      snapshot=value;
      $('environment').textContent=value.environment==='production'?'正式環境':'測試環境';
      $('health').textContent=value.ready?'服務可接受新回合':value.mode==='active'?'服務保護中，請核對備份及服務狀態。':'遊戲服務尚未啟用';
      $('health').dataset.warning=String(!value.ready);
      const {slot,feature,featureTitle,updatedAt}=value.entry;
      $('feature-title').textContent=featureTitle;
      $('entry-heading').title=updatedAt?'最近更新 '+date(updatedAt):'';
      for(const [game,state] of Object.entries({slot,feature})){
        $(game+'-state').textContent=labels[state];
        $(game+'-state').dataset.open=String(state==='open');
      }
      $('slot-button').textContent=slot==='open'?'關閉入口':'重新開放';
      $('feature-button').textContent={hidden:'揭曉並開放',open:'關閉新場次',paused:'重新開放'}[feature];
      $('feature-description').textContent=feature==='hidden'?'玩家目前只會看到模糊預告。':'關閉新場次後，已付費的玩家仍可續玩。';
      $('backup-time').textContent=date(value.backup.at);
      $('backup-status').textContent=value.backup.retryAt>Date.now()?'等待下次重試 '+date(value.backup.retryAt):
        value.backup.running?'正在更新並核對備份，完成後會更新時間。':'';
      if(previousBackup?.running&&!value.backup.running&&value.backup.at>previousBackup.at)
        message('backup-message','備份已更新並通過驗帳。');
      const guild=$('guild');
      if(Array.from(guild.options,option=>option.value).join(',')!==value.guilds.join(',')){
        const selected=guild.value;
        guild.replaceChildren(...value.guilds.map(id=>new Option(id,id)));
        if(value.guilds.includes(selected))guild.value=selected;
      }
      $('guild-field').hidden=value.guilds.length<2;
      setButtons();
      schedulePoll();
    }
    function logout(){
      session?.abort.abort();
      session=null; snapshot=null; pendingChange=null; busy=false; reply='';
      clearTimeout(pollTimer);
      $('confirm').close();
      $('console').hidden=true;
      $('environment').hidden=true;
      $('feature-title').textContent='';
      $('result').hidden=true;
      $('reply').hidden=true;
      $('reply').value='';
      $('result-detail').textContent='';
      $('report-form').reset();
      for(const id of ['entry-message','backup-message','report-message'])message(id,'');
      $('login').hidden=false;
      $('sign-in-button').disabled=false;
      $('key').focus();
    }
    async function run(messageId,action,{quiet=false}={}){
      if(busy||!session)return;
      const active=session;
      busy=true;setButtons();
      if(!quiet)message(messageId,'處理中…');
      try{await action(active);}
      catch(error){
        if(active!==session)return;
        if(error.status===401){logout();message('login-message',error.message,true);return;}
        message(messageId,error.status?error.message:'連線中斷，請更新狀態後再試。',true);
      }finally{
        if(active===session){busy=false;setButtons();}
      }
    }
    $('sign-in').addEventListener('submit',async event=>{
      event.preventDefault();
      const key=$('key').value.trim();
      if(!/^[a-f0-9]{64}$/i.test(key)){message('login-message','請貼上完整的管理金鑰。',true);return;}
      const active={key,abort:new AbortController()};
      session=active;
      $('sign-in-button').disabled=true;
      $('key').value='';
      message('login-message','登入中…');
      try{
        const value=await request('status',null,active);
        render(value);
        $('login').hidden=true;
        $('environment').hidden=false;
        $('console').hidden=false;
        $('refresh').focus();
        message('login-message','');
      }catch(error){
        logout();
        message('login-message',error.status?error.message:'暫時無法連上後台，請再試一次。',true);
      }
    });
    $('lock').addEventListener('click',logout);
    $('refresh').addEventListener('click',()=>run('entry-message',async active=>{
      render(await request('status',null,active));
      message('entry-message','已更新營運狀態。');
    }));
    for(const game of ['slot','feature']){
      $(game+'-button').addEventListener('click',()=>{
        const current=snapshot.entry[game];
        const mode=current==='open'?(game==='slot'?'maintenance':'paused'):'open';
        pendingChange={game,mode,revision:snapshot.entry.revision};
        $('confirm-title').textContent=$(game+'-button').textContent+(game==='slot'?'老虎機':snapshot.entry.featureTitle);
        $('confirm-detail').textContent=current==='hidden'?'確認後玩家會看到遊戲名稱與完整卡圖，並可開始新場次。':
          mode==='open'?'確認後玩家可以開始新的回合或場次。':
          game==='slot'?'目前正在結算的回合仍可確認。':'已付費的場次仍可續玩。';
        $('confirm').showModal();
        schedulePoll();
      });
    }
    $('cancel').addEventListener('click',()=>$('confirm').close());
    $('apply').addEventListener('click',()=>{
      const change=pendingChange;
      $('confirm').close();
      if(!change)return;
      run('entry-message',async active=>{
        try{render(await request('entry',change,active));}
        catch(error){
          if(error.status===409)render(await request('status',null,active));
          throw error;
        }
        message('entry-message','已更新遊戲入口。');
      });
    });
    $('confirm').addEventListener('close',()=>{
      if(!$('confirm').open)pendingChange=null;
      schedulePoll();
    });
    $('report-form').addEventListener('submit',event=>{
      event.preventDefault();
      const player=$('player').value.trim(),code=$('code').value.trim();
      $('result').hidden=true;
      $('reply').hidden=true;
      $('reply').value='';
      run('report-message',async active=>{
        const result=await request('report',{guild:$('guild').value,player,code},active);
        const game=result.game==='spin'?'老虎機':snapshot.entry.featureTitle;
        const confirmed=result.status==='committed';
        const details=confirmed?[
          game+' · 紀錄 '+result.recordCode,date(result.time),
          '戲籌 '+number.format(result.before)+' → '+number.format(result.after),
          result.game==='spin'?'下注 '+number.format(result.bet)+' · 派彩 '+number.format(result.payout):result.reason,
        ].join('\n'):'目前沒有查到這筆入帳紀錄。請核對玩家 ID 和回報碼，再請玩家在原畫面確認。';
        const step=result.game==='spin'?'若仍在原畫面，請再按一次 SPIN 確認上一局。':'若仍在原畫面，請按「重試」或重新載入同一活動視窗。';
        reply=(confirmed?'已找到原入帳紀錄。\n':'目前查無這筆原入帳紀錄。\n')+
          (confirmed?details+'\n':'請先保留原畫面與回報碼。\n')+step;
        $('result-title').textContent=confirmed?'已取回原結果':'查無原入帳紀錄';
        $('result-detail').textContent=details;
        $('result').hidden=false;
        $('result-title').focus();
        message('report-message','');
      });
    });
    $('copy').addEventListener('click',async()=>{
      const active=session;
      try{
        await navigator.clipboard.writeText(reply);
        if(active===session)message('report-message','已複製回覆。');
      }catch{
        if(active!==session)return;
        $('reply').value=reply;$('reply').hidden=false;$('reply').focus();$('reply').select();
        message('report-message','請複製已選取的回覆。');
      }
    });
    $('backup-button').addEventListener('click',()=>run('backup-message',async active=>{
      try{render(await request('backup',{},active));}
      catch(error){
        if(error.status===503)render(await request('status',null,active));
        throw error;
      }
      message('backup-message',snapshot.backup.running?'已開始更新備份。':snapshot.backup.retryAt?'已排程重試備份。':'備份已更新。');
    }));
    $('verify-button').addEventListener('click',()=>run('backup-message',async active=>{
      const result=await request('verify-backup',{},active);
      message('backup-message','備份核對通過 · '+date(result.at));
    }));
    document.addEventListener('visibilitychange',schedulePoll);
    window.addEventListener('pagehide',logout);
  </script>
</body>
</html>`;
