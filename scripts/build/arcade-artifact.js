import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {assertProductionArtifact,TEST_DISCORD_APP} from './production-boundary.js';

export const arcadeAssetDirs=['assets','arcade/assets','arcade/feature/assets'];
const hashedAsset=/^[\w.-]+-[\w-]{8}\.[a-z0-9]+$/;
const arcadePages=['arcade/lobby.html','arcade/feature/play.html','arcade/feature/cover.webp'];
const testDownload='arcade/feature/youran-finale.png';
const testSeloDownload=/^arcade\/feature\/selo-stage-[1-7]\.png$/;

export function readReleaseFiles(root,path=''){
  return readdirSync(join(root,path),{withFileTypes:true}).flatMap(entry=>{
    const name=path?path+'/'+entry.name:entry.name;
    if(entry.isDirectory())return readReleaseFiles(root,name);
    assert.ok(entry.isFile(),'Release entries must be regular files: '+name);
    return [[name,readFileSync(join(root,name))]];
  });
}

export function assertArcadeAssets(files,{allowTestApp=false}={}){
  assertProductionArtifact(files.filter(([name])=>!name.startsWith('arcade/')),{allowTestApp});
  for(const [name,bytes] of files.filter(([path])=>path.startsWith('arcade/'))){
    const slash=name.lastIndexOf('/');
    assert.ok(arcadePages.includes(name)||allowTestApp&&(name===testDownload||testSeloDownload.test(name))||arcadeAssetDirs.includes(name.slice(0,slash))&&hashedAsset.test(name.slice(slash+1)),name);
    if(!/\.(?:js|css|html)$/.test(name))continue;
    const source=String(bytes);
    assert.doesNotMatch(source,/slot-game-203db|yakyuken-playtest|discord-test-session|\/api\/playtest/i);
    if(!allowTestApp){
      assert.ok(!source.includes(TEST_DISCORD_APP),'Test App in production arcade artifact');
      assert.doesNotMatch(source,/jokers-circus-arcade-test|youran-finale\.png/,'Test download in production arcade artifact');
    }
    if(!name.startsWith('arcade/feature/'))assert.doesNotMatch(source,/野球拳|yakyuken|cg-download|\/arcade\/feature\//i);
  }
}

export function assertEntryApp(files,page,clientId){
  const index=new Map(files);
  const entry=/\bsrc="\/([\w/.-]+\.js)"/.exec(String(index.get(page)))?.[1];
  assert.ok(entry&&new RegExp('\\b'+clientId+'\\b').test(String(index.get(entry))),page+' must use the configured Discord Application ID');
}

export function assertArcadeArtifact(files,clientId){
  assert.match(clientId??'',/^\d{17,20}$/);
  assertArcadeAssets(files,{allowTestApp:clientId===TEST_DISCORD_APP});
  const paths=new Set(files.map(([name])=>name));
  for(const name of arcadePages)assert.ok(paths.has(name),name+' missing');
  if(clientId===TEST_DISCORD_APP)assert.ok(paths.has(testDownload),testDownload+' missing');
  for(const page of ['index.html','arcade/lobby.html'])assertEntryApp(files,page,clientId);
}
