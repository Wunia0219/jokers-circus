import test from 'node:test';
import assert from 'node:assert/strict';
import {CasinoBot,casinoBotSettings} from '../server/discord/casino-bot.js';
import {highlightAnnouncement} from '../server/discord/highlight-card.js';
import {casinoPreviewMessage} from '../server/discord/casino-preview.js';
import {handleCommand} from '../server/discord/commands.js';
import {completeDeferredCommand} from '../server/discord/deferred-command.js';
const guild='100000000000000001',channel='100000000000000002',applicationId='100000000000000003',token='isolated-bot-token-'.repeat(3);
function fixture({identity=applicationId,destination=guild,send}={}){
  const calls=[];let now=1000;
  const bot=new CasinoBot({guild,channel,applicationId,token,clock:()=>now,fetchImpl:async(url,options)=>{
    calls.push({url,options});assert.equal(options.headers.Authorization,'Bot '+token);assert.equal(options.redirect,'error');
    if(url.endsWith('/users/@me'))return Response.json({id:identity,bot:true});
    if(url.endsWith('/channels/'+channel))return Response.json({id:channel,guild_id:destination,type:0});
    return send?send(options):Response.json({id:'100000000000000004',channel_id:channel});
  }});return {bot,calls,advance(ms){now+=ms;}};
}
test('bot REST posts individual wins and pings only the verified recipient',async()=>{
  const recipient='100000000000000009',f=fixture(),payload=highlightAnnouncement({name:'@everyone',user:recipient,tier:'mega',multiplier:100});
  assert.equal('flags' in payload,false);assert.doesNotMatch(JSON.stringify(payload),/10 分鐘/);
  assert.match(payload.embeds[0].image.url,/\/announcements\/mega-win-[a-f0-9]+\.webp$/);
  assert.equal((await f.bot.send(payload,'win:1')).kind,'sent');assert.equal((await f.bot.send(payload,'win:1')).kind,'sent');
  const posts=f.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body));
  assert.equal(posts[0].nonce,posts[1].nonce);assert.equal(posts[0].enforce_nonce,true);assert.deepEqual(posts[0].allowed_mentions,{parse:[],users:[recipient]});assert.equal('username' in posts[0],false);
  assert.ok(posts[0].content.includes(`<@${recipient}>`));assert.doesNotMatch(posts[0].content,/@everyone/);
  assert.equal(posts[0].components[0].components[0].label,'開啟遊戲');
  await f.bot.send({content:'@everyone <@&100000000000000099>',allowed_mentions:{parse:['everyone','roles','users'],roles:['100000000000000099'],users:['bad',recipient,recipient]}},'negative');
  const last=JSON.parse(f.calls.at(-1).options.body);assert.deepEqual(last.allowed_mentions,{parse:[],users:[recipient]});
  assert.equal(last.components,undefined);
});
test('wrong bot or guild never receives a message',async()=>{
  for(const options of [{identity:'100000000000000008'},{destination:'100000000000000009'}]){
    const f=fixture(options);assert.equal((await f.bot.send({content:'test'},'one')).kind,'retry');assert.equal(f.calls.some(c=>c.options.method==='POST'),false);
  }
});
test('test preview uploads a real receipt only through the original private interaction reply',async()=>{
  const user='100000000000000009';
  const interaction={type:2,application_id:applicationId,token:'isolated-interaction-token',guild_id:guild,
    channel_id:channel,member:{user:{id:user}},data:{name:'推播預覽',options:[{name:'樣式',value:'loss'}]}};
  const wallet={store:{environment:'test',backend:'firestore',validate:(g,u)=>assert.deepEqual([g,u],[guild,user])},
    commandChannelIds:[channel],casinoPreview:true};
  const handle=(i,w=wallet)=>handleCommand(i,w.store,[],w.commandChannelIds,w);
  assert.equal((await handle(interaction)).data.flags,64);
  assert.equal((await handle({...interaction,channel_id:user})).data.receipt,undefined);
  assert.equal((await handle(interaction,{...wallet,store:{...wallet.store,environment:'production'}})).data.receipt,undefined);
  assert.equal(await completeDeferredCommand(interaction,wallet,{fetchImpl:async(url,options)=>{
    assert.equal(url,`https://discord.com/api/v10/webhooks/${applicationId}/${interaction.token}/messages/@original`);
    assert.equal(options.method,'PATCH');
    const data=JSON.parse(options.body.get('payload_json'));
    assert.deepEqual(data.allowed_mentions,{parse:[]});
    assert.equal(data.receipt,undefined);
    assert.equal(data.embeds[0].image.url,'attachment://casino-receipt.png');
    assert.equal(data.components[0].components[0].label,'開啟遊戲');
    assert.equal(data.attachments[0].description,'這次獲得 −320 戲籌 · 總遊玩 16 局');
    const file=options.body.get('files[0]'),bytes=Buffer.from(await file.arrayBuffer());
    assert.equal(file.type,'image/png');
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    return Response.json({});
  }}),true);
  const f=fixture();
  assert.equal((await f.bot.send(casinoPreviewMessage('gain'),'visit:receipt')).kind,'sent');
  const sent=JSON.parse(f.calls.at(-1).options.body.get('payload_json'));
  assert.equal(sent.enforce_nonce,true);assert.ok(sent.nonce);
});
test('framed previews launch for any member in the game channel without granting chips',async()=>{
  const user='100000000000000009', anotherMember='100000000000000008';
  const store={environment:'test',backend:'firestore',validate:(g,u)=>{
    assert.equal(g,guild);
    assert.ok([user,anotherMember].includes(u));
  }};
  const interaction={type:2,guild_id:guild,channel_id:channel,member:{user:{id:user}},
    data:{name:'推播預覽'}};
  for(const choice of ['big','super','mega','gain','loss','even','grant','enter','idle']){
    const preview=await handleCommand({...interaction,data:{...interaction.data,options:[{name:'樣式',value:choice}]}},
      store,[],[channel],{casinoPreview:true});
    assert.equal(preview.data.flags,64);
    assert.deepEqual(preview.data.allowed_mentions,{parse:[]});
    if(['enter','idle'].includes(choice)){
      assert.equal(preview.data.components,undefined);
      continue;
    }
    const button=preview.data.components.at(-1).components[0];
    assert.equal(button.label,'開啟遊戲');
    const click={...interaction,type:3,member:{user:{id:anotherMember}},
      data:{component_type:2,custom_id:button.custom_id}};
    assert.deepEqual(await handleCommand(click,store,[],[channel]),{type:12});
    assert.equal((await handleCommand({...click,channel_id:anotherMember},store,[],[channel])).type,4);
    assert.equal((await handleCommand(click,store)).type,4);
    assert.equal((await handleCommand({...click,type:5},store,[],[channel])).type,4);
  }
});
test('provider rate limits are honored without shortening long waits; uncertain network writes are quarantined',async()=>{
  const f=fixture({send:()=>Response.json({retry_after:900},{status:429})});
  assert.equal((await f.bot.send({content:'test'},'one')).delay,900000);const n=f.calls.length;f.advance(1000);assert.equal((await f.bot.send({},'two')).kind,'retry');assert.equal(f.calls.length,n);
  const lost=fixture({send:()=>{throw new Error('network');}});assert.equal((await lost.bot.send({},'one')).kind,'uncertain');
});
test('feature requires explicit bot configuration and defaults off',()=>{
  const store={guildIds:new Set([guild]),assertGuild:g=>assert.equal(g,guild)};
  assert.equal(casinoBotSettings({},store),null);assert.throws(()=>casinoBotSettings({DISCORD_CASINO_ENABLED:'true'},store));
  const settings=casinoBotSettings({DISCORD_CASINO_ENABLED:'true',DISCORD_CLIENT_ID:applicationId,DISCORD_CASINO_CHANNEL_ID:channel,DISCORD_BOT_TOKEN:token},store);assert.equal(settings.guild,guild);
});
