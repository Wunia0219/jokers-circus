import {visitMessage} from './casino-visits.js';
import {highlightAnnouncement} from './highlight-card.js';
import {grantAnnouncement} from './grant-notification.js';

export const casinoPreviewCommand = {
  name: '推播預覽', description: '看看命運荷官的推播，只有你看得到', type: 1,
  options: [{
    name: '樣式', description: '選一種推播來看看', type: 3, required: true,
    choices: [
      {name: '入場', value: 'enter'}, {name: '沒下注就離場', value: 'idle'},
      {name: '這次賺了', value: 'gain'}, {name: '這次賠了', value: 'loss'},
      {name: '這次打平', value: 'even'}, {name: 'BIG WIN', value: 'big'},
      {name: 'SUPER WIN', value: 'super'}, {name: 'MEGA WIN', value: 'mega'},
      {name: '獲得戲籌', value: 'grant'},
    ],
  }],
};

const start = {net: 0, rounds: 0, bet: 0, payout: 0, balance: 1506};
const visit = {name: '測試玩家', start};
const results = {
  idle: start,
  gain: {net: 1498, rounds: 43, bet: 2000, payout: 3498, balance: 3004},
  loss: {net: -320, rounds: 16, bet: 320, payout: 0, balance: 1186},
  even: {net: 0, rounds: 8, bet: 160, payout: 160, balance: 1506},
};
const wins = {big: 15, super: 48, mega: 128};

export function casinoPreviewMessage(choice) {
  if (choice === 'enter') return visitMessage(visit);
  if (choice === 'grant') return grantAnnouncement({name: visit.name, amount: 500, reason: '活動獎勵', recordCode: '測試範例'});
  if (Object.hasOwn(results, choice)) return visitMessage(visit, results[choice], 'closed');
  if (Object.hasOwn(wins, choice)) {
    return highlightAnnouncement({name: visit.name, tier: choice, multiplier: wins[choice]});
  }
  return null;
}
