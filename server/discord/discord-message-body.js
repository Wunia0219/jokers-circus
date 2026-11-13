import {RECEIPT_NAME, receiptSummary, renderCasinoReceipt} from './casino-receipt.js';
import {renderWinCard, winCardFilename} from './discord-win-card.js';

export function discordMessageBody(message) {
  const {receipt, winCard, ...payload} = message;
  if (!receipt && !winCard) return {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)};

  const {filename, description, png} = winCard ? {
    filename: winCardFilename(winCard.tier), description: winCard.description,
    png: renderWinCard(winCard.tier, winCard.value),
  } : {
    filename: RECEIPT_NAME, description: receiptSummary(receipt.net, receipt.rounds).description,
    png: renderCasinoReceipt(receipt.net, receipt.rounds),
  };
  const form = new FormData();
  payload.attachments = [{id: 0, filename, description}];
  form.set('payload_json', JSON.stringify(payload));
  form.set('files[0]', new Blob([png], {type: 'image/png'}), filename);
  return {body: form};
}
