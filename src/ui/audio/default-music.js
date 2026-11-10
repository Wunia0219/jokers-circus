// Autoplay may wait for a gesture; the selected on/off state remains explicit.
export function startDefaultMusic(sound,{target=document,signal}={}){
  const resume=()=>{
    if(sound.musicEnabled && sound.musicPending)void sound.setMusicEnabled(true,{retryBlockedPlayback:true});
  };
  target.addEventListener('pointerdown',resume,{capture:true,signal});
  target.addEventListener('keydown',resume,{capture:true,signal});
  void sound.setMusicEnabled(true,{retryBlockedPlayback:true});
  return ()=>{
    target.removeEventListener('pointerdown',resume,true);
    target.removeEventListener('keydown',resume,true);
  };
}

// Call the shell directly while the native touch, mouse or keyboard gesture is active.
export function bindActivityMusic(music,onChange,{target=document,signal}={}){
  const resume=event=>{if(event.isTrusted)music.resumeFromGesture();};
  let unsubscribe=music.subscribe(onChange);
  const detach=()=>{unsubscribe?.();unsubscribe=null;};
  const restore=()=>{if(!unsubscribe){unsubscribe=music.subscribe(onChange);onChange();}};
  const gestures=['pointerup','touchend','keydown'];
  for(const type of gestures)target.addEventListener(type,resume,{capture:true,signal});
  target.defaultView?.addEventListener('pagehide',detach,{signal});
  target.defaultView?.addEventListener('pageshow',restore,{signal});
  const cleanup=()=>{
    detach();
    for(const type of gestures)target.removeEventListener(type,resume,true);
    target.defaultView?.removeEventListener('pagehide',detach);
    target.defaultView?.removeEventListener('pageshow',restore);
    signal?.removeEventListener('abort',cleanup);
  };
  signal?.addEventListener('abort',cleanup,{once:true});
  return cleanup;
}
