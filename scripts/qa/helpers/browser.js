import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {availableParallelism,totalmem} from 'node:os';

const require=createRequire(import.meta.url);
export const browserOptions=()=>{
  const channel=process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  // Use the same pinned Chromium in its full new-headless mode on Windows.
  // The separate headless shell stalled control commands during animated QA
  // on Windows ARM running x64 Chromium. Keep all input checks unchanged.
  const bundledChannel=process.platform==='win32'?'chromium':undefined;
  return {channel:channel==='bundled'?bundledChannel:channel||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--mute-audio']};
};

export async function launchBrowser(){
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
  const options=browserOptions(),browser=await chromium.launch(options);
  try{
    let graphics,session;
    try{
      session=await browser.newBrowserCDPSession();
      const {gpu}=await session.send('SystemInfo.getInfo');
      graphics={devices:gpu.devices.map(({vendorString,deviceString,driverVendor,driverVersion})=>({vendorString,deviceString,driverVendor,driverVersion})),features:gpu.featureStatus};
    }catch{graphics={unavailable:true};}
    finally{try{await session?.detach();}catch{ /* Optional diagnostics must not affect verification. */ }}
    mkdirSync('test-results',{recursive:true});
    writeFileSync('test-results/browser-runtime.json',JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,channel:options.channel??'chromium-headless-shell',browser:browser.version(),projectPlaywright:require('playwright/package.json').version,moduleOverride:!!process.env.PLAYWRIGHT_MODULE_PATH,machine:{cpus:availableParallelism(),memoryMiB:Math.round(totalmem()/1024/1024)},graphics},null,2)+'\n');
    return browser;
  }catch(error){await browser.close();throw error;}
}

export async function createQaServer(port,plugins,ignored=['**/test-results/**','**/data/**','**/backups/**']){
  const {createServer}=await import('vite');
  return createServer({configFile:false,envDir:false,plugins,server:{
    host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored},
  }});
}
