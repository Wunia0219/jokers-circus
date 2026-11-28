import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {routeDiscordInteraction} from '../cloud/discord-interactions.js';

const guild='100000000000000001',user='100000000000000002',channel='100000000000000003',client='100000000000000004';
const keys=generateKeyPairSync('ed25519');
const env={CLOUD_PLAN:'paid',APP_ENV:'production',FIRESTORE_PROJECT_ID:'demo-circus',FIRESTORE_NAMESPACE:'demo-production',
  DISCORD_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex'),
  DISCORD_CLIENT_ID:client,ALLOWED_GUILD_IDS:guild,DISCORD_COMMAND_CHANNEL_IDS:channel};
const button={type:3,application_id:client,guild_id:guild,channel_id:channel,member:{user:{id:user}},
  data:{component_type:2,custom_id:'casino:open-game'}};
const panel=owner=>({...button,data:{component_type:2,custom_id:`jc|go|${guild}|${owner}`}});
const entry={...button,type:2,data:{type:4,name:'啟動'}};
function request(payload,headers={}){
  const body=JSON.stringify(payload,null,2),timestamp=String(Math.floor(Date.now()/1000));
  return new Request('https://fixture.invalid/api/interactions',{method:'POST',body,headers:{
    'x-signature-timestamp':timestamp,'x-signature-ed25519':sign(null,Buffer.from(timestamp+body),keys.privateKey).toString('hex'),...headers}});
}

test('all Discord launch controls respond while a signed wallet command is still blocked',{timeout:3000},async()=>{
  const started=Promise.withResolvers(),backend=Promise.withResolvers();
  const command={...button,type:2,data:{type:1,name:'戲籌'}};
  const pending=routeDiscordInteraction(request(command),env,async req=>{
    started.resolve(await req.text());
    return backend.promise;
  });
  try{
    assert.equal(await started.promise,JSON.stringify(command,null,2));
    for(const interaction of [button,panel(user),entry]){
      const reply=await routeDiscordInteraction(request(interaction),env,()=>assert.fail('launch contacted the wallet'));
      assert.equal(reply.status,200);
      assert.deepEqual(await reply.json(),{type:12});
    }
  }finally{
    backend.resolve(new Response(null,{status:503}));
    assert.equal((await pending).status,503);
  }
});

test('edge launch enforces the signature, app, origin, channel, guild and panel owner',async()=>{
  const invoke=(payload,headers={},settings=env)=>routeDiscordInteraction(request(payload,headers),settings,()=>assert.fail('unexpected wallet call'));
  assert.equal((await invoke(button,{'x-signature-ed25519':'00'.repeat(64)})).status,401);
  assert.equal((await invoke({...button,application_id:user})).status,403);
  assert.equal((await invoke(button,{origin:'https://fixture.invalid'})).status,403);
  for(const denied of [panel(channel),{...entry,guild_id:user},{...button,channel_id:user},{...button,member:{user:{id:user,bot:true}}}]){
    const reply=await (await invoke(denied)).json();
    assert.equal(reply.type,4);
    assert.equal(reply.data.flags,64);
  }
  assert.equal((await (await invoke(button,{},{...env,DISCORD_COMMAND_CHANNEL_IDS:''})).json()).type,4);
  const testEnv={...env,APP_ENV:'test',FIRESTORE_NAMESPACE:'demo-test',DISCORD_COMMAND_PROFILE:'test-parity'};
  const testPanel={...button,data:{component_type:2,custom_id:`jct|go|${guild}|${user}`}};
  assert.equal((await (await invoke(testPanel)).json()).type,4);
  assert.deepEqual(await (await invoke(testPanel,{},testEnv)).json(),{type:12});
});
