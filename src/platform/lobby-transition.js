import './lobby-transition.css';

let pending;
// Only the local slot-to-lobby navigation uses this document cover. Game
// loading stays with each game's own loader; this layer contains no content.
export function fadeToLobby(root,path){
  if(pending)return pending;
  const cover=document.createElement('div');cover.className='lobby-exit-cover';
  cover.setAttribute('aria-hidden','true');cover.dataset.stage='covering';document.body.append(cover);
  const wasInert=root.inert;root.inert=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation=cover.animate([{opacity:0},{opacity:1}],{duration:reduced?0:340,easing:'ease-out',fill:'forwards'});
  let cancelled=false;
  const restore=()=>{cancelled=true;animation.cancel();cover.remove();root.inert=wasInert;pending=null;};
  addEventListener('pageshow',restore,{once:true});
  pending=animation.finished.then(()=>{
    if(cancelled)return false;
    cover.dataset.stage='covered';location.assign(`${path}?transition=fade`);return true;
  },()=>false);
  return pending;
}
