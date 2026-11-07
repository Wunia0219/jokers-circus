import {chooseLaunchArt} from './launch-art.js';

export const LAUNCH_READING_MS=900;
export const LAUNCH_FADE_MS=320;

export function createLaunchScreen(root,{random=Math.random}={}){
  const abort=new AbortController(),{signal}=abort,art=chooseLaunchArt(random),image=root.querySelector('.launch-art');
  let disposed=false,failed=false,leaving=false,shownAt=performance.now();
  root.dataset.art=art.id;root.dataset.stage='connecting';
  const wait=ms=>new Promise(resolve=>{
    if(signal.aborted)return resolve(false);
    const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);resolve(true);};
    const cancel=()=>{clearTimeout(timer);resolve(false);};
    const timer=setTimeout(done,ms);signal.addEventListener('abort',cancel,{once:true});
  });
  const visible=()=>root.classList.toggle('is-paused',document.hidden);
  document.addEventListener('visibilitychange',visible,{signal});visible();
  const artReady=new Promise(resolve=>{
    let settled=false;
    const finish=ok=>{
      if(disposed||signal.aborted){resolve(false);return;}
      root.dataset.artState=ok?'ready':'fallback';image.hidden=!ok;
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);
      shownAt=performance.now();
      resolve(ok);
    };
    const cancel=()=>{clearTimeout(timer);resolve(false);},timer=setTimeout(()=>finish(false),4000);
    signal.addEventListener('abort',cancel,{once:true});
    image.addEventListener('load',()=>{
      const url=image.currentSrc;
      void image.decode().then(()=>{
        if(image.currentSrc===url)finish(true);
      },()=>{
        if(image.currentSrc===url&&image.complete&&!image.naturalWidth)finish(false);
      });
    },{signal});
    image.addEventListener('error',()=>finish(false),{signal});
    root.querySelector('picture source').srcset=art.portrait;
    image.src=art.url;
  });
  return {
    async finish(){
      if(disposed||failed||leaving)return false;
      leaving=true;root.dataset.stage='lobby-ready';await artReady;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!await wait(Math.max(0,(reduced?0:LAUNCH_READING_MS)-(performance.now()-shownAt)))||failed||disposed)return false;
      root.dataset.stage='leaving';root.classList.add('is-leaving');
      if(!await wait(reduced?0:LAUNCH_FADE_MS)||failed||disposed)return false;
      root.dataset.stage='complete';root.remove();disposed=true;abort.abort();return true;
    },
    fail(){
      if(disposed||failed)return;failed=true;root.dataset.stage='error';root.classList.remove('is-leaving');root.classList.add('has-error');root.setAttribute('aria-busy','false');
      root.querySelector('.launch-status').textContent='暫時無法進入大廳，請關閉活動後重新開啟。';
    },
    destroy(){if(disposed)return;disposed=true;abort.abort();image.removeAttribute('src');root.remove();},
  };
}
