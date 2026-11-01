// Preview-only musical feedback. Does not import the slot game's audio cues.
export class PreviewAudio {
  muted = true;
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
  destroy() { void this.context?.close(); }
}
