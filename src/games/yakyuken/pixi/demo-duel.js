// A repeatable choreography for visual review, not a probability model.
const DEMO_DEALER_MOVES = Object.freeze(['scissors','rock','paper']);
const BEATS = Object.freeze({rock:'scissors',scissors:'paper',paper:'rock'});

export function demoDuel(roundIndex, player) {
  if(!Number.isSafeInteger(roundIndex) || roundIndex<0 || !Object.hasOwn(BEATS,player))throw new Error('Invalid demonstration round');
  const dealer=DEMO_DEALER_MOVES[roundIndex%DEMO_DEALER_MOVES.length];
  return {player,dealer,outcome:player===dealer?'draw':BEATS[player]===dealer?'win':'loss'};
}
