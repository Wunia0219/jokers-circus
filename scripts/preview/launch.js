import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {PLAYTEST_FS_DENY} from './yakyuken-test-gateway.js';
import {securityHeaders,contentSecurityPolicy} from '../../server/http/security-headers.js';

// A local art/animation review only: no SDK, login, game or wallet requests.
const html=readFileSync('discord-test-shell.html','utf8').replace('/src/platform/discord-test-shell.js','/__launch-review.js');
const script=`import {createLaunchScreen} from '/src/platform/launch-screen.js';
const choice=Number(new URLSearchParams(location.search).get('art'));
const preview=createLaunchScreen(document.querySelector('#launch-screen'),Number.isInteger(choice)&&choice>=1&&choice<=3?{random:()=>((choice-1)+.1)/3}:{});
addEventListener('pagehide',()=>preview.destroy(),{once:true});`;
const server=await createServer({configFile:false,envDir:false,optimizeDeps:{noDiscovery:true},plugins:[{
  name:'local-launch-review',configureServer(dev){dev.middlewares.use((req,res,next)=>{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path!=='/'&&path!=='/__launch-review.js')return next();
    res.writeHead(200,{...securityHeaders,'Content-Security-Policy':contentSecurityPolicy,'Content-Type':path==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
    res.end(path==='/'?html:script);
  });},
}],server:{host:'127.0.0.1',port:4205,strictPort:true,hmr:false,fs:{deny:PLAYTEST_FS_DENY},watch:{ignored:['**/test-results/**','**/data/**']}}});
await server.listen();console.log('Loading animation preview: http://127.0.0.1:4205/ (optional ?art=1, ?art=2, ?art=3)');
for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>{void server.close().then(()=>process.exit(0));});
