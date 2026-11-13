import {isLocalTestRequest} from '../../server/testing/local-test-request.js';

export const PLAYTEST_FS_DENY=['.env','.env.*','*.{crt,pem,key,p12,pfx,cer,der}','.npmrc','.yarnrc.yml','**/.git/**','**/.tools/**','**/.wrangler/**','**/data/**','**/backups/**','**/*firebase-adminsdk*.json','**/*service-account*.json'];

export function playtestGateway({origin,token,fetchImpl=fetch}){
  const url=new URL(origin);
  if(url.protocol!=='https:'||!/^jokers-circus-yakyuken-test\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)||url.port||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!/^[a-f0-9]{64}$/.test(token))throw new Error('Dedicated playtest gateway required');
  return async(req,res,next)=>{
    if(!req.url?.startsWith('/api/playtest/'))return next();
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    if(!isLocalTestRequest(req))return send(403,{error:'測試錢包只限這台電腦存取。'});
    const path=new URL(req.url,'http://localhost');
    if(!/^\/api\/playtest\/(state|begin|hand|leave|checkin)$/.test(path.pathname)||![...path.searchParams.keys()].every(k=>k==='player'))return send(404,{error:'找不到此測試功能。'});
    if(!['GET','POST'].includes(req.method))return send(405,{error:'不支援的測試請求。'});
    try{
      let body='';if(req.method==='POST'){for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)return send(413,{error:'測試請求過大。'});}}
      const response=await fetchImpl(new URL(path.pathname+path.search,url),{method:req.method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(req.method==='POST'?{body}:{}),redirect:'error',signal:AbortSignal.timeout(25000)});
      send(response.status,await response.json());
    }catch{send(503,{error:'測試雲端連線中斷，請使用原操作重試。'});}
  };
}
