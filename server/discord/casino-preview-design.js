import {DUEL_ENTRY_FEE, DUEL_RULES} from '../../src/games/yakyuken/settlement-rules-v1.js';

const roles = [
  ['dealer', 'dealer', '命運荷官', '#f6cc8d', '#2a141e', '#98394d', 'I', '35%', '-1%'],
  ['youran', 'guest-1', '優然', '#f5caa1', '#291b14', '#985732', 'II', '36%', '0%'],
  ['xiache', 'guest-2', '夏澄', '#c9e4cc', '#142724', '#427b66', 'III', '36%', '-1%'],
  ['selo', 'guest-3', '瑟洛', '#e6c8ef', '#221b31', '#755393', 'IV', '35%', '0%'],
  ['wanshi', 'guest-4', '萬世', '#d5e1f5', '#151f32', '#496c9d', 'V', '34%', '0%'],
];

const number = new Intl.NumberFormat('en-US');
const signed = value => (value > 0 ? '+' : value < 0 ? '−' : '') + number.format(Math.abs(value));
const tone = value => value > 0 ? 'gain' : value < 0 ? 'loss' : 'even';
export const clearPreviews = roles.map(([portrait, id, name, ink, base, halo, serial, pos, top]) => {
  const {reward, winsRequired: wins} = DUEL_RULES[id];
  const title = `野球拳・${name}通關`;
  const description = `示範玩家累積 ${wins} 勝，獲得 **${number.format(reward)} 戲籌**。`;
  return {key: `clear-${portrait}`, label: `野球拳通關｜${name}`, title, description,
    alt: `${title} · 累積 ${wins} 勝 · 通關獎金 ${number.format(reward)} 戲籌`,
    portrait, name, wins, ink, base, halo, serial, pos, top};
});

const slot = (rounds, bet, payout) => ({name: '老虎機', icon: 'slot', count: `${rounds} 局`, net: payout - bet});
const duel = (entries, clears, payout) => ({name: '野球拳', icon: 'duel', count: `入場 ${entries} 場 · 通關 ${clears} 場`, net: payout - entries * DUEL_ENTRY_FEE});
const youranReward = DUEL_RULES['guest-1'].reward;
export const exitPreviews = [
  ['exit-mixed', '老虎機 ＋ 野球拳', [slot(12, 1200, 600), duel(2, 1, youranReward)]],
  ['exit-slot', '只玩老虎機', [slot(18, 1800, 950)]],
  ['exit-duel', '只玩野球拳', [duel(5, 1, youranReward)]],
].map(([key, scenario, games]) => {
  const net = games.reduce((sum, game) => sum + game.net, 0);
  const summary = `本次戲籌變化 ${signed(net)} 戲籌`;
  const rows = games.map(game => ({...game, amount: signed(game.net), tone: tone(game.net)}));
  const details = rows.map(({name, count, amount}) => `${name} ${count}：${amount} 戲籌`);
  return {key, label: `離場收據｜${scenario}`, title: '賭場・離場結算',
    description: `本次戲籌變化 **${signed(net)} 戲籌**\n${details.join('\n')}`,
    alt: [summary, ...details].join('；'), net: signed(net), tone: tone(net), rows};
});
