import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

test('maintained documentation links resolve after file reorganization',()=>{
  const files=['README.md','AGENTS.md',...readdirSync('docs',{recursive:true}).filter(path=>path.endsWith('.md')).map(path=>'docs/'+path)];
  const missing=[];
  for(const file of files){
    const text=readFileSync(file,'utf8');
    for(const [,target] of text.matchAll(/\]\(([^)]+)\)/g)){
      if(/^(?:https?:|mailto:|#)/.test(target))continue;
      const path=target.split('#')[0];
      if(path&&!existsSync(resolve(dirname(file),path)))missing.push(`${file}: ${target}`);
    }
  }
  assert.deepEqual(missing,[]);
});
