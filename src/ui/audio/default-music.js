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
