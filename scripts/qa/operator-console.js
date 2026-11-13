import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {chromium} from 'playwright';
import {browserOptions} from './helpers/browser.js';

const key=randomBytes(32).toString('hex');
const guild='100000000000000001',player='100000000000000002';
const fixture=environment=>new Miniflare(convertV4MiniflareOptions({
  modules:true,scriptPath:process.env.TEST_CLOUD_BUNDLE||'test-results/cloud-bundle/worker.js',compatibilityDate:'2026-07-30',
  compatibilityFlags:['nodejs_compat'],
  durableObjects:{CIRCUS_PROJECT:{className:'CircusProject',useSQLite:true}},
  bindings:{APP_ENV:environment,ARCADE_RELEASE_ENABLED:String(environment==='test'),ARCADE_CONSOLE_TOKEN:key,
    CLOUD_PLAN:'paid',FIRESTORE_PROJECT_ID:'demo-jokers-circus',FIRESTORE_NAMESPACE:'operator-fixture-'+environment},
  outboundService:()=>{throw new Error('Console UI fixture only uses loopback');},
}));
const test=fixture('test'),production=fixture('production');
let browser;
try{
  const [testUrl,productionUrl]=await Promise.all([test.ready,production.ready]);
  browser=await chromium.launch(browserOptions());
  const context=await browser.newContext({viewport:{width:1200,height:930},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const status={
    environment:'test',mode:'active',ready:true,guilds:[guild],
    entry:{slot:'open',feature:'hidden',featureMaintenance:'open',featureTitle:'野球拳',revision:0},
    backup:{at:Date.parse('2026-11-10T10:00:00Z'),running:false,retryAt:null},
  };
  let lookups=0,changes=0;
  await page.route('**/__operator/*',async route=>{
    const request=route.request(),action=new URL(request.url()).pathname.split('/').at(-1);
    if(action==='sign-in'||action==='status'&&/^Bearer \d+\./.test(request.headers().authorization??''))return route.continue();
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
  const response=await page.goto(testUrl.origin+'/operator');
  assert.equal(response.status(),200);
  assert.match(response.headers()['content-security-policy'],/frame-ancestors 'none'/);
  const testBadge=page.getByText('TEST · 測試服',{exact:true});
  const keyField=page.getByLabel('管理金鑰',{exact:true});
  const remember=page.getByRole('checkbox',{name:'記住管理金鑰',exact:true});
  assert.equal(await testBadge.isVisible(),true);
  assert.match(await page.title(),/^TEST/);
  await remember.waitFor();
  assert.equal(await remember.isChecked(),false);
  mkdirSync('test-results/operator-console',{recursive:true});
  await page.screenshot({path:'test-results/operator-console/test-login.png',fullPage:true});
  await keyField.fill('f'.repeat(64));
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.getByText('管理金鑰有誤，請重新登入。').waitFor();
  await keyField.fill(key);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.locator('#console').waitFor();
  assert.equal(await testBadge.isVisible(),true);
  assert.equal(await page.locator('#guild-field').isVisible(),false);
  await page.locator('#slot-button').click();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(changes,0);
  await page.locator('#slot-button').click();
  await page.getByRole('button',{name:'確認變更'}).click();
  await page.getByText('維護中',{exact:true}).waitFor();
  await page.locator('#slot-button').click();
  await page.getByRole('button',{name:'確認變更'}).click();
  await page.locator('#slot-state').getByText('開放中',{exact:true}).waitFor();
  assert.equal(changes,2);
  const toggle=async(id,expected)=>{
    await page.locator(id).click();
    await page.getByRole('button',{name:'確認變更'}).click();
    await page.locator(id).getByText(expected,{exact:true}).waitFor();
  };
  await toggle('#featureMaintenance-button','結束維護');
  assert.equal(status.entry.feature,'hidden');
  await toggle('#feature-button','顯示模糊預告');
  assert.equal(status.entry.featureMaintenance,'maintenance');
  await toggle('#featureMaintenance-button','開啟維護');
  assert.equal(status.entry.feature,'open');
  await toggle('#feature-button','揭曉野球拳');
  assert.equal(status.entry.featureMaintenance,'open');
  assert.equal(changes,6);
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
  await page.screenshot({path:'test-results/operator-console/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-results/operator-console/mobile.png',fullPage:true});
  await page.getByRole('button',{name:'登出'}).click();
  await keyField.waitFor();
  assert.equal(await testBadge.isVisible(),true);
  assert.equal(await keyField.inputValue(),'');
  assert.equal(await page.locator('#player').inputValue(),'');
  assert.equal(await page.locator('#result').isVisible(),false);
  const signInUrl=testUrl.origin+'/__operator/sign-in';
  const cookieName='__Secure-circus-operator-remember';
  const rememberedCookie=async()=>(await context.cookies()).find(cookie=>cookie.name===cookieName);
  assert.equal(await rememberedCookie(),undefined,'ordinary login leaves no remembered credential');
  await remember.check();
  await keyField.fill('f'.repeat(64));
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.getByText('管理金鑰有誤或已過期，請重新輸入。').waitFor();
  assert.equal(await rememberedCookie(),undefined,'a rejected key cannot be remembered');
  await remember.check();
  await keyField.fill(key);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.locator('#console').waitFor();
  const cookie=await rememberedCookie();
  assert.ok(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Strict'&&cookie.path==='/__operator/sign-in');
  assert.ok(cookie.expires>Date.now()/1000&&!cookie.value.includes(key));
  assert.equal((await context.request.post(signInUrl,{headers:{Origin:'https://untrusted.invalid'}})).status(),403);
  assert.equal((await context.request.get(testUrl.origin+'/__operator/status',{headers:{Authorization:'Bearer '+cookie.value}})).status(),401);
  await page.reload();
  await remember.waitFor();
  assert.equal(await remember.isChecked(),true);
  assert.equal(await keyField.inputValue(),'');
  assert.equal(await keyField.getAttribute('placeholder'),'已記住管理金鑰');
  assert.equal(await page.locator('#console').isVisible(),false);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.locator('#console').waitFor();
  await page.getByRole('button',{name:'登出',exact:true}).click();
  assert.equal(await remember.isChecked(),true);
  await remember.uncheck();
  await page.locator('#key[required]').waitFor();
  assert.equal(await rememberedCookie(),undefined);
  await page.reload();
  await remember.waitFor();
  assert.equal(await remember.isChecked(),false);
  status.environment='production';
  delete status.entry.feature;
  delete status.entry.featureMaintenance;
  delete status.entry.featureTitle;
  await page.setViewportSize({width:1200,height:930});
  await page.goto(productionUrl.origin+'/operator');
  const productionBadge=page.getByText('正式服',{exact:true});
  assert.equal(await productionBadge.isVisible(),true);
  assert.equal(await testBadge.count(),0);
  assert.doesNotMatch(await page.title(),/^TEST/);
  assert.equal(await remember.count(),0);
  assert.equal((await context.request.get(productionUrl.origin+'/__operator/sign-in')).status(),404);
  await keyField.fill(key);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.locator('#console').waitFor();
  assert.equal(await productionBadge.isVisible(),true);
  assert.equal(await page.locator('#feature-card').isVisible(),false);
  assert.equal(await page.getByLabel('回報碼',{exact:true}).getAttribute('placeholder'),'S- 開頭');
  assert.equal(await page.locator('#slot-button').isEnabled(),true);
  await page.screenshot({path:'test-results/operator-console/production.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Operator login, remembered credential, entry changes, reports, backup and mobile layout passed.');
}finally{
  await browser?.close();
  await Promise.all([test.dispose(),production.dispose()]);
}
