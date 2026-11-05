import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscordTestHost} from '../src/platform/discord-test-host.js';
import {testSessionFetch} from '../src/platform/discord-test-activity.js';
import {downloadCG} from '../src/games/yakyuken/cg-download.js';

const location=new URL('https://100000000000000003.discordsays.com/?frame_id=f&instance_id=i&platform=desktop&guild_id=760012177326997544&channel_id=1564243344857632818');
const session={token:'old',environment:'test',discordTest:true,userId:'100000000000000011',guildId:'760012177326997544'};
test('persistent host retains SDK commands and renews only the same identity across documents',async()=>{
  let exchanges=0,expired=false;const links=[];
  const activity={session:{...session},user:{id:session.userId},sdk:{guildId:session.guildId,commands:{authorize:async()=>({code:'fixture'}),authenticate:async()=>({user:{id:session.userId,username:'fixture'}}),openExternalLink:async args=>{links.push(args);return {opened:true};}}}};
  const host=createDiscordTestHost({activity,location,clientId:'100000000000000003',fetchImpl:async(path,opts)=>{
    if(path==='/api/token'){exchanges++;return Response.json({access_token:'fixture-token',session:{...session,token:'new'}});}
    if(expired&&opts.headers.Authorization==='Bearer old')return Response.json({}, {status:401});
    return Response.json({guild:session.guildId,user:session.userId,player:`d_${session.guildId}_${session.userId}`});
  }});
  const first=await host.connect(new URL('/yakyuken-preview.html'+location.search,location));expired=true;
  const second=await host.connect(new URL('/slot/'+location.search,location));
  assert.equal(first.sdk,second.sdk);assert.equal(second.session.token,'new');assert.equal(exchanges,1);
  await second.sdk.commands.openExternalLink({url:'https://example.com'});assert.equal(links.length,1);
  for(const target of [new URL('https://evil.example/slot/'+location.search),new URL('/slot/?frame_id=wrong',location),new URL('/cg-download.html'+location.search,location)])await assert.rejects(()=>host.connect(target),/範圍/);
});
test('test slot renewal retries the exact pending body once and refuses identity changes',async()=>{
  const calls=[],activity={session:{...session},reauthorize:async()=>({...session,token:'new'})};
  const fetch=testSessionFetch(activity,async(path,options)=>{calls.push({path,...options});return Response.json({}, {status:calls.length===1?401:200});});
  const body=JSON.stringify({requestId:'fixed-request-id',bet:100});await fetch('/api/spin',{method:'POST',headers:{Authorization:'Bearer old'},body});
  assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[1].headers.Authorization,'Bearer new');
  const wrong={session:{...session},reauthorize:async()=>({...session,userId:'100000000000000012'})};
  await assert.rejects(()=>testSessionFetch(wrong,async()=>Response.json({}, {status:401}))('/api/spin',{headers:{},body}),/身分不符/);
});
test('CG uses a fixed HTTPS download page without wallet or launch secrets and handles cancellation',async()=>{
  const calls=[],archive={isUnlocked:(_,i)=>i===1};let opened=true;
  const activity={mode:'discord',sdk:{commands:{openExternalLink:async args=>{calls.push(args.url);return {opened};}}}};
  assert.equal(await downloadCG(archive,'dealer',0,activity),false);assert.equal(calls.length,0);
  assert.equal(await downloadCG(archive,'dealer',1,activity),true);
  assert.equal(calls[0],'https://jokers-circus-gallery.pages.dev/cg/yakyuken/dealer/first-win');
  opened=false;assert.equal(await downloadCG(archive,'dealer',1,activity),false);
  await assert.rejects(()=>downloadCG(archive,'dealer',1,{mode:'discord'}),/下載連線/);
});
