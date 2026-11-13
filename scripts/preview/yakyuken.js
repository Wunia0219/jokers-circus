import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build, createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {playtestGateway,PLAYTEST_FS_DENY} from './yakyuken-test-gateway.js';

const root = fileURLToPath(new URL('../../',import.meta.url));
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--build','--cloud-test'].includes(arg))) throw new Error('Use no arguments, --cloud-test, or --build');
const cloudTest=args.includes('--cloud-test');
const shared = {root,configFile:false,envDir:false,
  cacheDir:resolve(root,'test-results/yakyuken-vite-cache'),
  optimizeDeps:{include:['pixi.js','pixi.js/unsafe-eval','pixi.js/prepare'],noDiscovery:true},
  define:{'import.meta.env.VITE_YAKYUKEN_CLOUD_TEST':JSON.stringify(cloudTest?'true':'false')},
};
if (args.includes('--build')) {
  await build({...shared,build:{
    target:['chrome107','edge107','firefox104','safari16'],
    outDir:resolve(root,'test-results/yakyuken-preview'),
    emptyOutDir:true,
    // This preview has its own entry and output; the release build is untouched.
    rollupOptions:{input:{lobby:resolve(root,'yakyuken-preview.html'),slot:resolve(root,'index.html')}},
  }});
} else {
  const gateway=cloudTest?playtestGateway(JSON.parse(readFileSync(resolve(root,'.tools/yakyuken-playtest.json'),'utf8'))):null;
  const server = await createServer({...shared,plugins:gateway?[{name:'dedicated-yakyuken-test',configureServer(server){server.middlewares.use(gateway);}}]:[],server:{host:'127.0.0.1',port:4195,strictPort:true,fs:{deny:PLAYTEST_FS_DENY}}});
  await server.listen();
  console.log('Yakyuken preview: http://127.0.0.1:4195/yakyuken-preview.html');
  const close = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT',close); process.once('SIGTERM',close);
}
