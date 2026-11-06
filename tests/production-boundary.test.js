import test from 'node:test';
import assert from 'node:assert/strict';
import {productionBoundary,assertProductionArtifact} from '../scripts/build/production-boundary.js';
import {resolve} from 'node:path';

test('production artifacts reject test downloads, game text, cloud identities and unexpected entries',()=>{
  assert.doesNotThrow(()=>assertProductionArtifact([['index.html','slot'],['assets/index-12345678.js','slot'],['privacy.html','privacy']]));
  for(const file of [['downloads/yakyuken/dealer-stage-0.png','image'],['yakyuken-preview.html','game'],['cg-download.html','cg'],['assets/dealer-12345678.js','野球拳'],['assets/app-12345678.js','slot-game-203db'],['assets/app-12345678.js','1567875182792544256'],['assets/app-12345678.js','/yakyuken-preview.html']])assert.throws(()=>assertProductionArtifact([file]));
});

test('production build removes test modules and cannot be switched to the test wallet by env flags',()=>{
  const plugin=productionBoundary(),config=plugin.config({}, {command:'build'});
  assert.equal(config.publicDir,false);assert.equal(config.define['import.meta.env.VITE_DISCORD_TEST_ACTIVITY'],'"false"');
  const importer=resolve('src/main.js'),id=plugin.resolveId('./platform/discord-test-activity.js',importer);
  assert.equal(id,plugin.resolveId('./platform/game-navigation.js',importer));assert.match(plugin.load(id),/discordTestBuild=false/);
  assert.throws(()=>plugin.generateBundle.call({getModuleIds:()=>[resolve('src/games/yakyuken/main.js')]},{},{}),/Test module/);
  const dev=productionBoundary();assert.equal(dev.config({}, {command:'serve'}),undefined);assert.equal(dev.resolveId('./platform/game-navigation.js',importer),undefined);
});
