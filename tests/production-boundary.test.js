import test from 'node:test';
import assert from 'node:assert/strict';
import {productionBoundary,assertProductionArtifact,TEST_DISCORD_APP} from '../scripts/build/production-boundary.js';
import {assertArcadeArtifact} from '../scripts/build/arcade-artifact.js';
import {resolve} from 'node:path';

test('production artifacts reject test downloads, game text, cloud identities and unexpected entries',()=>{
  assert.doesNotThrow(()=>assertProductionArtifact([['index.html','slot'],['assets/index-12345678.js','slot'],['privacy.html','privacy']]));
  for(const file of [['downloads/yakyuken/dealer-stage-0.png','image'],['arcade/feature/youran-finale.png','image'],['yakyuken-preview.html','game'],['cg-download.html','cg'],['assets/dealer-12345678.js','野球拳'],['assets/app-12345678.js','slot-game-203db'],['assets/app-12345678.js','1567875182792544256'],['assets/app-12345678.js','/yakyuken-preview.html']])assert.throws(()=>assertProductionArtifact([file]));
});

test('production build removes test modules and cannot be switched to the test wallet by env flags',()=>{
  const plugin=productionBoundary(),config=plugin.config({}, {command:'build'});
  assert.equal(config.publicDir,false);assert.equal(config.define['import.meta.env.VITE_DISCORD_TEST_ACTIVITY'],'"false"');
  const importer=resolve('src/main.js'),id=plugin.resolveId('./platform/discord-test-activity.js',importer);
  assert.equal(id,plugin.resolveId('./platform/game-navigation.js',importer));assert.match(plugin.load(id),/discordTestBuild=false/);
  assert.throws(()=>plugin.generateBundle.call({getModuleIds:()=>[resolve('src/games/yakyuken/main.js')]},{},{}),/Test module/);
  const dev=productionBoundary();assert.equal(dev.config({}, {command:'serve'}),undefined);assert.equal(dev.resolveId('./platform/game-navigation.js',importer),undefined);
});

test('arcade audit verifies the loaded entry and keeps the test App out of production',()=>{
  const productionApp='1561284960986599626';
  const files=[
    ['index.html','<script src="/assets/index-12345678.js"></script>'],
    ['assets/index-12345678.js',JSON.stringify(TEST_DISCORD_APP)],
    ['arcade/lobby.html','<script src="/arcade/assets/lobby-12345678.js"></script>'],
    ['arcade/assets/lobby-12345678.js',JSON.stringify(TEST_DISCORD_APP)],
    ['arcade/feature/play.html','野球拳'],
    ['arcade/feature/cover.webp','cover'],
    ['arcade/feature/youran-finale.png','test CG original'],
  ];
  assert.doesNotThrow(()=>assertArcadeArtifact(files,TEST_DISCORD_APP));
  assert.throws(()=>assertArcadeArtifact(files,productionApp),/Test content/);
  assert.throws(()=>assertArcadeArtifact([...files,['arcade/assets/old-12345678.js','/arcade/feature/play.html']],TEST_DISCORD_APP),/expected to not match/i);
  const stale=[...files.filter(([name])=>name!=='arcade/lobby.html'),
    ['arcade/lobby.html','<script src="/arcade/assets/lobby-87654321.js"></script>'],
    ['arcade/assets/lobby-87654321.js',JSON.stringify(productionApp)]];
  assert.throws(()=>assertArcadeArtifact(stale,TEST_DISCORD_APP),/configured Discord Application ID/);
  const release=files.filter(([name])=>!name.endsWith('youran-finale.png')).map(([name,content])=>[name,content.replaceAll(TEST_DISCORD_APP,productionApp)]);
  assert.doesNotThrow(()=>assertArcadeArtifact(release,productionApp));
  for(const content of [TEST_DISCORD_APP,'https://jokers-circus-arcade-test.nini900219.workers.dev','/arcade/feature/youran-finale.png'])
    assert.throws(()=>assertArcadeArtifact([...release,['arcade/feature/assets/leak-12345678.js',content]],productionApp));
  assert.throws(()=>assertArcadeArtifact([...release,['arcade/feature/youran-finale.png','test image']],productionApp));
});
