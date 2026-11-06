export const MOVES = Object.freeze(['rock','paper','scissors']);
export const MOVE_NAMES = Object.freeze({rock:'石頭',paper:'布',scissors:'剪刀'});

export function roundOutcome(player, dealer) {
  if (!MOVES.includes(player) || !MOVES.includes(dealer)) throw new Error('不支援的出拳');
  if (player === dealer) return 'draw';
  return (MOVES.indexOf(player) - MOVES.indexOf(dealer) + 3) % 3 === 1 ? 'win' : 'loss';
}
