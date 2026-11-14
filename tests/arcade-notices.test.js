import test from 'node:test';
import assert from 'node:assert/strict';
import {visitMessage} from '../server/discord/casino-visits.js';
import {arcadeReceiptSummary,renderArcadeReceipt} from '../server/discord/arcade-receipt.js';
import {duelAnnouncement} from '../server/discord/duel-announcement.js';
import {discordMessageBody} from '../server/discord/discord-message-body.js';
import {previewArt} from '../server/discord/casino-preview-art.js';
import {withAnnouncementLaunch} from '../server/discord/announcement-launch.js';
import {grantAnnouncement} from '../server/discord/grant-notification.js';

const user='100000000000000002',start={revision:100,net:300,rounds:8,bet:800,payout:1100,balance:9000};
test('real departure includes duel-only play, combined totals and current balance without invented rounds',()=>{
  const visit={user,start},end={...start,balance:15000,revision:106,duel:{entries:2,clears:1,net:3000}};
  const duel=visitMessage(visit,end,'closed');
  assert.equal(arcadeReceiptSummary(duel.arcadeReceipt).key,'exit-duel');assert.match(duel.embeds[0].description,/入場 2 場 · 通關 1 場：\+3,000/);
  assert.doesNotMatch(duel.embeds[0].description,/老虎機/);assert.match(duel.embeds[0].description,/15,000/);
  const mixed=visitMessage(visit,{...end,rounds:20,net:-300},'timeout');
  assert.equal(arcadeReceiptSummary(mixed.arcadeReceipt).net,2400);assert.match(mixed.content,/暫時離開/);
  assert.deepEqual(mixed.allowed_mentions,{parse:[],users:[user]});
  assert.equal(visitMessage(visit,{...start,duel:{entries:0,clears:0,net:0}},'closed').arcadeReceipt,undefined);
});
test('runtime receipt numbers change the actual attachment and fit valid large signed totals',()=>{
  const data={slot:{rounds:12,net:-600},duel:{entries:2,clears:1,net:3000}};
  const a=renderArcadeReceipt(data),b=renderArcadeReceipt({...data,duel:{entries:3,clears:1,net:2000}});
  assert.notDeepEqual(a,b);assert.equal(a.readUInt32BE(16),1000);assert.equal(a.readUInt32BE(20),488);
  assert.doesNotThrow(()=>renderArcadeReceipt({slot:{rounds:123456,net:-999999999999},duel:{entries:99999,clears:88888,net:999999999999}}));
  assert.throws(()=>renderArcadeReceipt({...data,slot:{rounds:-1,net:0}}));
  assert.throws(()=>renderArcadeReceipt({...data,duel:{entries:1,clears:1,net:NaN}}));
});
test('real clear cards reuse approved artwork but require authoritative role, reward and recipient',()=>{
  const event={characterId:'guest-4',wins:9,reward:50000,user};
  const message=duelAnnouncement(event),body=discordMessageBody(message,previewArt).body;
  assert.equal(body.get('files[0]').name,'clear-wanshi.webp');assert.match(message.content,new RegExp(user));
  assert.doesNotMatch(JSON.stringify(message),/示範玩家|測試範例/);
  for(const invalid of [{...event,user:'@everyone'},{...event,reward:999999},{...event,wins:8},{...event,characterId:'unknown'}])assert.throws(()=>duelAnnouncement(invalid));
});
test('real grants use the same receipt without a launch button and preserve safe mentions',()=>{
  const message=withAnnouncementLaunch(grantAnnouncement({user,amount:1234,reason:'@everyone **unsafe**',recordCode:'R-123'}));
  assert.equal(message.components,undefined);assert.equal(message.grantReceipt.amount,1234);
  const body=discordMessageBody(message).body,payload=JSON.parse(body.get('payload_json'));
  assert.deepEqual(payload.allowed_mentions,{parse:[],users:[user]});assert.equal(payload.grantReceipt,undefined);
  assert.match(payload.attachments[0].description,/1,234/);assert.doesNotMatch(payload.embeds[0].description,/@everyone/);
});
