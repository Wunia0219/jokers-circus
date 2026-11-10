import {build} from 'vite';
import {copyFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ALL_CG} from '../../src/games/yakyuken/cg-catalog.js';
import {securityHeaders,contentSecurityPolicy} from '../../server/http/security-headers.js';

// Isolated static-only output: no Worker, wallet, credentials or game bundles.
export async function buildCGGallery(){
  const outDir=resolve('test-results/cg-gallery-dist');
  await build({configFile:false,envDir:false,publicDir:false,build:{outDir,emptyOutDir:true,
    target:['chrome107','edge107','firefox104','safari16'],rollupOptions:{input:resolve('cg-download.html')}}});
  for(const art of ALL_CG){
    const page=resolve(outDir,'.'+art.path),image=resolve(outDir,'.'+art.image);
    mkdirSync(page,{recursive:true});mkdirSync(dirname(image),{recursive:true});
    copyFileSync(resolve(outDir,'cg-download.html'),resolve(page,'index.html'));
    copyFileSync(resolve('public','.'+art.download),image);
  }
  copyFileSync(resolve(outDir,'cg-download.html'),resolve(outDir,'index.html'));
  copyFileSync(resolve(outDir,'cg-download.html'),resolve(outDir,'404.html'));
  writeFileSync(resolve(outDir,'_headers'),'/*\n'+Object.entries({...securityHeaders,'Content-Security-Policy':contentSecurityPolicy,'Referrer-Policy':'no-referrer'}).map(([key,value])=>`  ${key}: ${value}`).join('\n')+'\n');
  return outDir;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)await buildCGGallery();
