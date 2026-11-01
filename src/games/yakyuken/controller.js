import {beginChallenge, freshPreview, playRound, PREVIEW_STORAGE_KEY, restorePreview} from './state.js';
import {randomMove} from './rules.js';

export class PreviewController {
  constructor({view, storage, chooseMove = randomMove}) {
    Object.assign(this, {view, storage, chooseMove});
    this.busy = false;
    this.disposed = false;
    this.abort = new AbortController();
    try { this.state = restorePreview(storage?.getItem(PREVIEW_STORAGE_KEY)); }
    catch { this.state = freshPreview(); this.storageUnavailable = true; }
    this.prepare();
    this.render();
  }

  prepare() { this.opponent = this.state.session?.status === 'playing' ? this.chooseMove() : null; }
  render() { this.view.render(this.state, {busy:this.busy, storageUnavailable:this.storageUnavailable}); }
  save(state) {
    this.state = state;
    try { this.storage?.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(state)); }
    catch { this.storageUnavailable = true; }
  }

  start() {
    if (this.busy || this.disposed) return false;
    this.save(beginChallenge(this.state));
    this.prepare(); this.render(); return true;
  }

  async play(player) {
    if (this.busy || this.disposed || this.state.session?.status !== 'playing') return false;
    // Validate before setting busy; no charge or random redraw on invalid input.
    const before = this.state, after = playRound(before, player, this.opponent);
    this.busy = true;
    // Commit once before presentation. Reloading cannot lose/repeat a reward.
    this.save(after);
    this.view.setBusy(true);
    try { await this.view.presentRound(before, after, this.abort.signal); }
    finally {
      this.busy = false;
      if (!this.disposed) { this.prepare(); this.render(); }
    }
    return true;
  }

  reset() {
    if (this.busy || this.disposed || this.state.session?.status === 'playing') return false;
    this.save(freshPreview()); this.prepare(); this.render(); return true;
  }

  destroy() { if (this.disposed) return; this.disposed = true; this.abort.abort(); this.view.destroy?.(); }
}
