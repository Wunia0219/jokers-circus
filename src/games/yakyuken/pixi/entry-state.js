// Yakyuken entry presentation only; no dependency on slot loading or reel timing.
export const ENTRY_TIMING=Object.freeze({cover:340,content:180,fill:420,minimum:1100,clear:180,reveal:520});

export function entryLoadingLayout(width,height,{error=false}={}){
  const compact=height<=520,phone=width<=600,contentWidth=Math.min(620,width-48);
  // Match the slot loader's logo limits and logo-to-meter spacing; normal
  // loading contains only these two elements, with no reserved text area.
  const logoWidth=Math.min(compact?240:phone?270:310,contentWidth*(compact?1:.85),height*(error ? .30 : compact || phone ? .55 : .60));
  const logoHeight=logoWidth*581/574,gap=compact?26:phone?40:52;
  const messageHeight=error?48:0,actionGap=error?18:0,actionHeight=error?48:0;
  const total=logoHeight+gap+12+(error?16:0)+messageHeight+actionGap+actionHeight;
  const top=(height-total)/2,barY=top+logoHeight+gap;
  return {width,height,logoWidth,logoHeight,logoY:top,
    barWidth:phone?contentWidth*.92:Math.min(420,contentWidth*.86),barY,
    messageY:barY+12+(error?16:0)+messageHeight/2,actionY:barY+12+16+messageHeight+actionGap+24,
    actionWidth:Math.min(168,(contentWidth-12)/2)};
}

// Pixi Prepare can remain pending when its renderer is destroyed. Cancellation
// releases the entry workflow even when that underlying work cannot be aborted.
export function waitForEntryTask(task,signal){
  return new Promise((resolve,reject)=>{
    const aborted=()=>{signal.removeEventListener('abort',aborted);resolve(false);};
    Promise.resolve(task).then(()=>{signal.removeEventListener('abort',aborted);resolve(!signal.aborted);},error=>{
      signal.removeEventListener('abort',aborted);if(signal.aborted)resolve(false);else reject(error);
    });
    if(signal.aborted)aborted();else signal.addEventListener('abort',aborted,{once:true});
  });
}
