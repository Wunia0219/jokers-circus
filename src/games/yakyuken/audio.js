import {MUSIC_SOURCE} from '../../ui/audio/audio-cues.js';
import {Sound} from '../../ui/audio/audio.js';
import {startDefaultMusic} from '../../ui/audio/default-music.js';

// Share the slot music track, volume and autoplay handling. No duel SFX.
export class PreviewAudio {
  constructor(onStateChange=()=>{}){this.background=new Sound({musicUrl:MUSIC_SOURCE,onStateChange});}
  get musicMuted(){return !this.background.musicEnabled;}
  start(options){this.cleanup=startDefaultMusic(this.background,options);}
  toggleMusic(){return this.background.setMusicEnabled(!this.background.musicEnabled);}
  pauseMusic(){void this.background.setVisible(false);}
  resumeMusic(){void this.background.setVisible(true);}
  destroy(){this.cleanup?.();this.background.dispose();}
}
