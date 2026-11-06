import {audioCue,cueVoices} from '../../ui/audio/audio-cues.js';
import {REWARD_COUNT_MS} from './reward-presentation.js';

// Use the slot win's authored bell tones. Emit only the current count beat,
// never a queue of future notes that could outlive a paused/slow visual count.
const voices=cueVoices('big');
const beats=audioCue('big').slice(0,16).map(note=>voices.filter(voice=>voice.at===note.at).map(voice=>({...voice,at:0})));
export class RewardAudio{
  constructor(sound){this.sound=sound;this.id=null;this.beat=-1;this.finished=false;this.counting=false;}
  sync(reward){
    if(reward.id!==this.id){this.id=reward.id;this.beat=-1;this.finished=false;}
    if(reward.stage==='counting'){
      this.counting=true;
      const beat=Math.min(beats.length-1,Math.floor(reward.elapsed/REWARD_COUNT_MS*beats.length));
      if(beat>this.beat){this.beat=beat;this.sound.playVoices(beats[beat]);}
    }else{
      if(this.counting){this.sound.cancelCues();this.counting=false;}
      if(reward.stage==='settled'&&!this.finished){this.finished=true;this.sound.win('return');}
    }
  }
}
