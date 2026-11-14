import test from 'node:test';
import assert from 'node:assert/strict';
import {CasinoBot,casinoBotSettings} from '../server/discord/casino-bot.js';
import {highlightAnnouncement} from '../server/discord/highlight-card.js';
import {visitMessage} from '../server/discord/casino-visits.js';
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
  assert.equal(payload.embeds[0].image.url,'attachment://mega-win.png');
  assert.equal((await f.bot.send(payload,'win:1')).kind,'sent');assert.equal((await f.bot.send(payload,'win:1')).kind,'sent');
  const posts=f.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body.get('payload_json')));
  assert.equal(posts[0].nonce,posts[1].nonce);assert.equal(posts[0].enforce_nonce,true);assert.deepEqual(posts[0].allowed_mentions,{parse:[],users:[recipient]});assert.equal('username' in posts[0],false);
  assert.ok(posts[0].content.includes(`<@${recipient}>`));assert.doesNotMatch(posts[0].content,/@everyone/);
  assert.equal(posts[0].components[0].components[0].label,'開啟遊戲');
  assert.equal(posts[0].components[0].components[0].style,1);
  await f.bot.send({content:'@everyone <@&100000000000000099>',allowed_mentions:{parse:['everyone','roles','users'],roles:['100000000000000099'],users:['bad',recipient,recipient]}},'negative');
  const last=JSON.parse(f.calls.at(-1).options.body);assert.deepEqual(last.allowed_mentions,{parse:[],users:[recipient]});
  assert.equal(last.components,undefined);
});
test('wrong bot or guild never receives a message',async()=>{
  for(const options of [{identity:'100000000000000008'},{destination:'100000000000000009'}]){
    const f=fixture(options);assert.equal((await f.bot.send({content:'test'},'one')).kind,'retry');assert.equal(f.calls.some(c=>c.options.method==='POST'),false);
  }
});
test('new cards upload only to the original private reply, with accessible text and the rendered image',async()=>{
  const user='100000000000000009';
  const interaction={type:2,application_id:applicationId,token:'isolated-interaction-token',guild_id:guild,
    channel_id:channel,member:{user:{id:user}},data:{name:'推播預覽',options:[{name:'樣式',value:'exit-mixed'}]}};
  const wallet={store:{environment:'test',backend:'firestore',validate:(g,u)=>assert.deepEqual([g,u],[guild,user])},
    commandChannelIds:[channel],casinoPreview:true};
  const handle=(i,w=wallet)=>handleCommand(i,w.store,[],w.commandChannelIds,w);
  assert.equal((await handle(interaction)).data.flags,64);
  for(const [i,w] of [[{...interaction,channel_id:user},wallet],
    [interaction,{...wallet,store:{...wallet.store,environment:'production'}}],
    [interaction,{...wallet,casinoPreview:false}],
    [{...interaction,data:{...interaction.data,options:[{name:'樣式',value:'loss'}]}},wallet]]){
    assert.equal((await handle(i,w)).data.previewCard,undefined);
  }
  const samples={
    'exit-mixed':['本次戲籌變化 +2,400','老虎機 12 局：−600','野球拳 入場 2 場 · 通關 1 場：+3,000'],
    'exit-slot':['本次戲籌變化 −850','老虎機 18 局：−850'],
    'exit-duel':['本次戲籌變化 0','野球拳 入場 5 場 · 通關 1 場：0'],
    'clear-dealer':['命運荷官','累積 2 勝','2,500'], 'clear-youran':['優然','累積 3 勝','5,000'],
    'clear-xiache':['夏澄','累積 5 勝','10,000'], 'clear-selo':['瑟洛','累積 7 勝','25,000'],
    'clear-wanshi':['萬世','累積 9 勝','50,000'],
  };
  const uploads=new Set();
  for(const [choice,fragments] of Object.entries(samples)){
    const i={...interaction,data:{...interaction.data,options:[{name:'樣式',value:choice}]}};
    assert.equal(await completeDeferredCommand(i,wallet,{fetchImpl:async(url,options)=>{
      assert.equal(url,`https://discord.com/api/v10/webhooks/${applicationId}/${i.token}/messages/@original`);
      assert.equal(options.method,'PATCH');
      const data=JSON.parse(options.body.get('payload_json'));
      assert.deepEqual(data.allowed_mentions,{parse:[]});
      assert.equal(data.previewCard,undefined);
      assert.equal(data.embeds[0].image.url,`attachment://${choice}.webp`);
      assert.equal(data.components[0].components[0].label,'開啟遊戲');
      const alt=data.attachments[0].description;
      for(const fragment of fragments)assert.ok(alt.includes(fragment),alt);
      const file=options.body.get('files[0]'),bytes=Buffer.from(await file.arrayBuffer());
      assert.equal(file.name,`${choice}.webp`);assert.equal(file.type,'image/webp');
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,16),'WEBPVP8L');
      assert.ok(bytes.length<512*1024);
      uploads.add(bytes.toString('base64'));
      return Response.json({});
    }}),true);
  }
  assert.equal(uploads.size,8);
});
test('existing casino visit receipts still send through the bot',async()=>{
  const f=fixture();
  const start={net:0,rounds:0,bet:0,payout:0,balance:1506};
  assert.equal((await f.bot.send(visitMessage({name:'測試玩家',start},
    {net:1498,rounds:43,bet:2000,payout:3498,balance:3004},'closed'),'visit:receipt')).kind,'sent');
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
  for(const choice of ['big','super','mega','exit-mixed','exit-slot','exit-duel','clear-wanshi','grant','enter','idle']){
    const preview=await handleCommand({...interaction,data:{...interaction.data,options:[{name:'樣式',value:choice}]}},
      store,[],[channel],{casinoPreview:true});
    assert.equal(preview.data.flags,64);
    assert.deepEqual(preview.data.allowed_mentions,{parse:[]});
    if(['enter','idle','grant'].includes(choice)){
      assert.equal(preview.data.components,undefined);
      continue;
    }
    const button=preview.data.components.at(-1).components[0];
    assert.equal(button.label,'開啟遊戲');
    assert.equal(button.style,1);
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
test('the grant preview attaches the sample receipt to the private reply without a ping',async()=>{
  const user='100000000000000009';
  const interaction={type:2,application_id:applicationId,token:'isolated-interaction-token',guild_id:guild,
    channel_id:channel,member:{user:{id:user}},data:{name:'推播預覽',options:[{name:'樣式',value:'grant'}]}};
  const wallet={store:{environment:'test',backend:'firestore',validate:()=>{}},commandChannelIds:[channel],casinoPreview:true};
  assert.equal(await completeDeferredCommand(interaction,wallet,{fetchImpl:async(url,options)=>{
    assert.match(url,/\/messages\/@original$/);
    assert.equal(options.method,'PATCH');
    const data=JSON.parse(options.body.get('payload_json'));
    assert.match(data.content,/^<@100000000000000009>/);
    assert.deepEqual(data.allowed_mentions,{parse:[]});
    assert.equal(data.embeds[0].image.url,'attachment://casino-grant.png');
    assert.equal(data.attachments[0].description,'這次獲得 +500 戲籌');
    assert.equal(data.components,undefined);
    assert.equal(options.body.get('files[0]').type,'image/png');
    return Response.json({});
  }}),true);
});
