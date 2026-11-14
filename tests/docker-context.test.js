import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {build} from 'esbuild';

// Resolve real import graphs without executing a server or contacting a database.
const stages=readFileSync('Dockerfile','utf8').split(/^FROM .*$/m).slice(1);
function copiedSources(stage){
  return [...stage.matchAll(/^COPY (?!.*--from=)(.+)$/gm)].flatMap(([,line])=>line.trim().split(/\s+/).slice(0,-1));
}
function contains(sources,file){
  return sources.some(source=>{
    if(source.includes('*'))return new RegExp('^'+source.replaceAll('.','\\.').replaceAll('*','[^/]*')+'$').test(file);
    return file===source||statSync(source).isDirectory()&&file.startsWith(source+'/');
  });
}
for(const [index,entryPoints] of [[0,['vite.config.js']],[1,['server/index.js','scripts/admin/portable-backup.js','scripts/admin/wallet-recovery.js','scripts/admin/operations-status.js']]]){
  test(`Docker stage ${index+1} includes the complete local module graph`,async()=>{
    const {metafile}=await build({entryPoints,bundle:true,packages:'external',platform:'node',format:'esm',write:false,metafile:true,outdir:'unused',logLevel:'silent'});
    const sources=copiedSources(stages[index]);
    for(const file of Object.keys(metafile.inputs))assert.ok(contains(sources,file),'Docker COPY is missing '+file);
    const omitted=sources.filter(source=>!source.startsWith(index===0?'scripts/build':'src/games/yakyuken'));
    assert.ok(Object.keys(metafile.inputs).some(file=>!contains(omitted,file)),'The check must catch the omitted release dependency');
  });
}
