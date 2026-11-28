export const TEST_PARITY_PROFILE='test-parity';

export function testCommandProfile(env){
  const profile=env.DISCORD_COMMAND_PROFILE;
  return env.APP_ENV==='test'&&[TEST_PARITY_PROFILE,'test-simple'].includes(profile)?profile:null;
}

export function commandChannels(env){
  const ids=(env.DISCORD_COMMAND_CHANNEL_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(ids.some(id=>!/^\d{17,20}$/.test(id)))throw new Error('Invalid DISCORD_COMMAND_CHANNEL_IDS');
  return [...new Set(ids)];
}
