import {copyFileSync,existsSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {productionBoundary,TEST_DISCORD_APP,PRODUCTION_DISCORD_APP} from './production-boundary.js';
import {arcadeAssetDirs,assertArcadeAssets,readReleaseFiles} from './arcade-artifact.js';
import {launchScreenMarkup} from './launch-screen-markup.js';
import base from '../../vite.config.js';

const rejectTestContent=allowTestApp=>({
  name:'arcade-release-isolation',
  generateBundle(_,bundle){
    const sources=[...this.getModuleIds()].map(id=>id.replaceAll('\\','/'));
    if(sources.some(id=>/\/discord-test-|\/test-wallet-client\.js/.test(id)))throw new Error('Test module in arcade release');
    for(const entry of Object.values(bundle)){
      const source=entry.type==='chunk'?entry.code:entry.source;
      if(typeof source==='string'&&(/slot-game-203db|\/api\/playtest|discord-test-session/.test(source)||
        !allowTestApp&&(source.includes(TEST_DISCORD_APP)||/jokers-circus-arcade-test|youran-finale\.png/.test(source))))
        throw new Error('Test credentials or routes in arcade release');
    }
  },
});
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
export async function buildArcadeRelease({clientId,legacy=null,logLevel,target='test',outDir=resolve(target==='production'?'dist':target==='production-arcade'?'dist-arcade-production':'dist-arcade-test')}){
  if(!/^\d{17,20}$/.test(clientId??''))throw new Error('Set VITE_DISCORD_CLIENT_ID to the target Discord Application ID');
  const allowTestApp=target==='test';
  const slotOnly=target==='production';
  if(!['test','production','production-arcade'].includes(target)||clientId!==(allowTestApp?TEST_DISCORD_APP:PRODUCTION_DISCORD_APP))
    throw new Error('Discord Application ID does not match the arcade build target');
  const flags={
    'import.meta.env.VITE_DISCORD_CLIENT_ID':JSON.stringify(clientId),
    'import.meta.env.VITE_DISCORD_AUTH_ENABLED':'"true"',
    'import.meta.env.VITE_DISCORD_WALLET_ENABLED':'"true"',
  };
  const retained=legacy?realpathSync(legacy):null;
  if(retained){
    const output=existsSync(outDir)?realpathSync(outDir):resolve(outDir);
    const path=relative(output,retained);
    if(!isAbsolute(path)&&path!=='..'&&!path.startsWith('..'+sep))
      throw new Error('Save the previous release outside the output directory before rebuilding');
  }
  const legacyAssets=retained?(slotOnly?['assets']:arcadeAssetDirs).filter(dir=>existsSync(join(retained,dir))).flatMap(dir=>readReleaseFiles(retained,dir)):[];
  assertArcadeAssets(legacyAssets,{allowTestApp});
  const plugins=allowTestApp?base.plugins.map(plugin=>plugin.name==='production-slot-only'?productionBoundary({allowTestApp}):plugin):base.plugins;
  await build({...base,plugins,configFile:false,logLevel,define:flags,build:{...base.build,outDir}});
  const buildEntry=(entry,prefix,plugins,{define={},resolve:resolveOptions}={})=>build({
    configFile:false,envDir:false,publicDir:false,logLevel,base:prefix,define:{...flags,...define},resolve:resolveOptions,
    plugins:[rejectTestContent(allowTestApp),...plugins],
    build:{...base.build,outDir:resolve(outDir,'.'+prefix),emptyOutDir:false,
      rollupOptions:{input:resolve(entry)}},
  });
  if(!slotOnly){
    await buildEntry('lobby.html','/arcade/',[launchScreenMarkup,lobbyIsolation]);
    await buildEntry('play.html','/arcade/feature/',[],allowTestApp?{
      define:{'import.meta.env.VITE_ARCADE_TEST_DOWNLOADS':'"true"'},
      resolve:{alias:{'../../../images/yakyuken/youran/stage-3.webp':resolve('images/yakyuken/youran/stage-3-towel.webp')}},
    }:{define:{'import.meta.env.VITE_ARCADE_TEST_DOWNLOADS':'"false"'}});
    copyFileSync('images/lobby/yakyuken-cover-v3.webp',join(outDir,'arcade/feature/cover.webp'));
    if(allowTestApp){
      copyFileSync('art/yakyuken/youran/redesign/youran-stage-3-towel.png',join(outDir,'arcade/feature/youran-finale.png'));
      for(let stage=1;stage<=7;stage++){
        const file=`selo-stage-${stage}.png`;
        copyFileSync(join('public/downloads/yakyuken',file),join(outDir,'arcade/feature',file));
      }
    }
  }

  // Old open tabs still request hashed assets from their own bundle.
  for(const [name,source] of legacyAssets){
    const target=join(outDir,name);
    if(existsSync(target)){
      if(!readFileSync(target).equals(source))throw new Error('Conflicting immutable asset '+name);
    }else writeFileSync(target,source,{flag:'wx'});
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i+=2){
    if(!['--target','--legacy'].includes(args[i])||!args[i+1]||options[args[i]])throw new Error('Usage: npm run arcade:build -- [--target test|production|production-arcade] [--legacy PREVIOUS_DIST]');
    options[args[i]]=args[i+1];
  }
  const clientId=process.env.VITE_DISCORD_CLIENT_ID;
  await buildArcadeRelease({clientId,target:options['--target']??(clientId===TEST_DISCORD_APP?'test':'production'),legacy:options['--legacy']?resolve(options['--legacy']):null});
}
