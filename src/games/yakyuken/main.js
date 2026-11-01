import './yakyuken.css';
import {preloadArt} from './assets.js';
import {PreviewAudio} from './audio.js';
import {PreviewController} from './controller.js';
import {mountScene} from './scene.js';

const root = document.querySelector('#yakyuken-app');
const view = mountScene(root,new PreviewAudio());
let storage;
try { storage = sessionStorage; } catch { /* Preview remains playable in memory. */ }
const controller = new PreviewController({view,storage});
view.bind(controller);
if (!storage) controller.storageUnavailable = true;
try { await preloadArt(); view.ready(); }
catch (error) { view.fail(error.message); }
// Vite HMR and page teardown own all listeners and audio resources.
addEventListener('pagehide',event => { if (!event.persisted) controller.destroy(); },{once:true});
if (import.meta.hot) import.meta.hot.dispose(() => controller.destroy());
