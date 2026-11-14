import {visitMessage} from './casino-visits.js';
import {highlightAnnouncement} from './highlight-card.js';
import {grantAnnouncement} from './grant-notification.js';
import {receiptColors} from './casino-receipt.js';
import {clearPreviews, exitPreviews} from './casino-preview-design.js';
import {ARCADE_RECEIPT_NAME,arcadeReceiptSummary} from './arcade-receipt.js';

const previews = [...clearPreviews, ...exitPreviews];

export const casinoPreviewCommand = {
  name: '推播預覽', description: '看看命運荷官的推播，只有你看得到', type: 1,
  options: [{
    name: '樣式', description: '選一種推播來看看', type: 3, required: true,
    choices: [
      {name: '入場', value: 'enter'}, {name: '沒下注就離場', value: 'idle'},
      ...previews.map(({key, label}) => ({name: label, value: key})),
      {name: 'BIG WIN', value: 'big'},
      {name: 'SUPER WIN', value: 'super'}, {name: 'MEGA WIN', value: 'mega'},
      {name: '獲得戲籌', value: 'grant'},
    ],
  }],
};

const start = {net: 0, rounds: 0, bet: 0, payout: 0, balance: 1506};
const visit = {name: '測試玩家', start};
const wins = {big: 15, super: 48, mega: 128};

export function casinoPreviewMessage(choice,{user}={}) {
  if (choice === 'enter') return visitMessage(visit);
  if (choice === 'idle') return visitMessage(visit, start, 'closed');
  const sample = previews.find(({key}) => key === choice);
  if(sample?.rows){
    const arcadeReceipt={slot:sample.rows.find(r=>r.icon==='slot')??{rounds:0,net:0},duel:sample.rows.find(r=>r.icon==='duel')??{entries:0,clears:0,net:0}};
    const summary=arcadeReceiptSummary(arcadeReceipt);
    return {embeds:[{title:sample.title,description:summary.description.replaceAll('；','\n'),color:receiptColors[summary.tone],image:{url:`attachment://${ARCADE_RECEIPT_NAME}`}}],arcadeReceipt};
  }
  if (sample) return {
    embeds: [{title: sample.title, description: sample.description,
      color: Number.parseInt((sample.ink ?? '#e0b681').slice(1), 16), image: {url: `attachment://${sample.key}.webp`}}],
    previewCard: {key: sample.key, description: sample.alt},
  };
  if (choice === 'grant') {
    return grantAnnouncement({name:visit.name,user,amount:500,reason:'活動獎勵',recordCode:'測試範例'});
  }
  if (Object.hasOwn(wins, choice)) {
    return highlightAnnouncement({name: visit.name, tier: choice, multiplier: wins[choice]});
  }
  return null;
}
