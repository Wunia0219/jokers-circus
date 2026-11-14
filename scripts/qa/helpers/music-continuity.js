import assert from 'node:assert/strict';

// Position wraps at a natural loop. Observe real timeupdate progress and reject
// explicit seeks/reloads instead of requiring a monotonically increasing clock.
export function assertMusicContinuity(before,after){
  assert.equal(after.count,1,'one original soundtrack player');
  assert.equal(after.paused,false,'soundtrack keeps playing');
  for(const key of ['pauses','positionWrites','empties','source'])assert.equal(after[key],before[key],`soundtrack ${key} unchanged`);
  assert.ok(after.advances>before.advances,'the original track advances through child navigation');
}
