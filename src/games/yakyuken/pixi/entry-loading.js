import {Container,FillGradient,Graphics,Rectangle,Sprite} from 'pixi.js';
import {Motion} from './motion.js';
import {label,PixiButton} from './ui.js';
import {ENTRY_TIMING,entryLoadingLayout} from './entry-state.js';

// Reused within one Yakyuken renderer; released after its shader bindings close.
export function createYakyukenEntryGradients(){
  return [
      new FillGradient({type:'radial',center:{x:.5,y:.5},innerRadius:0,outerRadius:.5,colorStops:[{offset:0,color:'#193c4b66'},{offset:1,color:'#193c4b00'}]}),
      new FillGradient({type:'radial',center:{x:.5,y:.5},innerRadius:0,outerRadius:.5,colorStops:[{offset:0,color:'#73512838'},{offset:1,color:'#73512800'}]}),
      new FillGradient({start:{x:0,y:0},end:{x:1,y:0},colorStops:[{offset:0,color:0x841e37},{offset:.32,color:0xc44b60},{offset:.66,color:0xdfb763},{offset:1,color:0xfff0b0}]}),
      new FillGradient({start:{x:0,y:0},end:{x:1,y:0},colorStops:[{offset:0,color:'#fff8cf00'},{offset:.5,color:'#fff8cf80'},{offset:1,color:'#fff8cf00'}]}),
    ];
}

// Independent Yakyuken loader, rendered entirely in its own Pixi layer.
export class YakyukenEntryLoading {
  motion=new Motion();
  progress={value:0};
  cover={value:0};
  contentFade={value:0};
  target=0;
  stage='covering';
  elapsed=0;
  disposed=false;

  constructor({app,logoTexture,table=false,reduced=false,onChange=()=>{},onRetry,onBack,gradients}){
    Object.assign(this,{app,logoTexture,table,onChange,onRetry,onBack,gradients});this.motion.reduced=reduced;
    this.started=performance.now();
    this.root=new Container({label:'yakyuken-entry-loading'});this.root.eventMode='static';
    this.root.on('pointertap',event=>event.stopPropagation());app.stage.addChild(this.root);
    this.resize(app.screen.width,app.screen.height);
  }

  resize(width,height){
    if(this.disposed)return;
    this.root.removeChildren().forEach(child=>child.destroy({children:true}));
    const error=this.stage==='error';
    this.status=error||this.table?label(this.message??'',14,error?0xf0d6d4:0xd9c7ab,{wordWrap:true,wordWrapWidth:Math.min(420,width-48),lineHeight:22}):null;
    const l=entryLoadingLayout(width,height,{error,showStatus:this.table,messageHeight:this.status?Math.max(error?48:22,this.status.height):0});this.layout=l;
    this.root.hitArea=new Rectangle(0,0,width,height);
    const background=this.backdrop=new Graphics().rect(0,0,width,height).fill(0x0b1020);
    // These few simple shapes can share the regular sprite batch. Avoid the
    // standalone graphics shader's global bind-group cache retaining gradients.
    background.context.batchMode='batch';
    background.ellipse(width/2,height*.44,Math.min(width*.8,640),height*.42).fill(this.gradients[0]);
    background.ellipse(width/2,height*1.05,Math.max(width*.7,320),height*.55).fill(this.gradients[1]);this.root.addChild(background);
    const content=new Container({label:'yakyuken-loading-content'});this.root.addChild(content);this.content=content;
    const logo=new Sprite({label:'yakyuken-loading-logo',texture:this.logoTexture,anchor:{x:.5,y:0},eventMode:'none'});
    logo.width=l.logoWidth;logo.height=l.logoHeight;logo.position.set(width/2,l.logoY);content.addChild(logo);
    this.meter=new Container({label:'yakyuken-loading-meter'});this.meter.position.set((width-l.barWidth)/2,l.barY);
    this.meter.boundsArea=new Rectangle(0,0,l.barWidth,12);this.meter.eventMode='static';
    Object.assign(this.meter,{accessible:true,accessibleTitle:'野球拳載入進度',accessibleHint:'野球拳載入進度',accessibleType:'div',accessiblePointerEvents:'none',tabIndex:-1});
    this.meter.addChild(new Graphics().roundRect(0,0,l.barWidth,12,6).fill(0x060b16).stroke({color:0xd6ac58,width:1,alpha:.38}));
    const fill=new Container();fill.position.set(2,2);this.meter.addChild(fill);
    fill.addChild(new Graphics().roundRect(0,0,l.barWidth-4,8,4).fill(this.gradients[2]));
    this.shimmer=new Graphics().rect(0,0,80,8).fill(this.gradients[3]);fill.addChild(this.shimmer);
    this.clip=new Graphics().roundRect(0,0,l.barWidth-4,8,4).fill(0xffffff);this.clip.position.set(2,2);this.meter.addChild(this.clip);fill.mask=this.clip;
    this.meter.visible=this.stage!=='error';content.addChild(this.meter);
    if(this.status){
      this.status.position.set(width/2,l.messageY);content.addChild(this.status);
    }
    if(error){
      const gap=12,w=l.actionWidth;
      const retry=new PixiButton({text:'再試一次',name:this.table?'重試野球拳轉場':'重試進入野球拳',variant:'gold',width:w,height:48,onPress:this.onRetry});
      const back=new PixiButton({text:this.table?'返回上一頁':'取消載入',name:this.table?'取消野球拳轉場':'取消野球拳載入',width:w,height:48,onPress:this.onBack});
      back.setEnabled(this.allowBack!==false);
      retry.position.set(width/2-(w+gap)/2,l.actionY);back.position.set(width/2+(w+gap)/2,l.actionY);content.addChild(retry,back);
    }
    this.drawProgress();
  }

