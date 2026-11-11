import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {assertProductionArtifact} from './production-boundary.js';
import base from '../../vite.config.js';

const rejectTestContent={
  name:'arcade-release-isolation',
  generateBundle(_,bundle){
    const sources=[...this.getModuleIds()].map(id=>id.replaceAll('\\','/'));
    if(sources.some(id=>/\/discord-test-|\/test-wallet-client\.js/.test(id)))throw new Error('Test module in arcade release');
    for(const entry of Object.values(bundle)){
      const source=entry.type==='chunk'?entry.code:entry.source;
      if(typeof source==='string'&&/slot-game-203db|1567875182792544256|\/api\/playtest|discord-test-session/.test(source))
        throw new Error('Test credentials or routes in arcade release');
    }
  },
};
const lobbyIsolation={
  name:'arcade-teaser-isolation',
  generateBundle(_,bundle){
    for(const id of this.getModuleIds()){
      if(/\/games\/yakyuken\/|\/yakyuken-cover/i.test(id.replaceAll('\\','/')))throw new Error('Feature included in teaser graph');
    }
    for(const entry of Object.values(bundle)){
      const source=entry.type==='chunk'?entry.code:entry.source;
      if(typeof source==='string'&&/野球拳|yakyuken|cg-download|\/arcade\/feature\//i.test(source))
        throw new Error('Feature leaked in teaser output');
    }
  },
};
export async function buildArcadeRelease({clientId,outDir=resolve('dist-arcade'),legacy=null,logLevel}){
  if(!/^\d{17,20}$/.test(clientId??''))throw new Error('Set VITE_DISCORD_CLIENT_ID to the target Discord Application ID');
  const flags={
    'import.meta.env.VITE_DISCORD_CLIENT_ID':JSON.stringify(clientId),
    'import.meta.env.VITE_DISCORD_AUTH_ENABLED':'"true"',
    'import.meta.env.VITE_DISCORD_WALLET_ENABLED':'"true"',
  };
  if(legacy===outDir||legacy?.startsWith(outDir+'\\')||legacy?.startsWith(outDir+'/'))
    throw new Error('Save the previous slot release outside dist before rebuilding');
  const legacyAssets=legacy?readdirSync(join(legacy,'assets')).map(name=>['assets/'+name,readFileSync(join(legacy,'assets',name))]):[];
  assertProductionArtifact(legacyAssets);
  await build({...base,configFile:false,logLevel,define:flags,build:{...base.build,outDir}});
  const buildEntry=(entry,prefix,plugins)=>build({
    configFile:false,envDir:false,publicDir:false,logLevel,base:prefix,define:flags,plugins:[rejectTestContent,...plugins],
    build:{...base.build,outDir:resolve(outDir,'.'+prefix),emptyOutDir:false,
      rollupOptions:{input:resolve(entry)}},
  });
  await buildEntry('lobby.html','/arcade/',[lobbyIsolation]);
  await buildEntry('play.html','/arcade/feature/',[]);
  copyFileSync('images/lobby/yakyuken-cover-v3.webp',join(outDir,'arcade/feature/cover.webp'));

  // Old open tabs still request hashed assets from their own bundle.
  mkdirSync(join(outDir,'assets'),{recursive:true});
  for(const [name,source] of legacyAssets){
    const target=join(outDir,name);
    if(existsSync(target)){
      if(!readFileSync(target).equals(source))throw new Error('Conflicting immutable asset '+name);
    }else copyFileSync(join(legacy,name),target);
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--legacy'))throw new Error('Usage: npm run arcade:build -- [--legacy PREVIOUS_DIST]');
  await buildArcadeRelease({clientId:process.env.VITE_DISCORD_CLIENT_ID,legacy:args[1]?resolve(args[1]):null});
}
