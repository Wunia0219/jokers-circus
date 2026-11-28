import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletStore } from '../server/wallet/wallet.js';
import { WalletService } from '../server/wallet/wallet-service.js';
const guild='1441097301685698703',user='1561284960986599626';
test('sessions bind identity verified by Discord to an allowed guild, expire and recheck membership',async t=>{
 let now=Date.now(),member=true,nick='群內暱稱';
 const remembered=[];
 const store=new WalletStore({guildIds:[guild]});t.after(()=>store.close());
 const service=new WalletService(store,{clock:()=>now,onProfile:({guild,user,profile})=>remembered.push({guild,user,name:profile.name}),
   fetchImpl:async url=>url.endsWith('/users/@me')?Response.json({id:user,username:'account',global_name:'玩家名稱'}):member?Response.json({user:{id:user,global_name:'玩家名稱'},nick,pending:false}):Response.json({}, {status:404})});
 const token={access_token:'provider-secret',scope:'identify guilds.members.read',expires_in:3600};
 await assert.rejects(service.create(token,'123456789012345678'),/尚未開放/);
 const session=await service.create(token,guild);assert.equal(session.userId,user);assert.equal(session.guildId,guild);assert.ok(!JSON.stringify(session).includes('provider-secret'));
 await assert.rejects(service.authorize('Bearer forged'),/登入已過期/);
 assert.equal((await service.authorize('Bearer '+session.token)).user,user);
 assert.deepEqual((await service.authorize('Bearer '+session.token)).profile,{name:'群內暱稱'});
 assert.deepEqual(remembered,[{guild,user,name:'群內暱稱'}]);
 assert.ok(!Object.hasOwn(session,'profile'),'public session does not expose private delivery metadata');
 now+=301000;nick=null;
 assert.deepEqual((await service.authorize('Bearer '+session.token)).profile,{name:'玩家名稱'});
 assert.deepEqual(remembered.at(-1),{guild,user,name:'玩家名稱'});
 now+=301000;member=false;await assert.rejects(service.authorize('Bearer '+session.token),/無法確認/);
 await assert.rejects(service.authorize('Bearer '+session.token),/登入已過期/);
 member=true;const second=await service.create(token,guild);now+=3600001;await assert.rejects(service.authorize('Bearer '+second.token),/登入已過期/);
});
