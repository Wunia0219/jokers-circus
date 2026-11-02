import {MUSIC_SOURCE} from '../../ui/audio/audio-cues.js';
// Independent preview effects; background music uses the existing circus track.
export class PreviewAudio {
  muted = true;
  musicMuted = true;
  async toggleMusic(){
    if(!this.music){this.music=new Audio(MUSIC_SOURCE);this.music.loop=true;this.music.volume=.25;}
    if(this.musicMuted){await this.music.play();this.musicMuted=false;}else{this.music.pause();this.musicMuted=true;}
    return this.musicMuted;
  }
  pauseMusic(){this.music?.pause();}
  resumeMusic(){if(!this.musicMuted && !document.hidden)void this.music?.play().catch(()=>{this.musicMuted=true;});}
  async toggle() {
    this.context ??= new AudioContext();
    await this.context.resume(); this.muted = !this.muted; return this.muted;
  }
  cue(kind) {
    if (this.muted || !this.context || this.context.state !== 'running' || document.hidden) return;
    const notes = kind === 'win' ? [440,554.37,659.25] : kind === 'loss' ? [293.66,246.94] : [392,440];
    notes.forEach((frequency,index) => {
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      const start = this.context.currentTime + index * .075;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.055,start + .015);
      gain.gain.exponentialRampToValueAtTime(.001,start + .28);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(start); oscillator.stop(start + .3);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
  destroy() { void this.context?.close();if(this.music){this.music.pause();this.music.removeAttribute('src');this.music.load();} }
}
