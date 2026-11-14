import {Container,Graphics,Rectangle} from 'pixi.js';
import {Motion} from './motion.js';
import {label,PixiButton} from '../../../ui/pixi/ui.js';
import {ENTRY_TIMING} from './entry-state.js';

// Screen changes have no branding, progress meter or decorative scene movement.
export class YakyukenScreenFade {
  motion=new Motion();
  cover={value:0};
  stage='covering';
  disposed=false;
  constructor({app,reduced,onChange,onRetry,onBack,covered=false}){
    Object.assign(this,{app,onChange,onRetry,onBack});this.motion.reduced=reduced;
    if(covered)this.cover.value=1;
    this.root=new Container({label:'yakyuken-screen-fade',eventMode:'static'});
    this.root.on('pointertap',event=>event.stopPropagation());app.stage.addChild(this.root);
    this.resize(app.screen.width,app.screen.height);
  }
  resize(width,height){
    if(this.disposed)return;
    this.root.removeChildren().forEach(child=>child.destroy({children:true}));
    this.root.hitArea=new Rectangle(0,0,width,height);
    this.backdrop=new Graphics().rect(0,0,width,height).fill(0x0b1020);this.root.addChild(this.backdrop);
    if(this.stage==='error'){
      const message=label(this.errorMessage||'暫時無法載入遊戲\n請再試一次，或返回上一頁。',14,0xf0d6d4,{lineHeight:24,wordWrap:true,wordWrapWidth:width-40});
      message.position.set(width/2,height/2-46);this.root.addChild(message);
      const w=Math.min(168,(width-60)/2);
      const retry=new PixiButton({text:'再試一次',name:'重試野球拳轉場',variant:'gold',width:w,height:48,onPress:this.onRetry});
      const back=new PixiButton({text:'返回上一頁',name:'取消野球拳轉場',width:w,height:48,onPress:this.onBack});
      back.setEnabled(this.allowBack!==false);
      retry.position.set(width/2-(w+12)/2,height/2+30);back.position.set(width/2+(w+12)/2,height/2+30);this.root.addChild(retry,back);
    }
    this.tick(0);
  }
  notify(){this.onChange?.({stage:this.stage,target:0,displayed:0});}
  async open(){
    this.notify();await this.motion.to(this.cover,{value:1},this.cover.value===1?0:ENTRY_TIMING.cover);
    if(this.disposed)return false;this.stage='covered';this.notify();return true;
  }
  async finish(){
    if(this.disposed)return false;this.stage='revealing';this.notify();
    await this.motion.to(this.cover,{value:0},ENTRY_TIMING.reveal);
    if(this.disposed)return false;this.stage='complete';this.notify();return true;
  }
  fail(message,allowBack=true){if(this.disposed)return;this.errorMessage=message;this.allowBack=allowBack;this.stage='error';this.cover.value=1;this.resize(this.app.screen.width,this.app.screen.height);this.notify();}
  tick(elapsed){if(this.disposed)return;this.motion.tick(elapsed);this.backdrop.alpha=this.cover.value;}
  destroy(){if(this.disposed)return;this.disposed=true;this.motion.destroy();this.root.destroy({children:true});}
}
