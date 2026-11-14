import {GRANT_RECEIPT_NAME, RECEIPT_NAME, grantReceiptAmount, receiptSummary, renderCasinoReceipt, renderGrantReceipt} from './casino-receipt.js';
import {renderWinCard, winCardFilename} from './discord-win-card.js';

export function discordMessageBody(message, previewArt) {
  const {receipt, winCard, grantReceipt, previewCard, ...payload} = message;
  if (!receipt && !winCard && !grantReceipt && !previewCard) return {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)};

  let attachment;
  if (winCard) attachment = {
    filename: winCardFilename(winCard.tier), description: winCard.description,
    bytes: renderWinCard(winCard.tier, winCard.value),
  };
  else if (grantReceipt) attachment = {
    filename: GRANT_RECEIPT_NAME, description: '這次獲得 ' + grantReceiptAmount(grantReceipt.amount) + ' 戲籌',
    bytes: renderGrantReceipt(grantReceipt.amount),
  };
  else if (previewCard) {
    if (!previewArt || !Object.hasOwn(previewArt, previewCard.key)) throw new Error('Unknown private preview asset');
    attachment = {filename: `${previewCard.key}.webp`, description: previewCard.description,
      bytes: Buffer.from(previewArt[previewCard.key], 'base64'), type: 'image/webp'};
  }
  else attachment = {
    filename: RECEIPT_NAME, description: receiptSummary(receipt.net, receipt.rounds).description,
    bytes: renderCasinoReceipt(receipt.net, receipt.rounds),
  };
  const {filename, description, bytes, type = 'image/png'} = attachment;
  const form = new FormData();
  payload.attachments = [{id: 0, filename, description}];
  form.set('payload_json', JSON.stringify(payload));
  form.set('files[0]', new Blob([bytes], {type}), filename);
  return {body: form};
}
