const LINES=Object.freeze({
  win:['這拳漂亮，算你的。','好，這回是我輸了。','反應挺快嘛，再來。'],
  loss:['這回我先拿下了。','差一點，再試一拳？','別急，慢慢來。'],
  draw:['打平了，再來一次？','想到一塊去了，再來。','這麼巧？那就再比一拳。'],
});

export function resultDialogue({outcome,round,status}){
  if(!LINES[outcome] || !Number.isInteger(round) || round<1)throw new Error('Invalid revealed round');
  if(status==='won')return '你贏了，獎金歸你。';
  if(status==='lost')return '今天先到這吧，下次再來。';
  return LINES[outcome][(round-1)%LINES[outcome].length];
}

export function earnedPose(wins,artCount){return Math.min(Math.max(0,wins),artCount-1);}

export const WARDROBE_DURATION=2100;
const ramp=(t,start,end)=>Math.max(0,Math.min(1,(t-start)/(end-start)));
const ease=t=>t*t*(3-2*t);
// A single elapsed-time timeline survives resize and late frames without
// restarting, settling another hand, or committing an outfit twice.
export function wardrobeFrame(elapsed){
  const focus=ease(ramp(elapsed,0,360))*(1-ease(ramp(elapsed,1580,WARDROBE_DURATION)));
  return {focus,newAlpha:ease(ramp(elapsed,160,640)),
    committed:elapsed>=640,complete:elapsed>=WARDROBE_DURATION};
}
