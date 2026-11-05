const stage=new URLSearchParams(location.search).get('stage'),status=document.querySelector('#status');
if(!/^[0-2]$/.test(stage||''))status.textContent='找不到這張 CG，請回遊戲重新開啟。';
else{
  const src=`/downloads/yakyuken/dealer-stage-${stage}.png`,download=document.querySelector('#download'),view=document.querySelector('#view'),art=document.querySelector('#art');
  download.href=view.href=src;download.download=`Jokers-Circus-dealer-CG-${Number(stage)+1}.png`;
  download.hidden=view.hidden=false;
  art.onload=()=>{status.textContent='原始尺寸・透明背景 PNG';art.hidden=false;};
  art.onerror=()=>{status.textContent='預覽暫時無法載入，仍可點選下載或開啟原圖。';};
  art.src=src;
}
