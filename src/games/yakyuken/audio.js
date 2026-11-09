import {MUSIC_SOURCE} from '../../ui/audio/audio-cues.js';
import {Sound} from '../../ui/audio/audio.js';
import {bindActivityMusic,startDefaultMusic} from '../../ui/audio/default-music.js';

// Kenney Casino Audio 1.1 (CC0), card-place-4.ogg. Trimmed and gain-matched.
const CARD_FLIP_SOURCE=new URL('./card-flip.wav',import.meta.url).href;

// Music and effects have independent controls and lifetimes.
export class PreviewAudio {
  constructor(onStateChange=()=>{},music=null){
    this.onStateChange=onStateChange;this.music=music;
    this.background=new Sound({effectsEnabled:true,musicUrl:music?null:MUSIC_SOURCE,onStateChange});
  }
  get musicMuted(){return !(this.music?.enabled??this.background.musicEnabled);}
  get effectsMuted(){return !this.background.enabled;}
  start({target=document,signal}={}){
    const musicCleanup=this.music?bindActivityMusic(this.music,this.onStateChange,{target,signal}):startDefaultMusic(this.background,{target,signal});
    const flipBytes=fetch(CARD_FLIP_SOURCE,{signal}).then(response=>response.ok?response.arrayBuffer():null).catch(()=>null);
    const unlock=event=>{
      if(!event.isTrusted)return;
      void this.background.unlockEffects();
      const context=this.background.context;
      if(context&&!this.flipLoading){
        this.flipLoading=flipBytes.then(async bytes=>{
          if(bytes&&!signal?.aborted)this.flipBuffer=await context.decodeAudioData(bytes);
        }).catch(()=>{ /* Missing audio leaves the visual reveal usable. */ });
      }
    };
    const gestures=['pointerup','keydown'];
    for(const gesture of gestures)target.addEventListener(gesture,unlock,{capture:true,signal});
    this.cleanup=()=>{musicCleanup();for(const gesture of gestures)target.removeEventListener(gesture,unlock,true);};
  }
  toggleEffects(){return this.background.setEffectsEnabled(this.effectsMuted);}
  flipCard(){
    const buffer=this.flipBuffer;
    if(!buffer||!this.background.enabled)return;
    this.background.playVoices([{buffer,at:0,duration:buffer.duration,volume:1,attack:.001,hold:buffer.duration-.002,pan:0}]);
  }
  toggleMusic(){return this.music?this.music.setEnabled(this.musicMuted):this.background.setMusicEnabled(this.musicMuted);}
  pauseMusic(){void this.background.setVisible(false);}
  resumeMusic(){void this.background.setVisible(true);}
  destroy(){this.cleanup?.();this.background.dispose();}
}
