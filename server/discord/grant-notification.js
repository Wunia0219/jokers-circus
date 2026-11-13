import {BOT_COLORS} from './bot-replies.js';
import {playerMention,playerMentions,playerName} from './player-display.js';

const escapeText=value=>String(value).replace(/@/g,'＠').replace(/[\\`*_{}\[\]()<>~|#]/g,'\\$&');

export function grantAnnouncement({name, user, amount, reason, recordCode}) {
  return {
    content:`${playerMention(user)??playerName(name)}，你收到 **${amount.toLocaleString('en-US')} 戲籌**！`,
    embeds:[{title:'戲籌已發放',description:`發放原因：${escapeText(reason)}`,color:BOT_COLORS.success,footer:{text:'紀錄編號：'+recordCode}}],
    allowed_mentions:playerMentions([user]),
  };
}

// Reuse the verified casino bot and its configured game channel. The form can
// choose whether to notify, but cannot choose a destination or message payload.
export class GrantNotifications {
  constructor({bot,commandChannelIds,state}){Object.assign(this,{bot,commandChannelIds,state});this.pending=new Map();}
  key(guild,id){if(!/^\d{17,20}$/.test(guild)||!/^[1-9]\d{0,15}$/.test(String(id)))throw new Error('Invalid grant notice identity');return `grant-notice:${guild}:${id}`;}
  run(key,work){const task=(this.pending.get(key)||Promise.resolve()).catch(()=>{}).then(work);this.pending.set(key,task);return task.finally(()=>{if(this.pending.get(key)===task)this.pending.delete(key);});}
  valid(interaction){return this.bot&&this.bot.guild===interaction.guild_id&&this.commandChannelIds.includes(this.bot.channel);}
  async notify(interaction,result,requestId){
    const bot=this.bot;
    const entry=result.entry;
    if(!this.valid(interaction))return {kind:'unavailable'};
    if(result.duplicate||entry?.kind!=='grant'||entry.guild!==bot.guild||entry.actor!==interaction.member.user.id||!playerMention(entry.user))return {kind:'unavailable'};
    const key=this.key(entry.guild,entry.id);
    return this.run(key,async()=>{
      const saved=this.state.get(key);if(saved)return {kind:saved.revoked?'cancelled':'uncertain'};
      const notice={guild:entry.guild,entryId:entry.id,user:entry.user,channel:bot.channel,applicationId:bot.applicationId,status:'sending',revoked:false};
      this.state.set(key,notice); // Persist intent before POST; never blindly repost after a crash.
      let delivery;try{delivery=await bot.send(grantAnnouncement({
        user:entry.user,amount:entry.delta,reason:entry.reason,recordCode:result.recordCode||'#'+entry.id,
      }),`grant:${entry.guild}:${requestId}`);}catch{delivery={kind:'uncertain'};}
      this.state.set(key,{...notice,status:delivery.kind,...(delivery.kind==='sent'?{messageId:delivery.messageId}:{})});return delivery;
    });
  }
  async remove(interaction,result){
    const entry=result.entry;
    if(!this.valid(interaction)||entry?.kind!=='reversal'||entry.guild!==interaction.guild_id||entry.actor!==interaction.member.user.id)return {kind:'unavailable'};
    const key=this.key(entry.guild,entry.reference);
    return this.run(key,async()=>{
      let notice=this.state.get(key);
      if(!notice){this.state.set(key,{guild:entry.guild,entryId:Number(entry.reference),user:entry.user,revoked:true,status:'legacy'});return {kind:'legacy'};}
      if(notice.user!==entry.user)return {kind:'unavailable'};
      notice={...notice,revoked:true};this.state.set(key,notice);return this.erase(key,notice);
    });
  }
  async retry(interaction,id){
    if(!this.valid(interaction))return {kind:'unavailable'};
    const key=this.key(interaction.guild_id,id);
    return this.run(key,async()=>{const notice=this.state.get(key);return notice?.revoked?this.erase(key,notice):{kind:'unavailable'};});
  }
  async erase(key,notice){
    if(notice.status==='deleted')return {kind:'deleted'};
    if(!notice.messageId)return {kind:['sending','uncertain'].includes(notice.status)?'uncertain':notice.status==='legacy'?'legacy':'none'};
    if(notice.guild!==this.bot.guild||notice.channel!==this.bot.channel||notice.applicationId!==this.bot.applicationId)return {kind:'unavailable'};
    const result=await this.bot.removeMessage(notice.messageId);
    this.state.set(key,{...notice,status:result.kind==='deleted'?'deleted':'delete-pending'});return result;
  }
}

export function createGrantNotifier(bot,commandChannelIds){
  const values=new Map(),state={get:key=>values.get(key),set:(key,value)=>values.set(key,value)};
  const notices=new GrantNotifications({bot,commandChannelIds,state});return notices.notify.bind(notices);
}

export async function grantNotificationStatus(notify,result,interaction,requestId,notifyGrant){
  if(result.duplicate)return '本次未重複發送通知；如需確認原通知，請查看遊玩頻道。';
  if(!notify)return '未通知本人。';
  let delivery;
  try{delivery=await notifyGrant?.(interaction,result,requestId);}catch{delivery={kind:'uncertain'};}
  if(delivery?.kind==='sent')return '已在遊玩文字頻道發送通知並 @ 玩家（頻道成員皆可見）。';
  if(delivery?.kind==='cancelled')return '這筆發放已被收回，未發送通知。';
  if(delivery?.kind==='uncertain')return '戲籌已入帳，通知是否送達尚未確認，請查看遊玩頻道；請勿重新發放。';
  return '戲籌已入帳，但通知未送出；請聯絡維護人員，請勿重新發放。';
}

export async function revokeNotificationStatus(interaction,result,remove){
  let delivery;try{delivery=await remove?.(interaction,result);}catch{delivery={kind:'retry'};}
  return deletionStatus(delivery);
}
export function deletionStatus(delivery){
  if(delivery?.kind==='deleted')return {message:'對應的 @ 通知已刪除。',retry:false};
  if(delivery?.kind==='none')return {message:'本筆未發送通知，無需刪除。',retry:false};
  if(delivery?.kind==='uncertain')return {message:'戲籌已收回，但原通知送達狀態不明，請人工確認遊玩頻道。',retry:false};
  if(!delivery||delivery.kind==='legacy')return {message:'戲籌已收回。本筆未保存可自動刪除的通知紀錄；舊版通知需人工確認。',retry:false};
  return {message:'戲籌已收回，但通知尚未刪除；可重試刪除通知，不會再次扣除戲籌。',retry:true};
}
