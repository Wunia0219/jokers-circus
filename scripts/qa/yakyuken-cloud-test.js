import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {launchBrowser} from './helpers/browser.js';
import {playtestGateway,PLAYTEST_FS_DENY} from '../preview/yakyuken-test-gateway.js';
import {PlaytestService} from '../../cloud/yakyuken-playtest-core.js';

const live=process.argv.slice(2).join(' ')==='--live';
if(process.argv.length>2&&!live)throw new Error('Use no arguments or --live for the dedicated test cloud');
const output='test-results/yakyuken-cloud-'+(live?'live':'isolated');mkdirSync(output,{recursive:true});
const docs=new Map(),services=new Map();let reads=0,writes=0,failAction=null;
const fixture=player=>{
  if(services.has(player))return services.get(player);const values=new Map(),weights=[0,8000,0,4000,4000,0,0];
  const storage={get:async key=>structuredClone(values.get(key)),put:async(key,value)=>values.set(key,structuredClone(value)),delete:async key=>values.delete(key),transaction:async fn=>fn(storage)};
  const repository={read:async()=>{reads++;return structuredClone(docs.get(player));},mutate:async(_,change)=>{reads++;const state=change(structuredClone(docs.get(player)));if(state!==docs.get(player)){writes++;docs.set(player,structuredClone(state));}return state;}};
  const service=new PlaytestService({repository,storage,player,entropy:{getRandomValues:v=>{v[0]=weights.shift()??0;}}});services.set(player,service);return service;
};
const gatewayConfig=live?JSON.parse(readFileSync('.tools/yakyuken-playtest.json','utf8')):{origin:'https://jokers-circus-yakyuken-test.isolated.workers.dev',token:'a'.repeat(64)};
const gateway=playtestGateway({...gatewayConfig,...(live?{}:{fetchImpl:async(url,options)=>{
  const u=new URL(url),action=u.pathname.split('/').at(-1),s=fixture(u.searchParams.get('player'));
  try{
    const result=action==='state'?await s.stateView():await s.execute(action,JSON.parse(options.body));
    if(action===failAction){failAction=null;throw new Error('Isolated lost response after commit');}
    return Response.json(result);
  }catch(error){if(!error.status)throw error;return Response.json({error:error.message},{status:error.status});}
}})});
const server=await createServer({configFile:false,envDir:false,cacheDir:output+'/vite-cache',define:{'import.meta.env.VITE_YAKYUKEN_CLOUD_TEST':JSON.stringify('true')},optimizeDeps:{include:['pixi.js','pixi.js/unsafe-eval','pixi.js/prepare'],noDiscovery:true},plugins:[{name:'isolated-test-cloud-ui',configureServer(server){server.middlewares.use(gateway);},transform(code,id){
  if(id.split('?')[0].replaceAll('\\','/').endsWith('/src/games/yakyuken/scene.js'))return {code:code.replace('this.host = host;','globalThis.__cloudScene=this;this.host = host;'),map:null};
}}],server:{host:'127.0.0.1',port:4201,strictPort:true,hmr:false,fs:{deny:PLAYTEST_FS_DENY},watch:{ignored:['**/test-results/**','**/data/**','**/backups/**']}}});
const player=live?'qa-b':'qa-a',errors=[],checks=[];let browser;
const phase=(page,value)=>page.waitForFunction(value=>{const s=window.__cloudScene;return s?.initialized&&s.app.canvas.dataset.phase===value&&!s.changing;},value);
const wallet=page=>page.evaluate(()=>structuredClone(window.__cloudScene.wallet.wallet));
async function enter(page){await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(page,'characters');await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(page,'selecting');}
async function play(page){await page.getByRole('button',{name:'選擇拳頭',exact:true}).click();await page.getByRole('button',{name:'確認出牌',exact:true}).click();await phase(page,'confirmed');}
async function history(page){await page.getByRole('button',{name:'遊玩紀錄',exact:true}).click();await page.waitForFunction(()=>window.__cloudScene.modal==='history');}
try{
  await server.listen();browser=await launchBrowser();const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/.tools/yakyuken-playtest.json','/.env.firestore.local'])assert.equal((await context.request.get('http://127.0.0.1:4201'+path)).status(),403,'private local files cannot be served');
  for(const headers of [{Origin:'https://untrusted.invalid'},{'X-Forwarded-For':'127.0.0.1'}])assert.equal((await context.request.get('http://127.0.0.1:4201/api/playtest/state?player=qa-a',{headers})).status(),403,'cross-origin and forwarded access is refused');
  checks.push('private gateway credentials and local API boundary');
  await page.goto(`http://127.0.0.1:4201/yakyuken-preview.html?testPlayer=${player}`);await phase(page,'games');const initial=await wallet(page);
  const fee=initial.records.some(r=>r.id===initial.activeId&&r.status==='playing')?0:1000;
  await enter(page);let state=await wallet(page),matchId=state.activeId;
  assert.equal(state.balance,initial.balance-fee);assert.equal(state.environment,'test');
  checks.push('dedicated test identity, displayed balance and authoritative entry fee');
  if(live){
    for(let i=0;i<2;i++){
      await play(page);state=await wallet(page);const record=state.records.find(r=>r.id===matchId);
      assert.equal(state.balance,initial.balance-fee+record.reward);assert.ok(!Object.hasOwn(record,'draws'));
      if(record.status!=='playing')break;
      await page.getByRole('button',{name:'下一局',exact:true}).click();await phase(page,'selecting');
    }
    await page.waitForFunction(()=>!window.__cloudScene.ending&&!window.__cloudScene.entering);
    if((await wallet(page)).records.find(r=>r.id===matchId)?.status==='playing'){
      await page.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await page.getByRole('button',{name:'確認離開',exact:true}).click();await phase(page,'games');await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(page,'characters');
    }
    await history(page);await page.screenshot({path:output+'/history.png'});checks.push('real test cloud hands, wallet delta and persisted history');
    const saved=await wallet(page);await page.reload();await phase(page,'games');assert.equal((await wallet(page)).balance,saved.balance);assert.deepEqual((await wallet(page)).records,saved.records);checks.push('real Firestore state survives browser reload');
  }else{
    await play(page);assert.equal((await wallet(page)).records[0].wins,1);await page.getByRole('button',{name:'下一局',exact:true}).click();await phase(page,'selecting');
    const before=[reads,writes];await play(page);assert.deepEqual([reads,writes],before,'draw performs no repository access');assert.equal((await wallet(page)).records[0].wins,1);
    await page.getByRole('button',{name:'下一局',exact:true}).click();await phase(page,'selecting');await play(page);assert.equal((await wallet(page)).balance,11500);checks.push('server outcomes, free draw, one prize and net +1,500');
    await history(page);
    for(const [width,height] of [[320,568],[390,844],[530,900],[1600,900]]){
      await page.setViewportSize({width,height});await page.waitForFunction(w=>window.__cloudScene.layout.ui.width===w,width);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const geometry=await page.evaluate(()=>{
        const scene=window.__cloudScene,row=scene.modalRoot.children.find(n=>n.label==='archive-dialog').children.find(n=>n.label==='match-history-scroll').children[0].children[0];
        const score=row.children.find(n=>n.label==='history-win-loss'),amount=row.children.find(n=>n.text==='+1,500'),caption=row.children.find(n=>n.text==='戲籌變化');
        const rect=n=>{const b=n.getBounds();return {x:b.x,y:b.y,width:b.width,height:b.height};};
        return {score:rect(score),amount:rect(amount),caption:!!caption,colors:score.children.map(n=>n.style.fill),texts:row.children.filter(n=>typeof n.text==='string').map(n=>n.text)};
      });
      const a=geometry.score,b=geometry.amount;assert.ok(a.x+a.width<=b.x||a.x>=b.x+b.width||a.y+a.height<=b.y||a.y>=b.y+b.height,'center score and wallet delta never overlap');assert.ok(geometry.caption);assert.equal(geometry.colors[0],0xffe5b0);assert.equal(geometry.colors[2],0xe8b9bc);
      await page.screenshot({path:`${output}/history-${width}.png`});
    }
    await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>window.__cloudScene.layout.ui.width===390);
    const summary=page.getByRole('button',{name:/^展開 .* 對局結果$/}).first(),box=await summary.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.screenshot({path:output+'/history-expanded.png'});
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__cloudScene.wallet.wallet.records).includes('draws')),false);checks.push('win/loss colors, centered responsive summary and no persisted draw counters');
    await page.getByRole('button',{name:'關閉視窗',exact:true}).click();await page.getByRole('button',{name:'再次挑戰',exact:true}).click();await phase(page,'selecting');await play(page);await page.getByRole('button',{name:'下一局',exact:true}).click();await phase(page,'selecting');await play(page);await page.getByRole('button',{name:'返回',exact:true}).click();await phase(page,'characters');
    assert.equal((await wallet(page)).balance,10500);assert.equal((await wallet(page)).records[0].net,-1000);await history(page);await page.screenshot({path:output+'/history-loss.png'});await page.getByRole('button',{name:'關閉視窗',exact:true}).click();checks.push('loss retains entry fee and records net -1,000');
    await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(page,'selecting');await play(page);const saved=await wallet(page);await page.reload();await phase(page,'games');await enter(page);assert.equal((await wallet(page)).balance,saved.balance);assert.equal((await wallet(page)).activeId,saved.activeId);assert.equal((await wallet(page)).records[0].wins,1);checks.push('reload resumes the current match without another fee');
    failAction='hand';await page.getByRole('button',{name:'選擇拳頭',exact:true}).click();await page.getByRole('button',{name:'確認出牌',exact:true}).click();await page.waitForFunction(()=>window.__cloudScene.wallet.pending&&window.__cloudScene.phase==='retrying');
    const committed=docs.get(player).balance,beforeRetryWrites=writes;await page.getByRole('button',{name:'重試上一拳',exact:true}).click();await phase(page,'confirmed');assert.equal((await wallet(page)).balance,committed);assert.equal(writes,beforeRetryWrites);assert.equal((await wallet(page)).balance,12000);checks.push('lost settlement response retries original hand without a second prize');
    await page.screenshot({path:output+'/wallet-header.png'});
    failAction='checkin';await page.locator('#daily-checkin').click();
    const checkin=page.getByRole('dialog',{name:'週簽到',exact:true});
    assert.equal(await checkin.getByRole('listitem').count(),7);assert.equal((await wallet(page)).balance,12000);
    await checkin.getByRole('button',{name:/領取.*戲籌/}).click();
    await checkin.getByText('請稍後再試，已領取的獎勵不會重複發放。',{exact:true}).waitFor();
    await checkin.getByRole('button',{name:'重試簽到',exact:true}).click();
    await page.waitForFunction(()=>window.__cloudScene.wallet.wallet.checkinView.claimed);assert.equal((await wallet(page)).balance,12500);
    assert.equal(await checkin.getByRole('button',{name:'今日獎勵已領取'}).isDisabled(),true);
    await checkin.getByText('今天已領取 500 戲籌，明天再來簽到吧。',{exact:true}).waitFor();
    await checkin.getByRole('button',{name:'關閉視窗',exact:true}).click();
    await page.locator('#daily-checkin').click();
    assert.equal(await checkin.locator('.checkin-day.is-complete').count(),1);
    checks.push('seven-day schedule stays viewable after a retry credits the daily claim once');
    const other=await context.newPage();await other.goto('http://127.0.0.1:4201/yakyuken-preview.html?testPlayer=qa-b');await phase(other,'games');assert.equal((await wallet(other)).balance,10000);assert.equal((await wallet(other)).records.length,0);checks.push('test players remain isolated');
    await other.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(other,'characters');
    failAction='begin';await other.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();
    const retryEntry=other.getByRole('button',{name:'重試野球拳轉場',exact:true});
    await retryEntry.waitFor();
    assert.equal(await other.getByRole('button',{name:'取消野球拳轉場',exact:true}).count(),0,'an unconfirmed charge requires retrying the original request');
    const originalEntry=docs.get('qa-b').activeId;
    assert.equal(docs.get('qa-b').balance,9000);
    await retryEntry.click();await phase(other,'selecting');
    assert.equal((await wallet(other)).activeId,originalEntry);assert.equal((await wallet(other)).balance,9000);
    checks.push('lost entry response retries the original charge from the loader without charging twice');
    await other.goto('http://127.0.0.1:4201/yakyuken-preview.html?testPlayer=qa-low');await phase(other,'games');await other.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(other,'characters');
    await other.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await other.waitForFunction(()=>window.__cloudScene.entryOverlay?.stage==='error');
    assert.equal((await wallet(other)).balance,50);assert.ok(await other.evaluate(()=>window.__cloudScene.entryOverlay.message.includes('戲籌不足')));
    await other.getByRole('button',{name:'取消野球拳轉場',exact:true}).click();await other.waitForFunction(()=>!window.__cloudScene.entryOverlay);checks.push('insufficient funds show a clear reason and allow returning without a debit');
  }
  assert.deepEqual(errors,[]);writeFileSync(output+'/report.json',JSON.stringify({ok:true,live,player,checks,errors},null,2)+'\n');console.log(JSON.stringify({ok:true,live,checks:checks.length,output}));
}finally{await browser?.close();await server.close();}
