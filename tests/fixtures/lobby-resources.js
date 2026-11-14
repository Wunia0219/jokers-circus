import {Application,Assets} from 'pixi.js';
import {createArcadeLobbyView} from '../../src/platform/arcade-lobby-view.js';

const originalLoad=Assets.load.bind(Assets),originalUnload=Assets.unload.bind(Assets),originalInit=Application.prototype.init;
const live=new Set(),gate=Promise.withResolvers();
const options=globalThis.lobbyOptions,controller=new AbortController();
let loads=0,renderer,view;
Assets.load=async url=>{
  const index=++loads;
  if(index===1&&options.failAsset)throw new Error('isolated image failure');
  const texture=await originalLoad(url);live.add(url);
  if(index===2&&options.holdAsset){globalThis.lobbyPhase='asset';await gate.promise;}
  return texture;
};
Assets.unload=async url=>{await originalUnload(url);live.delete(url);};
Application.prototype.init=async function(settings){
  if(options.failRenderer)throw new Error('isolated renderer failure');
  await originalInit.call(this,settings);renderer=this;
  if(options.holdRenderer){globalThis.lobbyPhase='renderer';await gate.promise;}
};
globalThis.lobbyFixture={
  abort:()=>controller.abort(),
  release:()=>gate.resolve(),
  state:()=>({live:live.size,canvas:document.querySelectorAll('canvas').length,renderer:!!renderer?.renderer}),
  result:createArcadeLobbyView(document.getElementById('host'),controller.signal).then(value=>{
    view=value;view.show({slot:{}});return 'ready';
  },error=>error.name==='AbortError'?'aborted':error.message),
  loadCover:()=>view.loadCover('/images/lobby/yakyuken-cover-v3.webp'),
};
