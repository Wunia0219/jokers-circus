import {clearPreviews} from './casino-preview-design.js';
import {playerMention,playerMentions} from './player-display.js';

export function duelAnnouncement(event){
  const card=clearPreviews.find(row=>row.characterId===event.characterId);
  if(!card||event.wins!==card.wins||event.reward!==card.reward||!playerMention(event.user))throw new Error('Invalid challenge announcement');
  return {content:`${playerMention(event.user)}，完成了${card.name}的挑戰！`,allowed_mentions:playerMentions([event.user]),
    embeds:[{title:card.title,description:`累積 ${event.wins} 勝，獲得 **${event.reward.toLocaleString('en-US')} 戲籌**。`,
      color:parseInt(card.ink.slice(1),16),image:{url:`attachment://${card.key}.webp`}}],
    previewCard:{key:card.key,description:card.alt}};
}
