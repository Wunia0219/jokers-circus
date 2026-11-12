import {Sound} from '../ui/audio/audio.js';
import {MUSIC_SOURCE} from '../ui/audio/audio-cues.js';

// The shell lives through child navigation and owns the only music player.
export function createActivityMusic(){
  const sound=new Sound({musicUrl:MUSIC_SOURCE});
  const listeners=new Set();
  let enabled=true,started=false,visible=true,disposed=false;
  const play=()=>sound.setMusicEnabled(enabled,{retryBlockedPlayback:true});
  const controls=Object.freeze({
    get enabled(){return enabled;},
    setEnabled(value){
      if(disposed)return Promise.resolve(false);
      enabled=value;
      for(const listener of listeners)listener();
      return started?play():Promise.resolve(enabled);
    },
    resumeFromGesture(){
      if(started&&!disposed&&enabled&&visible&&sound.music.paused)void play();
    },
    subscribe(listener){
      if(!disposed)listeners.add(listener);
      return ()=>listeners.delete(listener);
    },
  });
  return {
    controls,
    start(){if(!started&&!disposed){started=true;void play();}},
    setVisible(value){
      if(disposed||visible===value)return;
      visible=value;
      void sound.setVisible(visible);
    },
    dispose(){
      disposed=true;listeners.clear();sound.dispose();
    },
  };
}
