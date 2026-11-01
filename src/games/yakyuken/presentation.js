export function pause(ms, signal) {
  if (signal?.aborted || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort',finish); document.removeEventListener('visibilitychange',onHidden); resolve(); };
    const onHidden = () => { if (document.hidden) finish(); };
    const timer = setTimeout(finish,ms);
    signal?.addEventListener('abort',finish,{once:true});
    document.addEventListener('visibilitychange',onHidden);
  });
}

export async function animateTogether(animations, signal) {
  const cancel = () => animations.forEach(animation => animation.cancel());
  const onHidden = () => { if (document.hidden) cancel(); };
  signal?.addEventListener('abort',cancel,{once:true});
  document.addEventListener('visibilitychange',onHidden);
  if (signal?.aborted || document.hidden) cancel();
  try { await Promise.allSettled(animations.map(animation => animation.finished)); }
  finally {
    cancel(); signal?.removeEventListener('abort',cancel); document.removeEventListener('visibilitychange',onHidden);
  }
}

export async function changeWardrobe({portrait, overlay, setArt, stage, signal, onReveal = () => {}}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden || signal.aborted;
  if (reduced) { setArt(stage); if (!signal.aborted) onReveal(); return; }
  const emblem = overlay.querySelector('.victory-emblem');
  overlay.querySelector('.victory-count').textContent = stage === 2 ? 'CHALLENGE COMPLETE' : 'FIRST VICTORY';
  overlay.querySelector('.victory-title').textContent = stage === 2 ? '終幕，為你揭開' : '第一勝 · 揭開下一幕';
  overlay.querySelector('.victory-prize').textContent = stage === 2 ? '+ 2,000 戲籌' : '距離終幕，再一勝';
  overlay.hidden = false;
  const options = {duration:280, easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'};
  try {
    await animateTogether([
      overlay.animate([{opacity:0},{opacity:1}],options),
      emblem.animate([{opacity:0,transform:'scale(.65) rotate(-12deg)'},{opacity:1,transform:'scale(1) rotate(0deg)'}],options),
    ],signal);
    // A central emblem attracts attention while a dark backdrop masks the pose swap.
    portrait.classList.add('changing');
    setArt(stage);
    if (!signal.aborted) onReveal();
    if (signal.aborted || document.hidden) return;
    await pause(480,signal);
    await animateTogether([
      overlay.animate([{opacity:1},{opacity:0}],{...options,duration:320}),
      emblem.animate([{transform:'scale(1)'},{transform:'scale(1.1)'}],{...options,duration:320}),
    ],signal);
  } finally { setArt(stage); overlay.hidden = true; portrait.classList.remove('changing'); }
}
