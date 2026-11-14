import {DUEL_ENTRY_FEE} from './settlement-rules-v1.js';

const messages = Object.freeze({
  DUEL_BALANCE_LOW: `入場需要 ${DUEL_ENTRY_FEE.toLocaleString('en-US')} 戲籌，目前戲籌不足。`,
  DUEL_BALANCE_LIMIT: '目前戲籌已接近上限，暫時無法完成這次操作。請聯絡管理員。',
  DUEL_CLOSED: '目前暫停開放新場次，請稍後再來。',
  DUEL_MAINTENANCE: '野球拳維護中，請返回大廳。',
  DUEL_HAND: '對局進度已更新，請按「更新進度」。',
  DUEL_MATCH: '這場挑戰已結束，請按「更新進度」查看目前的紀錄。',
  DUEL_INPUT: '暫時無法確認這次出牌，請更新對局進度。',
  REQUEST_CONFLICT: '這次操作與先前的紀錄不一致，請更新對局進度。',
  FIRESTORE_BUDGET: '遊戲暫時無法使用，請等候恢復。重新開啟遊戲也無法立即恢復，若持續無法遊玩，請聯絡管理員。',
});

// Only reviewed copy reaches the UI. Network, SDK and server details stay internal.
const publicMessages = new Set([
  '請從 Discord 遊戲大廳開啟。',
  '暫時無法載入遊戲，請再試一次。',
  '暫時無法確認戲籌，請重新開啟遊戲。',
  '請先確認剛才的結果，再繼續遊戲。',
  '簽到尚未確認，請重試。',
  '登入資訊已更新，請關閉遊戲後重新開啟。',
  '目前畫面與對局紀錄不一致，請按「更新進度」。',
  '這場已在其他裝置更新，請按「更新進度」。',
]);

export function duelErrorMessage(error) {
  if (Object.hasOwn(messages, error?.code)) return messages[error.code];
  const message = String(error?.message || '');
  if (publicMessages.has(message)) return message;
  if (/^剛才的結果還在確認，請再試一次。\n回報碼 D-[-a-zA-Z0-9]{16,80}$/.test(message)) return message;
  if (error?.status === 401) return '登入已過期，請關閉遊戲後重新開啟。';
  if (error?.status === 403) return '暫時無法確認登入資訊，請從 Discord 遊戲頻道重新開啟。';
  if (error?.status === 429) return '請稍等幾秒，再試一次。';
  return '暫時無法完成，請再試一次。';
}
