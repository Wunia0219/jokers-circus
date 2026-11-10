import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {launchBrowser} from './helpers/browser.js';
import {ALL_CG,CG_ORIGIN} from '../../src/games/yakyuken/cg-catalog.js';

// Public static resources only; this check never authenticates or calls a wallet.
const output='test-results/cg-responsive',checks=[],requests=[],errors=[];
mkdirSync(output,{recursive:true});let browser;
try{
  browser=await launchBrowser();const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  for(const art of ALL_CG){
    const response=await page.goto(CG_ORIGIN+art.path);
    assert.equal(response.status(),200);assert.ok(response.headers()['content-security-policy']);
    await page.locator('#art').waitFor({state:'visible'});
    assert.equal(await page.locator('h1').textContent(),art.name);
    assert.equal(new URL(page.url()).hostname,new URL(CG_ORIGIN).hostname);
    assert.equal(new URL(page.url()).search,'');
    const event=page.waitForEvent('download');await page.getByRole('link',{name:'下載圖片',exact:true}).click();const download=await event;
    assert.equal(download.suggestedFilename(),art.filename);
    assert.deepEqual(readFileSync(await download.path()),readFileSync(`public${art.download}`));
    await page.screenshot({path:`${output}/live-${art.characterId}-${art.slug}.png`});checks.push({path:art.path,originalBytes:true});
  }
  assert.ok(requests.every(url=>new URL(url).origin===CG_ORIGIN),'gallery assets must all stay on Cloudflare Pages');
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/live-report.json`,JSON.stringify({ok:true,checks,requests,errors},null,2));
  console.log(JSON.stringify({ok:true,origin:CG_ORIGIN,downloads:checks.length,errors}));
}finally{await browser?.close();}
