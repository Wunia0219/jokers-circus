import {MUSIC_SOURCE} from '../../ui/audio/audio-cues.js';
import {Sound} from '../../ui/audio/audio.js';
import {startDefaultMusic} from '../../ui/audio/default-music.js';
import {RewardAudio} from './reward-audio.js';

// Share the slot music and synthesized reward tones; no extra audio downloads.
export class PreviewAudio {
  effectsWanted=true;
  constructor(onStateChange=()=>{}){this.background=new Sound({musicUrl:MUSIC_SOURCE,onStateChange});this.reward=new RewardAudio(this.background);}
  get musicMuted(){return !this.background.musicEnabled;}
  get effectsMuted(){return !this.background.enabled;}
  start({target=document,signal}={}){
    const musicCleanup=startDefaultMusic(this.background,{target,signal});
    const unlock=()=>{
      if(!this.effectsWanted||this.background.enabled||this.effectsPending)return;
      this.effectsPending=this.background.enable().finally(()=>{this.effectsPending=null;});
    };
    target.addEventListener('pointerdown',unlock,{capture:true,signal});target.addEventListener('keydown',unlock,{capture:true,signal});
    this.cleanup=()=>{musicCleanup();target.removeEventListener('pointerdown',unlock,true);target.removeEventListener('keydown',unlock,true);};
  }
  toggleEffects(){this.effectsWanted=!this.effectsWanted;return this.background.setEffectsEnabled(this.effectsWanted);}
  syncReward(reward){this.reward.sync(reward);}
  toggleMusic(){return this.background.setMusicEnabled(!this.background.musicEnabled);}
  pauseMusic(){void this.background.setVisible(false);}
  resumeMusic(){void this.background.setVisible(true);}
  destroy(){this.cleanup?.();this.background.dispose();}
}
