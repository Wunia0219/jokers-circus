import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';

const productionPlatform='\0production-slot-platform';
const testImports=new Set(['src/platform/discord-test-activity.js','src/platform/game-navigation.js'].map(file=>resolve(file)));
const publicFiles=['privacy.html','terms.html','legal.css','game-entry.json',
  'announcements/big-win-22bea6e95a7a.webp','announcements/super-win-bebd0e262ee5.webp','announcements/mega-win-5f0adee4765d.webp'];
export function assertProductionArtifact(files){
  for(const [name,content] of files){
    if(!publicFiles.includes(name)&&name!=='index.html'&&name!=='_headers'&&!/^assets\/[\w.-]+-[\w-]{8}\.[a-z0-9]+$/.test(name))throw new Error('Unexpected production asset: '+name);
    if(/yakyuken|野球拳|discord-test|cg-download/i.test(name))throw new Error('Test asset in production: '+name);
    if(/\.(?:js|css|html)$/.test(name)&&/yakyuken|野球拳|slot-game-203db|1567875182792544256|discord-test-session|yakyuken-playtest/i.test(String(content)))throw new Error('Test content in production: '+name);
  }
}

// The dedicated Discord test build supplies its own plugins and entries. This
// default build ships only the slot game, even if a local .env enables testing.
export function productionBoundary(){
  let active=false;
  return {name:'production-slot-only',enforce:'pre',
    config(_,context){
      active=context.command==='build';
      if(active)return {publicDir:false,define:{'import.meta.env.VITE_DISCORD_TEST_ACTIVITY':JSON.stringify('false'),'import.meta.env.VITE_YAKYUKEN_CLOUD_TEST':JSON.stringify('false')}};
    },
    resolveId(source,importer){if(active&&importer&&testImports.has(resolve(dirname(importer),source)))return productionPlatform;},
    load(id){if(id===productionPlatform)return `
      export const discordTestBuild=false;
      export const discordTestMusic=()=>null;
      export const slotLobbyPath=()=>null;
      export const testSessionFetch=()=>undefined;
      export const connectDiscordTestActivity=()=>{throw new Error('This build only supports the production activity.');};
    `;},
    generateBundle(_,bundle){
      if(!active)return;
      for(const id of this.getModuleIds())if(/\/src\/(?:games\/yakyuken\/|platform\/discord-test-)/.test(id.replaceAll('\\','/')))throw new Error('Test module in production graph');
      const files=Object.entries(bundle).map(([name,entry])=>[name,entry.type==='chunk'?entry.code:entry.source]);
      for(const name of publicFiles){const source=readFileSync(resolve('public',name));files.push([name,source]);this.emitFile({type:'asset',fileName:name,source});}
      assertProductionArtifact(files);
    },
  };
}
