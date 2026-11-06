export class Motion {
  tasks = new Set();
  stopped = false;
  reduced = false;
  suspended = false;
  to(target, values, duration = 220) {
    if (this.stopped) return Promise.resolve(false);
    this.cancel(target);
    if (this.reduced || this.suspended || duration <= 0) { Object.assign(target,values); return Promise.resolve(true); }
    return new Promise(resolve => {
      this.tasks.add({target,values,from:Object.fromEntries(Object.keys(values).map(key => [key,target[key]])),duration,elapsed:0,resolve});
    });
  }
  tick(elapsed) {
    for (const task of [...this.tasks]) {
      task.elapsed += Math.max(0,elapsed);
      const t = Math.min(1,task.elapsed / task.duration), eased = 1 - (1 - t) ** 3;
      for (const [key,value] of Object.entries(task.values)) task.target[key] = task.from[key] + (value - task.from[key]) * eased;
      if (t === 1) { this.tasks.delete(task); task.resolve(true); }
    }
  }
  cancel(target) {
    for (const task of [...this.tasks]) if (task.target === target) { this.tasks.delete(task);task.resolve(false); }
  }
  finish() {
    for (const task of this.tasks) { Object.assign(task.target,task.values);task.resolve(true); }
    this.tasks.clear();
  }
  destroy() { this.stopped = true;this.finish(); }
}
