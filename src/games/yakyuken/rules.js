export const MOVES = Object.freeze(['rock','paper','scissors']);
export const MOVE_NAMES = Object.freeze({rock:'石頭',paper:'布',scissors:'剪刀'});

export function roundOutcome(player, dealer) {
  if (!MOVES.includes(player) || !MOVES.includes(dealer)) throw new Error('不支援的出拳');
  if (player === dealer) return 'draw';
  return (MOVES.indexOf(player) - MOVES.indexOf(dealer) + 3) % 3 === 1 ? 'win' : 'loss';
}

// Rejection sampling avoids modulo bias; choose before the player submits.
export function randomMove(cryptoSource = globalThis.crypto) {
  const values = new Uint32Array(1);
  const ceiling = Math.floor(2 ** 32 / MOVES.length) * MOVES.length;
  do { cryptoSource.getRandomValues(values); } while (values[0] >= ceiling);
  return MOVES[values[0] % MOVES.length];
}

function validateLimits(wins, losses) {
  if (!Number.isInteger(wins) || wins < 1 || wins > 100 || !Number.isInteger(losses) || losses < 1 || losses > 100) {
    throw new Error('勝利與失敗門檻必須是 1–100 的整數');
  }
}

// Independent fair RPS. Draws repeat, so decisive rounds are Bernoulli(1/2).
// DP also computes expected total throws, including draws.
export function challengeOdds(winsRequired, lossLimit) {
  validateLimits(winsRequired, lossLimit);
  const rows = Array.from({length:winsRequired + 1}, () => Array.from({length:lossLimit + 1}, () => ({clear:0, throws:0})));
  for (let l = 0; l < lossLimit; l++) rows[winsRequired][l].clear = 1;
  for (let w = winsRequired - 1; w >= 0; w--) {
    for (let l = lossLimit - 1; l >= 0; l--) {
      const win = rows[w + 1][l], loss = rows[w][l + 1];
      rows[w][l] = {clear:(win.clear + loss.clear) / 2, throws:1.5 + (win.throws + loss.throws) / 2};
    }
  }
  return rows[0][0];
}
