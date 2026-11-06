import {resolve} from 'node:path';
import base from '../../vite.config.js';
import {securityHeaders,contentSecurityPolicy} from '../../server/http/security-headers.js';

// Dedicated test builds have extra entry chunks. Cache their verified hashed
// assets with one rule instead of exceeding Cloudflare's 100-rule limit.
export function discordTestBuildOptions(outDir,clientId){
  return {...base,configFile:false,envDir:false,plugins:[{
    name:'discord-test-headers',generateBundle(_,bundle){
      for(const name of Object.keys(bundle).filter(name=>name.startsWith('assets/')))if(!/^assets\/[\w.-]+-[\w-]{8}\.[a-z0-9]+$/.test(name))throw new Error('Unversioned test asset cannot use immutable cache');
      this.emitFile({type:'asset',fileName:'_headers',source:'/*\n'+Object.entries({...securityHeaders,'Content-Security-Policy':contentSecurityPolicy}).map(([key,value])=>`  ${key}: ${value}`).join('\n')+'\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n'});
    },
  }],define:{
    'import.meta.env.VITE_DISCORD_CLIENT_ID':JSON.stringify(clientId),'import.meta.env.VITE_DISCORD_AUTH_ENABLED':JSON.stringify('true'),'import.meta.env.VITE_DISCORD_WALLET_ENABLED':JSON.stringify('true'),
    'import.meta.env.VITE_DISCORD_TEST_ACTIVITY':JSON.stringify('true'),'import.meta.env.VITE_YAKYUKEN_CLOUD_TEST':JSON.stringify('false'),
  },build:{...base.build,outDir,emptyOutDir:true,rollupOptions:{input:{slot:resolve('index.html'),lobby:resolve('yakyuken-preview.html'),shell:resolve('discord-test-shell.html'),download:resolve('cg-download.html')}}}};
}
