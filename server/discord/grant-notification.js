import {BOT_COLORS} from './bot-replies.js';
import {playerMention,playerMentions} from './player-display.js';

const escapeText=value=>String(value).replace(/@/g,'＠').replace(/[\\`*_{}\[\]()<>~|#]/g,'\\$&');

// Reuse the verified casino bot and its configured game channel. The form can
// choose whether to notify, but cannot choose a destination or message payload.
export function createGrantNotifier(bot,commandChannelIds){
  return async (interaction,result,requestId)=>{
    const entry=result.entry;
    if(!bot||bot.guild!==interaction.guild_id||!commandChannelIds.includes(bot.channel))return {kind:'unavailable'};
    if(result.duplicate||entry?.kind!=='grant'||entry.guild!==bot.guild||entry.actor!==interaction.member.user.id||!playerMention(entry.user))return {kind:'unavailable'};
    return bot.send({
      content:`${playerMention(entry.user)}，你收到 **${entry.delta.toLocaleString('en-US')} 戲籌**！`,
      embeds:[{title:'戲籌已發放',description:`發放原因：${escapeText(entry.reason)}`,color:BOT_COLORS.success}],
      allowed_mentions:playerMentions([entry.user]),
    },`grant:${entry.guild}:${requestId}`);
  };
}

export async function grantNotificationStatus(notify,result,interaction,requestId,notifyGrant){
  if(result.duplicate)return '本次未重複發送通知；如需確認原通知，請查看遊玩頻道。';
  if(!notify)return '未通知本人。';
  let delivery;
  try{delivery=await notifyGrant?.(interaction,result,requestId);}catch{delivery={kind:'uncertain'};}
  if(delivery?.kind==='sent')return '已在遊玩文字頻道發送通知並 @ 玩家（頻道成員皆可見）。';
  if(delivery?.kind==='uncertain')return '戲籌已入帳，通知是否送達尚未確認，請查看遊玩頻道；請勿重新發放。';
  return '戲籌已入帳，但通知未送出；請聯絡維護人員，請勿重新發放。';
}
