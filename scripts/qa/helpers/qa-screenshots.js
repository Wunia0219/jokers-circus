// These are diagnostic captures, never pixel baselines or test assertions.
export function createQaScreenshots({timing,mode=process.env.QA_SCREENSHOTS||(process.env.CI==='true'?'failure':'all')}={}){
  if(!['all','failure'].includes(mode))throw new Error('QA_SCREENSHOTS must be all or failure');
  const capture=async(page,path,failure=false)=>{
    const run=()=>page.screenshot({path,...(failure?{timeout:5000}:{})});
    return timing?timing.measure('screenshot/'+path.split('/').at(-1),run):run();
  };
  return {
    mode,
    capture(page,path){if(mode==='all')return capture(page,path);},
    async failure(page,path){
      // A diagnostic failure must not replace the original assertion error.
      try{await capture(page,path,true);}catch{console.error('[QA screenshot] Could not capture failure screenshot');}
    },
  };
}
