export const REWARD_SHOWCASE_MS=350;
export const REWARD_COUNT_MS=1200;
export const REWARD_FADE_MS=650;

// Presentation only. The server's wallet is never changed by this timeline.
export class RewardPresentation{
  stage='idle';elapsed=0;seen=new Set();
  get busy(){return ['holding','showcase','counting'].includes(this.stage);}
  hold({id,after,reward}){
    if(this.busy||this.seen.has(id)||typeof id!=='string'||!Number.isSafeInteger(after)||!Number.isSafeInteger(reward)||reward<=0||after<reward)return false;
    this.seen.add(id);if(this.seen.size>100)this.seen.delete(this.seen.values().next().value);
    Object.assign(this,{id,after,reward,before:after-reward,stage:'holding',elapsed:0});return true;
  }
  reveal(){if(this.stage!=='holding')return false;this.stage='showcase';this.elapsed=0;return true;}
  clear(){this.stage='idle';this.elapsed=0;}
  tick(ms,{reduced=false}={}){
    if(!['showcase','counting','settled'].includes(this.stage))return false;
    this.elapsed+=Math.max(0,Number.isFinite(ms)?ms:0);
    if(this.stage==='showcase'&&this.elapsed>=REWARD_SHOWCASE_MS){this.elapsed-=REWARD_SHOWCASE_MS;this.stage='counting';}
    // Keep the exact final +amount visible even when a late frame spans the
    // whole count. The reading/fade phase starts on that rendered result.
    if(this.stage==='counting'&&(reduced||this.elapsed>=REWARD_COUNT_MS)){this.elapsed=0;this.stage='settled';return true;}
    if(this.stage==='settled'&&this.elapsed>=REWARD_FADE_MS)this.clear();
    return true;
  }
  frame(actualBalance,{reduced=false}={}){
    const counting=this.stage==='counting',settled=this.stage==='settled';
    const p=counting?Math.min(1,this.elapsed/REWARD_COUNT_MS):settled?1:0;
    const amount=p===1?this.reward:Math.floor((this.reward||0)*(1-(1-p)**3));
    const fade=settled?Math.min(1,this.elapsed/REWARD_FADE_MS):0;
    return {balance:this.busy?this.before+amount:actualBalance,amount,visible:counting||settled,
      alpha:1-fade,lift:reduced?0:counting?p*10:10+fade*24,
      glow:counting?.35+Math.sin(p*Math.PI)*.55:settled?(1-fade)*.35:0};
  }
}
