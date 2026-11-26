import {isActivityLaunch,launchActivity,readDiscordInteraction} from '../server/discord/commands.js';
import {commandChannels,simpleTestCommandsEnabled} from '../server/discord/discord-channel-scope.js';
import {walletValidation} from '../server/wallet/wallet-common.js';
import {walletSettings} from '../server/wallet/settings.js';
import {cloudIdentity} from './config.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function routeDiscordInteraction(request,env,forward){
  const origin=request.headers.get('origin');
  if(origin&&origin!==`https://${env.DISCORD_CLIENT_ID}.discordsays.com`)return json({error:'不允許的來源。'},403);
  if(request.method!=='POST')return json({error:'請使用 POST。'},405);

  try{
    const {interaction,raw}=await readDiscordInteraction(request.body??[],Object.fromEntries(request.headers),env.DISCORD_PUBLIC_KEY,env.DISCORD_CLIENT_ID);
    if(interaction.type===1)return json({type:1});
    if(isActivityLaunch(interaction)){
      const {environment}=cloudIdentity(env);
      const {guildIds}=walletSettings(env,{cloud:true});
      if(!guildIds.length||guildIds.some(id=>!/^\d{17,20}$/.test(id)))throw new Error('Invalid guild allowlist');
      const scope={environment,guildIds:new Set(guildIds),validate:walletValidation.validate,assertGuild:walletValidation.assertGuild};
      return json(launchActivity(interaction,scope,commandChannels(env),simpleTestCommandsEnabled(env)?'jct':'jc'));
    }
    // Keep the original signed bytes for the wallet service's own verification.
    return await forward(new Request(request,{body:raw}));
  }catch(error){
    if(error.walletProblem)return json({error:error.message},error.status);
    throw error;
  }
}
