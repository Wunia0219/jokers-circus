import {RECEIPT_NAME, receiptSummary, renderCasinoReceipt} from './casino-receipt.js';

export function discordMessageBody(message) {
  const {receipt, ...payload} = message;
  if (!receipt) return {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)};

  const {net, rounds} = receipt;
  const form = new FormData();
  payload.attachments = [{id: 0, filename: RECEIPT_NAME, description: receiptSummary(net, rounds).description}];
  form.set('payload_json', JSON.stringify(payload));
  form.set('files[0]', new Blob([renderCasinoReceipt(net, rounds)], {type: 'image/png'}), RECEIPT_NAME);
  return {body: form};
}
