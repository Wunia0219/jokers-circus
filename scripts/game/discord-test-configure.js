import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {LIVE_APP,TEST_GUILD,TEST_CHANNEL} from '../../cloud/discord-test-auth.js';
import {isLocalTestRequest} from '../../server/testing/local-test-request.js';

const port=4202,nonce=randomBytes(32).toString('hex'),file='.tools/discord-test-app.json';
const html=`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Discord 測試 App 本機設定</title><style>body{font:16px sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#eee;background:#211727}label{display:block;margin:20px 0}input{display:block;width:95%;padding:10px;margin-top:8px}button{padding:12px}p{line-height:1.7}</style><h1>儲存獨立測試 App 設定</h1><p>只儲存到本機 .tools/discord-test-app.json，不傳送到其他網站。正式 App ID 會被拒絕。</p><form method="post" autocomplete="off"><input type="hidden" name="nonce" value="${nonce}"><label>Application ID<input name="clientId" required autocomplete="off"></label><label>Public Key<input name="publicKey" required autocomplete="off"></label><label>Client Secret<input name="clientSecret" type="password" required autocomplete="off"></label><button>儲存測試 App 設定</button></form></html>`;
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const server=createServer(async(req,res)=>{
  const reply=(status,text)=>{res.writeHead(status,headers);res.end(text);};
  if(!isLocalTestRequest(req)||req.url!=='/')return reply(403,'僅限本機設定頁。');
  if(req.method==='GET')return reply(200,html);
  if(req.method!=='POST'||req.headers.origin!==`http://127.0.0.1:${port}`||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))return reply(403,'不允許此設定請求。');
  try{
    let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)return reply(413,'設定內容過大。');}
    const data=new URLSearchParams(text),actual=Buffer.from(data.get('nonce')||''),expected=Buffer.from(nonce);
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply(403,'設定驗證失敗。');
    const clientId=data.get('clientId'),publicKey=data.get('publicKey'),clientSecret=data.get('clientSecret');
    if(!/^\d{17,20}$/.test(clientId||'')||clientId===LIVE_APP||!/^[a-f\d]{64}$/i.test(publicKey||'')||typeof clientSecret!=='string'||clientSecret.length<16||clientSecret.length>128)return reply(400,'請確認新測試 App 的三項設定值。');
    const previous=JSON.parse(readFileSync(file,'utf8'));if(previous.clientId&&previous.clientId!==clientId)return reply(409,'已存在不同的測試 App 設定，未覆寫。');
    writeFileSync(file,JSON.stringify({purpose:'discord-test',clientId,publicKey,clientSecret,guildId:TEST_GUILD,channelId:TEST_CHANNEL,testerIds:previous.testerIds||[],cgPreviewUserId:previous.cgPreviewUserId},null,2)+'\n');
    return reply(200,'<!doctype html><meta charset="utf-8"><title>測試 App 設定已儲存</title><h1>測試 App 設定已儲存</h1><p>密鑰未顯示於頁面，接著由部署工具載入本機設定。</p>');
  }catch{return reply(500,'無法儲存測試 App 設定。');}
});
server.listen(port,'127.0.0.1',()=>console.log('Private local test App setup: http://127.0.0.1:4202/'));
