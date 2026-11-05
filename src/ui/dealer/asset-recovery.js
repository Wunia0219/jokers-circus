// Bounded per-dealer work: no cache-busting URLs, network probes, telemetry or
// wallet calls. Keep diagnostics locally, without URL queries or credentials.
export function transientAssetError(error){
  const message=String(error?.message||error);
  const status=message.match(/:\s*(\d{3})\b/)?.[1];
  if(status)return ['408','429','500','502','503','504'].includes(status);
  return /failed to fetch|network|load failed|timeout/i.test(message);
}
export function createAssetRecovery({load,disposed=()=>false,wait=ms=>new Promise(done=>setTimeout(done,ms)),clock=()=>performance.now(),limit=4,report=()=>{}}){
  let active=0;const queue=[];
  const slot=()=>new Promise(resolve=>{queue.push(resolve);drain();});
  function drain(){while(active<limit&&queue.length){active++;queue.shift()();}}
  return async url=>{
    await slot();
    try{
      for(let attempt=0;attempt<3;attempt++){
        if(disposed())throw new Error('Dealer disposed');
        const started=clock();
        try{return await load(url);}
        catch(error){
          const retry=attempt<2&&!disposed()&&transientAssetError(error);
          report({file:String(url).split(/[?#]/)[0].split('/').at(-1),attempt:attempt+1,elapsedMs:Math.round(clock()-started),status:Number(String(error?.message).match(/:\s*(\d{3})\b/)?.[1])||null,retry});
          if(!retry)throw error;
          await wait([300,1000][attempt]);
        }
      }
    }finally{active--;drain();}
  };
}
