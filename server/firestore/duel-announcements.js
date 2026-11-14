import {duelAnnouncement} from '../discord/duel-announcement.js';
import {HIGHLIGHT_MAX_AGE_MS} from '../discord/highlight-card.js';

export const duelNoticeId=e=>`${e.guild}_${e.user}_${e.matchId}`;
export const duelNoticeIndex=e=>({queueKey:`${e.guild}:${e.status}:${String(e.occurred).padStart(16,'0')}:${e.matchId}`});

// The wallet transaction creates this outbox with the award. Notification state
// is separate from the seven-table game backup: disaster restore never reposts
// old messages. An expired sending lease is uncertain, never blindly retried.
export class FirestoreDuelAnnouncements {
  constructor(store,{bot,clock=Date.now}){Object.assign(this,{store,bot,clock});this.nextAttempt=0;this.running=null;}
  async rows(tx,status){
    const prefix=`${this.bot.guild}:${status}:`;this.store.quota.reserve({reads:6});
    const result=await tx.get(this.store.root.collection('duelAnnouncements').where('queueKey','>=',prefix).where('queueKey','<',prefix+'\uf8ff').orderBy('queueKey').limit(1));
    return result.docs.map(doc=>{
      const event=JSON.parse(doc.get('json'));
      if(event.guild!==this.bot.guild||event.status!==status||doc.id!==duelNoticeId(event)||doc.get('queueKey')!==duelNoticeIndex(event).queueKey||!Number.isSafeInteger(event.occurred))throw new Error('Invalid challenge outbox');
      duelAnnouncement(event);this.store.quota.observe(Buffer.byteLength(JSON.stringify(event)));return event;
    });
  }
  save(tx,event){this.store.write(tx,this.store.root.collection('duelAnnouncements').doc(duelNoticeId(event)),event,{index:duelNoticeIndex(event)});}
  flush(){return this.running??=(this.deliver().finally(()=>{this.running=null;}));}
  async deliver(){
    if(this.clock()<this.nextAttempt)return;
    const claim=await this.store.db.runTransaction(async tx=>{
      const [sending]=await this.rows(tx,'sending');
      if(sending){
        if(sending.until>this.clock())return {wait:sending.until};
        this.save(tx,{...sending,status:'uncertain'});return {again:true};
      }
      const [event]=await this.rows(tx,'pending');if(!event)return {empty:true};
      if(this.clock()-event.occurred>HIGHLIGHT_MAX_AGE_MS||event.occurred>this.clock()){
        this.save(tx,{...event,status:'expired'});return {again:true};
      }
      if(event.nextAttempt>this.clock())return {wait:event.nextAttempt};
      const claimed={...event,status:'sending',until:this.clock()+60000};this.save(tx,claimed);return {event:claimed};
    },{maxAttempts:3});
    this.nextAttempt=claim.wait??this.clock()+(claim.empty?600000:1000);
    if(!claim.event)return;
    const event=claim.event;
    let outcome;try{outcome=await this.bot.send(duelAnnouncement(event),'duel:'+duelNoticeId(event));}catch{outcome={kind:'uncertain'};}
    await this.store.db.runTransaction(async tx=>{
      const current=await this.store.read(this.store.root.collection('duelAnnouncements').doc(duelNoticeId(event)),tx);
      if(current?.status!=='sending'||current.until!==event.until)return;
      const status=outcome.kind==='retry'?'pending':outcome.kind==='sent'?'sent':'uncertain';
      this.save(tx,{...current,status,...(status==='sent'?{messageId:outcome.messageId}:{}),nextAttempt:this.clock()+(outcome.delay||1000)});
    },{maxAttempts:3});
    this.nextAttempt=this.clock()+(outcome.delay||1000);
  }
}
