export default String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__OPERATOR_TITLE__營運後台 · Joker’s Circus</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Noto Sans TC", system-ui, sans-serif;
      --stage: #211426;
      --panel: #352039;
      --panel-deep: #25172c;
      --field: #201426;
      --gold: #f5d28c;
      --gold-hover: #ffe4ab;
      --ink: #24142b;
      --text: #fff0d5;
      --muted: #dfc9d4;
      --frame: #856047;
      --field-line: #9c7588;
      --test-bg: #6b273f;
      --test-line: #e2a0a9;
      --positive-bg: #26372d;
      --positive: #bcf0cb;
      --warning-bg: #4d302c;
      --warning: #ffdea9;
      --error: #ffb7bb;
      color: var(--text);
      background: var(--stage);
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100vh; line-height: 1.55; background: radial-gradient(ellipse at 50% 0%, #49253e, var(--stage) 36rem); }
    header { background: linear-gradient(105deg, #432039, #261529); border-bottom: 1px solid var(--frame); }
    header > div, main { width: min(100% - 2rem, 68rem); margin-inline: auto; }
    header > div { display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 4.75rem; }
    .brand { font: 600 clamp(1.25rem, 4vw, 1.65rem)/1.15 Georgia, serif; color: var(--gold); }
    .environment { flex: none; border: 1px solid var(--frame); border-radius: .35rem; padding: .3rem .65rem; color: var(--gold); font-size: .875rem; font-weight: 700; }
    .environment[data-environment="test"] { background: var(--test-bg); border-color: var(--test-line); color: var(--text); letter-spacing: .035em; }
    main { padding-block: clamp(1.5rem, 4vw, 3rem); }
    h1, h2, h3, p { margin: 0; }
    h1 { color: var(--gold); font-size: clamp(1.65rem, 4vw, 2.2rem); }
    h2 { color: var(--gold); font-size: 1.2rem; }
    h3 { font-size: 1.06rem; }
    .heading, .card-heading, .actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: .65rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .entry-grid:has(#feature-card[hidden]) { grid-template-columns: 1fr; }
    section, .grid, .health { margin-top: 1rem; }
    .card, dialog { background: linear-gradient(145deg, var(--panel), var(--panel-deep)); border: 1px solid var(--frame); border-radius: .75rem; padding: clamp(1rem, 2.5vw, 1.5rem); box-shadow: 0 .65rem 1.5rem #100a1a40; }
    .card > * + *, form > * + * { margin-top: .85rem; }
    .muted, small { color: var(--muted); }
    small { display: block; font-size: .875rem; }
    .health { padding: .75rem 1rem; background: var(--positive-bg); border-radius: .65rem; color: var(--positive); }
    .health[data-warning="true"] { background: var(--warning-bg); color: var(--warning); }
    .backup-summary { margin-top: .65rem; color: var(--muted); font-size: .9rem; }
    #backup-status:empty { display: none; }
    .advanced-tools { margin-top: 1.25rem; }
    .advanced-tools > summary { min-height: 44px; padding: .65rem 1rem; border: 1px solid var(--frame); border-radius: .5rem; background: var(--panel-deep); color: var(--gold); font-weight: 650; cursor: pointer; }
    .advanced-tools > summary:hover { background: var(--panel); }
    .advanced-tools > .grid > section { margin-top: 0; }
    .pill { background: #4c334f; color: var(--text); border-radius: 999px; padding: .2rem .65rem; font-size: .875rem; }
    .pill[data-open="true"] { background: var(--positive-bg); color: var(--positive); }
    label { display: block; font-weight: 600; }
    input, select, textarea { display: block; width: 100%; margin-top: .3rem; }
    button, input, select, textarea { min-height: 44px; border: 1px solid var(--field-line); border-radius: .5rem; padding: .55rem .75rem; font: inherit; }
    input, select, textarea { background: var(--field); color: var(--text); }
    input::placeholder { color: var(--muted); opacity: 1; }
    textarea { resize: vertical; min-height: 6rem; }
    button { background: var(--gold); color: var(--ink); border-color: var(--gold); cursor: pointer; font-weight: 650; }
    button:hover:not(:disabled) { background: var(--gold-hover); }
    button.secondary { background: var(--panel-deep); color: var(--gold); border-color: var(--field-line); }
    button.secondary:hover:not(:disabled) { background: #493047; }
    button:disabled { background: var(--panel-deep); color: var(--muted); border-color: var(--field-line); cursor: default; opacity: .68; }
    :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
    .actions { justify-content: flex-start; }
    .feedback { margin-top: .6rem; color: var(--muted); overflow-wrap: anywhere; }
    .feedback[data-error="true"] { color: var(--error); }
    .feedback:empty { display: none; }
    #login { max-width: 28rem; margin: 2rem auto; }
    #remember-option { display: flex; align-items: center; gap: .65rem; width: fit-content; min-height: 44px; cursor: pointer; }
    #remember-key { width: 1.15rem; height: 1.15rem; min-height: 0; margin: 0; accent-color: var(--gold); }
    #result { border-top: 1px solid var(--frame); padding-top: .9rem; }
    #result p { margin-bottom: .65rem; white-space: pre-line; overflow-wrap: anywhere; }
    dialog { width: min(100% - 2rem, 26rem); color: inherit; }
    dialog p, dialog .actions { margin-top: 1rem; }
    dialog::backdrop { background: #13081dd9; }
    @media (max-width: 42rem) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body data-remember-key="__OPERATOR_REMEMBER__">
  <header><div><span class="brand">Joker’s Circus</span><span class="environment" data-environment="__OPERATOR_ENV__">__OPERATOR_LABEL__</span></div></header>
  <main>
    <section id="login" class="card">
      <h1>營運後台</h1>
      <form id="sign-in">
        <label for="key">管理金鑰</label>
        <input id="key" type="password" required autocomplete="current-password" spellcheck="false">
        <label id="remember-option" for="remember-key" hidden><input id="remember-key" type="checkbox">記住管理金鑰</label>
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
      <div class="backup-summary">
        <p class="muted">最近有效備份 <strong id="backup-time"></strong></p>
        <p id="backup-status" class="muted" role="status"></p>
      </div>
      <p id="entry-message" class="feedback" role="status"></p>
      <section aria-labelledby="entry-heading">
        <h2 id="entry-heading">遊戲入口</h2>
        <div class="grid entry-grid">
          <article class="card">
            <div class="card-heading"><h3>老虎機</h3><span id="slot-state" class="pill"></span></div>
            <p id="slot-description" class="muted"></p>
            <button id="slot-button"></button>
          </article>
          <article class="card" id="feature-card" hidden>
            <div class="card-heading"><h3 id="feature-title"></h3><span id="featureMaintenance-state" class="pill"></span></div>
            <p id="feature-description" class="muted"></p>
            <div class="actions">
              <button id="feature-button" class="secondary"></button>
              <button id="featureMaintenance-button"></button>
            </div>
          </article>
        </div>
      </section>
      <details id="advanced-tools" class="advanced-tools">
      <summary>進階工具</summary>
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
          <div class="actions">
            <button id="backup-button">更新備份</button>
            <button id="verify-button" class="secondary">核對備份</button>
          </div>
          <p id="backup-message" class="feedback" role="status"></p>
          <small>備份與服務就緒後，可在上方重新開放遊戲入口。</small>
        </section>
      </div>
      </details>
    </div>
  </main>
  <dialog id="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-detail">
    <h2 id="confirm-title"></h2>
    <p id="confirm-detail"></p>
    <div class="actions"><button id="cancel" class="secondary" autofocus>取消</button><button id="apply">確認變更</button></div>
  </dialog>
  <script>
    const $=id=>document.getElementById(id);
    const labels={open:'開放中',maintenance:'維護中'};
    const formatDate=new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Taipei'});
    const date=value=>value?formatDate.format(new Date(value))+'（台灣時間）':'尚無紀錄';
    const number=new Intl.NumberFormat('zh-TW');
    const rememberEnabled=document.body.dataset.rememberKey==='true';
    let session, snapshot, pendingChange, busy=false, pollTimer, reply='';
    let remembered=false;

    function message(id,text,error=false){
      $(id).textContent=text;
      $(id).dataset.error=String(error);
    }
    function showRemembered(value){
      remembered=value;
      $('remember-key').checked=value;
      $('key').required=!value;
      $('key').placeholder=value?'已記住管理金鑰':'';
    }
    async function rememberedRequest(method,active){
      const signal=AbortSignal.timeout(8000);
      const response=await fetch('/__operator/sign-in',{
        method,headers:active?.key?{Authorization:'Bearer '+active.key}:{},
        cache:'no-store',credentials:'same-origin',redirect:'error',
        signal:active?AbortSignal.any([active.abort.signal,signal]):signal,
      });
      const data=await response.json();
      if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});
      return data;
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
      $('featureMaintenance-button').disabled=busy||(!snapshot.ready&&snapshot.entry.featureMaintenance!=='open');
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
      $('health').textContent=value.ready?'服務可接受新回合':value.mode==='active'?'服務保護中，請核對備份及服務狀態。':'遊戲服務尚未啟用';
      $('health').dataset.warning=String(!value.ready);
      const {slot,feature,featureMaintenance,featureTitle,updatedAt,liveMaintenance}=value.entry;
      $('feature-card').hidden=!feature;
      $('feature-title').textContent=featureTitle??'';
      $('code').placeholder=feature?'S- 或 D- 開頭':'S- 開頭';
      $('entry-heading').title=updatedAt?'最近更新 '+date(updatedAt):'';
      for(const [game,state] of Object.entries(feature?{slot,featureMaintenance}:{slot})){
        $(game+'-state').textContent=game==='featureMaintenance'&&feature==='hidden'&&state==='open'?'維護已關閉':labels[state];
        $(game+'-state').dataset.open=String(state==='open');
      }
      $('slot-description').textContent=feature?'維護時，遊戲會中斷並引導玩家返回大廳。':
        liveMaintenance?'維護時，遊戲會中斷並引導玩家返回 Discord。':'關閉入口後停止新回合，已受理的轉輪仍可確認。';
      $('slot-button').textContent=slot==='open'?(feature||liveMaintenance?'開啟維護':'關閉入口'):'重新開放';
      $('feature-button').textContent=feature==='hidden'?'揭曉'+featureTitle:'顯示模糊預告';
      $('featureMaintenance-button').textContent=featureMaintenance==='open'?'開啟維護':'結束維護';
      $('feature-description').textContent=feature==='hidden'?'玩家目前只會看到模糊預告。':'玩家目前可看到遊戲名稱與完整卡圖。';
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
      $('feature-title').textContent='';
      $('result').hidden=true;
      $('reply').hidden=true;
      $('reply').value='';
      $('result-detail').textContent='';
      $('report-form').reset();
      $('advanced-tools').open=false;
      for(const id of ['entry-message','backup-message','report-message'])message(id,'');
      $('login').hidden=false;
      $('key').value='';
      showRemembered(remembered);
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
    if(rememberEnabled){
      void rememberedRequest('GET').then(value=>{
        if(!session)showRemembered(value.remembered);
      }).catch(()=>{}).finally(()=>{$('remember-option').hidden=false;});
      $('remember-key').addEventListener('change',async()=>{
        if($('remember-key').checked||!remembered)return;
        $('remember-key').disabled=true;
        $('sign-in-button').disabled=true;
        try{await rememberedRequest('DELETE');showRemembered(false);message('login-message','');}
        catch{showRemembered(true);message('login-message','暫時無法取消記住金鑰，請再試一次。',true);}
        finally{$('remember-key').disabled=false;$('sign-in-button').disabled=false;}
      });
    }
    $('sign-in').addEventListener('submit',async event=>{
      event.preventDefault();
      if(session||$('sign-in-button').disabled)return;
      const key=$('key').value.trim();
      const remember=rememberEnabled&&$('remember-key').checked;
      const useSaved=remember&&remembered&&!key;
      if(!useSaved&&!/^[a-f0-9]{64}$/i.test(key)){message('login-message','請貼上完整的管理金鑰。',true);return;}
      const active={key,abort:new AbortController()};
      session=active;
      $('sign-in-button').disabled=true;
      $('remember-key').disabled=true;
      $('key').value='';
      message('login-message','登入中…');
      try{
        if(remember){
          active.key=(await rememberedRequest('POST',active)).token;
          showRemembered(true);
        }
        const value=await request('status',null,active);
        if(session!==active)return;
        render(value);
        $('login').hidden=true;
        $('console').hidden=false;
        $('refresh').focus();
        message('login-message','');
      }catch(error){
        if(session!==active)return;
        if(useSaved&&error.status===401)showRemembered(false);
        logout();
        message('login-message',error.status?error.message:'暫時無法連上後台，請再試一次。',true);
      }finally{
        $('remember-key').disabled=false;
      }
    });
    $('lock').addEventListener('click',logout);
    $('refresh').addEventListener('click',()=>run('entry-message',async active=>{
      render(await request('status',null,active));
      message('entry-message','已更新營運狀態。');
    }));
    for(const game of ['slot','feature','featureMaintenance']){
      $(game+'-button').addEventListener('click',()=>{
        const current=snapshot.entry[game];
        const mode=current==='open'?(game==='feature'?'hidden':'maintenance'):'open';
        pendingChange={game,mode,revision:snapshot.entry.revision};
        const title=game==='slot'?'老虎機':snapshot.entry.featureTitle;
        const live=snapshot.entry.feature||snapshot.entry.liveMaintenance;
        $('confirm-title').textContent=live?title+' · '+$(game+'-button').textContent:$(game+'-button').textContent+title;
        $('confirm-detail').textContent=game==='feature'?
          (mode==='hidden'?'大廳會顯示模糊預告，遊戲中的玩家會收到返回大廳的提示。':'大廳會顯示'+title+'名稱與完整卡圖，入場依維護狀態開放。'):
          mode==='open'?(game==='featureMaintenance'?'已揭曉時，玩家可以入場及續玩。':'確認後玩家可以開始新的回合。'):
          live?'遊戲會中斷並顯示維護告示。已受理的結果可在重新開放後確認。':'目前正在結算的回合仍可確認。';
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
