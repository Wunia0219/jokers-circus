import {writeFileSync} from 'node:fs';

// QA diagnostics only: observe real elapsed time without changing test waits.
export function createQaTimings(path){
  const started=performance.now();let previous=started;
  const phases=[],operations=[];
  const save=()=>writeFileSync(path,JSON.stringify({elapsedMs:Math.round(performance.now()-started),phases,operations},null,2)+'\n');
  return {
    mark(name){
      const now=performance.now(),durationMs=Math.round(now-previous);previous=now;
      phases.push({name,durationMs});save();
      console.log(`[QA timing] ${name}: ${(durationMs/1000).toFixed(2)}s`);
    },
    async measure(name,run){
      const start=performance.now();let ok=false;
      try{const result=await run();ok=true;return result;}
      finally{operations.push({name,ok,durationMs:Math.round(performance.now()-start)});save();}
    },
  };
}
