import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build, createServer} from 'vite';

const root = fileURLToPath(new URL('../../',import.meta.url));
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--build')) throw new Error('Use no arguments to serve or --build for isolated validation');
const shared = {root,configFile:false,envDir:false};
if (args.includes('--build')) {
  await build({...shared,build:{
    target:['chrome107','edge107','firefox104','safari16'],
    outDir:resolve(root,'test-results/yakyuken-preview'),
    emptyOutDir:true,
    // This preview has its own entry and output; the release build is untouched.
    rollupOptions:{input:resolve(root,'yakyuken-preview.html')},
  }});
} else {
  const server = await createServer({...shared,server:{host:'127.0.0.1',port:4195,strictPort:true}});
  await server.listen();
  console.log('Yakyuken preview: http://127.0.0.1:4195/yakyuken-preview.html');
  const close = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT',close); process.once('SIGTERM',close);
}
