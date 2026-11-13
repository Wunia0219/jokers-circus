import {GRANT_RECEIPT_NAME, RECEIPT_NAME, grantReceiptAmount, receiptSummary, renderCasinoReceipt, renderGrantReceipt} from './casino-receipt.js';
import {renderWinCard, winCardFilename} from './discord-win-card.js';

export function discordMessageBody(message) {
  const {receipt, winCard, grantReceipt, ...payload} = message;
  if (!receipt && !winCard && !grantReceipt) return {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)};

  let attachment;
  if (winCard) attachment = {
    filename: winCardFilename(winCard.tier), description: winCard.description,
    png: renderWinCard(winCard.tier, winCard.value),
  };
  else if (grantReceipt) attachment = {
    filename: GRANT_RECEIPT_NAME, description: '這次獲得 ' + grantReceiptAmount(grantReceipt.amount) + ' 戲籌',
    png: renderGrantReceipt(grantReceipt.amount),
  };
  else attachment = {
    filename: RECEIPT_NAME, description: receiptSummary(receipt.net, receipt.rounds).description,
    png: renderCasinoReceipt(receipt.net, receipt.rounds),
  };
  const {filename, description, png} = attachment;
  const form = new FormData();
  payload.attachments = [{id: 0, filename, description}];
  form.set('payload_json', JSON.stringify(payload));
  form.set('files[0]', new Blob([png], {type: 'image/png'}), filename);
  return {body: form};
}
