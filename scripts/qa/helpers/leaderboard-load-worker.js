// Loaded by Miniflare alongside the local dry-run bundle, only for the load test.
import {CircusProject as GameProject} from './worker.js';
export {default} from './worker.js';

export class CircusProject extends GameProject {
  async makeRuntime(){
    const runtime=await super.makeRuntime();
    const queue=runtime.store.settlementQueue,run=queue.run.bind(queue);
    queue.run=task=>{
      const enqueued=Date.now(),depth=Number(queue.running)+queue.waiting.length;
      return run(()=>{
        this.samples?.starts.push({depth,waitMs:Date.now()-enqueued});
        return task();
      });
    };
    if(runtime.leaderboard){
      const committed=new Map(),board=runtime.leaderboard.board;
      const publish=runtime.store.onLedgerCommit,apply=board.apply.bind(board);
      runtime.store.onLedgerCommit=entries=>{
        for(const entry of entries)if(this.samples)committed.set(entry.id,Date.now());
        publish(entries);
      };
      board.apply=entries=>{
        apply(entries);
        for(const {id} of entries)if(committed.has(id)){
          this.samples.lags.push(Date.now()-committed.get(id));
          committed.delete(id);
        }
      };
    }
    return runtime;
  }
  async fetch(request){
    if(new URL(request.url).pathname!=='/api/load-samples')return super.fetch(request);
    if(this.env.FIRESTORE_PROJECT_ID!=='demo-jokers-circus'||
      request.headers.get('Authorization')!=='Bearer '+this.env.CLOUD_ADMIN_TOKEN)return new Response(null,{status:403});
    if(request.method==='POST')this.samples={starts:[],lags:[]};
    return Response.json(this.samples??{starts:[],lags:[]});
  }
}
