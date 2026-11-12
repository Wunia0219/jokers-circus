import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {chromium} from 'playwright';
import {browserOptions} from './helpers/browser.js';

const key=randomBytes(32).toString('hex');
const guild='100000000000000001',player='100000000000000002';
const mf=new Miniflare(convertV4MiniflareOptions({
  modules:true,scriptPath:process.env.TEST_CLOUD_BUNDLE||'test-results/cloud-bundle/worker.js',compatibilityDate:'2026-07-30',
  compatibilityFlags:['nodejs_compat'],
  bindings:{ARCADE_RELEASE_ENABLED:'true',ARCADE_CONSOLE_TOKEN:key},
  outboundService:()=>{throw new Error('Console UI fixture only uses loopback');},
}));
let browser;
try{
  const origin=(await mf.ready).origin;
  browser=await chromium.launch(browserOptions());
  const context=await browser.newContext({viewport:{width:1200,height:930},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const status={
    environment:'test',mode:'active',ready:true,guilds:[guild],
    entry:{slot:'open',feature:'hidden',featureTitle:'野球拳',revision:0},
    backup:{at:Date.parse('2026-11-10T10:00:00Z'),running:false,retryAt:null},
  };
  let lookups=0,changes=0;
  await page.route('**/__operator/*',async route=>{
    const request=route.request(),action=new URL(request.url()).pathname.split('/').at(-1);
    if(request.headers().authorization!=='Bearer '+key)
      return route.fulfill({status:401,json:{error:'管理金鑰有誤，請重新登入。'}});
    if(action==='entry'){
      const {game,mode,revision}=request.postDataJSON();
      assert.equal(revision,status.entry.revision);
      status.entry[game]=mode;
      status.entry.revision++;
      changes++;
    }
    if(action==='report'){
      assert.deepEqual(request.postDataJSON(),{guild,player,code:'S-runtime-original-spin-0001'});
      lookups++;
      return route.fulfill({json:lookups===1?
        {game:'spin',status:'committed',recordCode:'P000001',time:'2026-11-11T10:00:00Z',before:9000,after:9100,bet:20,payout:120}:
        {game:'spin',status:'unconfirmed'}});
    }
    if(action==='backup')status.backup.running=true;
    if(action==='status'&&status.backup.running){
      status.backup.running=false;
      status.backup.at=Date.parse('2026-11-11T10:00:00Z');
    }
    if(action==='verify-backup')return route.fulfill({json:{verified:true,at:status.backup.at}});
    return route.fulfill({json:status});
  });
  const response=await page.goto(origin+'/operator');
  assert.equal(response.status(),200);
  assert.match(response.headers()['content-security-policy'],/frame-ancestors 'none'/);
  await page.getByLabel('管理金鑰').fill('f'.repeat(64));
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.getByText('管理金鑰有誤，請重新登入。').waitFor();
  await page.getByLabel('管理金鑰').fill(key);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.getByText('測試環境',{exact:true}).waitFor();
  assert.equal(await page.locator('#guild-field').isVisible(),false);
  await page.locator('#slot-button').click();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(changes,0);
  await page.locator('#slot-button').click();
  await page.getByRole('button',{name:'確認變更'}).click();
  await page.getByText('維護中',{exact:true}).waitFor();
  await page.locator('#slot-button').click();
  await page.getByRole('button',{name:'確認變更'}).click();
  await page.getByText('開放中',{exact:true}).waitFor();
  assert.equal(changes,2);
  await page.getByLabel('玩家 ID',{exact:true}).fill(player);
  await page.getByLabel('回報碼',{exact:true}).fill('S-runtime-original-spin-0001');
  await page.getByRole('button',{name:'取回原結果'}).click();
  await page.getByRole('heading',{name:'已取回原結果'}).waitFor();
  await page.getByRole('button',{name:'複製回覆給玩家'}).click();
  await page.getByText('已複製回覆。').waitFor();
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/派彩 120/);
  await page.getByRole('button',{name:'取回原結果'}).click();
  await page.getByRole('heading',{name:'查無原入帳紀錄'}).waitFor();
  await page.getByRole('button',{name:'更新備份'}).click();
  await page.getByText('已開始更新備份。').waitFor();
  await page.getByText('備份已更新並通過驗帳。').waitFor();
  await page.getByRole('button',{name:'核對備份'}).click();
  await page.getByText(/備份核對通過/).waitFor();
  mkdirSync('test-results/operator-console',{recursive:true});
  await page.screenshot({path:'test-results/operator-console/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-results/operator-console/mobile.png',fullPage:true});
  await page.getByRole('button',{name:'登出'}).click();
  await page.getByLabel('管理金鑰').waitFor();
  assert.equal(await page.getByLabel('管理金鑰').inputValue(),'');
  assert.equal(await page.locator('#player').inputValue(),'');
  assert.equal(await page.locator('#result').isVisible(),false);
  status.environment='production';
  delete status.entry.feature;
  delete status.entry.featureTitle;
  await page.getByLabel('管理金鑰').fill(key);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.getByText('正式環境',{exact:true}).waitFor();
  assert.equal(await page.locator('#feature-card').isVisible(),false);
  assert.equal(await page.getByLabel('回報碼',{exact:true}).getAttribute('placeholder'),'S- 開頭');
  assert.equal(await page.locator('#slot-button').isEnabled(),true);
  assert.deepEqual(errors,[]);
  console.log('Operator console login, entry changes, report lookup, backup and mobile layout passed.');
}finally{
  await browser?.close();
  await mf.dispose();
}