  notify(){
    const key=`${this.stage}:${this.target}:${Math.floor(this.progress.value)}`;
    if(key===this.lastState)return;this.lastState=key;this.onChange({stage:this.stage,target:this.target,displayed:this.progress.value});
  }
  update(value,message){
    if(this.disposed || this.stage==='error')return;
    this.target=Math.max(this.target,Math.min(95,value));this.message=message;
    if(this.status)this.status.text=message;
    void this.motion.to(this.progress,{value:this.target},420);this.notify();
  }
  async open(){
    this.update(8,this.table?'正在準備入場…':'正在準備舞台…');
    await this.motion.to(this.cover,{value:1},ENTRY_TIMING.cover);
    if(this.disposed)return false;
    this.stage='loading';this.notify();
    if(!this.table)await this.motion.to(this.contentFade,{value:1},ENTRY_TIMING.content);
    return !this.disposed;
  }
  async finish(){
    if(this.disposed)return false;
    this.target=100;this.message='野球拳已準備好';
    if(this.status)this.status.text=this.message;
    if(this.table)void this.motion.to(this.progress,{value:100},ENTRY_TIMING.fill);
    else{
      this.stage='settling';this.notify();
      const duration=this.motion.reduced?0:Math.max(ENTRY_TIMING.fill,ENTRY_TIMING.minimum-(performance.now()-this.started));
      await this.motion.to(this.progress,{value:100},duration);
      if(this.disposed)return false;
      this.stage='clearing';this.notify();
      await this.motion.to(this.contentFade,{value:0},ENTRY_TIMING.clear);
      if(this.disposed)return false;
    }
    this.stage='revealing';this.notify();
    await this.motion.to(this.cover,{value:0},ENTRY_TIMING.reveal);
    if(this.disposed)return false;
    this.stage='complete';this.notify();return true;
  }
  fail(message='舞台暫時未能準備好\n請再試一次，或返回大廳。',allowBack=true){
    if(this.disposed)return;
    this.motion.cancel(this.progress);this.stage='error';this.message=message;this.allowBack=allowBack;
    this.cover.value=1;this.contentFade.value=1;this.resize(this.app.screen.width,this.app.screen.height);this.notify();
  }
  drawProgress(){
    if(this.disposed)return;
    this.backdrop.alpha=this.cover.value;
    this.content.alpha=this.table?this.cover.value:this.contentFade.value;
    this.content.visible=this.content.alpha>0;
    this.clip.scale.x=Math.max(0,Math.min(1,this.progress.value/100));
    this.shimmer.visible=!this.motion.reduced && this.stage!=='error';
    this.shimmer.x=this.elapsed%2000/2000*(this.layout.barWidth+80)-80;
    const div=this.meter._accessibleDiv;
    if(div){div.setAttribute('role','progressbar');div.setAttribute('aria-valuemin','0');div.setAttribute('aria-valuemax','100');div.setAttribute('aria-valuenow',String(Math.floor(this.progress.value)));div.setAttribute('aria-valuetext',`${Math.floor(this.progress.value)}%，${this.message}`);}
  }
  tick(elapsed){if(this.disposed)return;this.elapsed+=Math.max(0,elapsed);this.motion.tick(elapsed);this.drawProgress();this.notify();}
  destroy(){
    if(this.disposed)return;this.disposed=true;this.motion.destroy();this.root.destroy({children:true});
  }
}
