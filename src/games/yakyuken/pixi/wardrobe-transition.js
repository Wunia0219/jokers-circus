import {BlurFilter,Container,FillGradient,Graphics,Rectangle,RenderTexture,Sprite,Texture} from 'pixi.js';
import {label,PALETTE} from '../../../ui/pixi/ui.js';
import {WARDROBE_DURATION,wardrobeFrame} from '../duel-presentation.js';

// Scene-owned textures remain alive until the renderer closes its bindings.
export function createWardrobeGradients(){return [
  new FillGradient({type:'radial',center:{x:.5,y:.5},innerRadius:0,outerRadius:.5,colorStops:[{offset:0,color:'#e5bb712b'},{offset:.5,color:'#b4824214'},{offset:1,color:'#b4824200'}]}),
  new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:'#080d2000'},{offset:.5,color:'#080d20aa'},{offset:1,color:'#080d20ee'}]}),
];}

export function createWardrobeBackdrop(){
  const layer=new Container({label:'wardrobe-transition',eventMode:'none',interactiveChildren:false});
  layer.on('pointertap',event=>event.stopPropagation());
  return {layer,texture:RenderTexture.create({width:1,height:1,resolution:.5}),blur:new BlurFilter({strength:8,quality:3,resolution:.5})};
}
function unbindFilter(blur){
  for(const group of new Set([blur.blurXFilter.groups[0],blur.blurYFilter.groups[0]])){
    group.setResource(Texture.EMPTY.source,1);group.setResource(Texture.EMPTY.source.style,2);
  }
}
// Released with the scene, after the renderer closes its sprite bindings.
export function destroyWardrobeBackdrop(backdrop){
  if(!backdrop)return;
  if(!backdrop.layer.destroyed)backdrop.layer.destroy({children:true});
  unbindFilter(backdrop.blur);backdrop.blur.blurXFilter.destroy();backdrop.blur.blurYFilter.destroy();backdrop.blur.destroy();
  backdrop.texture.destroy(true);
}

export class WardrobeTransition {
  elapsed=0;
  committed=false;
  disposed=false;
  constructor({app,background,to,name,reduced,onCommit,onChange,gradients,backdrop,subject}){
    Object.assign(this,{app,background,to,name,reduced,onCommit,onChange,gradients,backdrop,subject});
    this.done=new Promise(resolve=>{this.resolve=resolve;});
    this.root=backdrop.layer;this.root.alpha=1;this.root.eventMode='static';
    this.previousVisible=background.visible;
    this.resize(app.screen.width,app.screen.height);
  }
  play(){
    if(this.reduced){this.finish();return this.done;}
    this.app.stage.addChild(this.root);this.tick(0);return this.done;
  }
  resize(width,height){
    if(this.disposed)return;
    this.root.removeChildren().forEach(child=>child.destroy({children:true}));
    this.root.hitArea=new Rectangle(0,0,width,height);
    if(!this.reduced)this.capture(width,height);
    this.frost=new Sprite(this.backdrop.texture);this.frost.width=width;this.frost.height=height;this.root.addChild(this.frost);
    this.shade=new Graphics().rect(0,0,width,height).fill({color:0x080d20,alpha:.78});
    this.glow=new Graphics();this.glow.context.batchMode='batch';
    this.glow.ellipse(width/2,height*.45,Math.min(width*.55,height*.4),height*.44).fill(this.gradients[0]);
    this.root.addChild(this.shade,this.glow);
    this.next=this.portrait(this.to,width,height);this.next.label='wardrobe-new-outfit';this.root.addChild(this.next);
    this.caption=new Container({label:'wardrobe-caption',eventMode:'none'});
    const fade=new Graphics();fade.context.batchMode='batch';
    fade.rect(0,height-220,width,220).fill(this.gradients[1]);this.caption.addChild(fade);
    const title=label(this.name,width<650?24:32,PALETTE.bright,{fontWeight:'500',letterSpacing:3});title.position.set(width/2,height-85);
    this.caption.addChild(title);this.root.addChild(this.caption);this.draw();
  }
  capture(width,height){
    const {background,backdrop}=this,filters=background.filters,area=background.filterArea;
    const visible=background.visible,overlayVisible=this.root.visible;
    const subject=this.subject?.(),subjectVisible=subject?.visible;
    this.root.visible=false;background.visible=true;
    if(subject)subject.visible=false;
    background.filters=[...(filters || []),backdrop.blur];
    background.filterArea=new Rectangle(0,0,width/background.scale.x,height/background.scale.y);
    try{
      // Bake the blur once at bounded resolution. Normal animation frames use
      // one sprite, with no full-scene filter passes or render-target churn.
      backdrop.texture.source.resize(width,height,Math.min(.5,1280/width,720/height));
      this.app.renderer.render({container:this.app.stage,target:backdrop.texture,clear:true,clearColor:0x0b1020});
    }finally{
      background.filters=filters;background.filterArea=area;background.visible=visible;this.root.visible=overlayVisible;
      if(subject)subject.visible=subjectVisible;
      unbindFilter(backdrop.blur);
    }
  }
  portrait(texture,width,height){
    const sprite=new Sprite(texture);sprite.anchor.set(.5,0);
    sprite.height=Math.min(height*1.10,width*.86/(texture.width/texture.height));sprite.scale.x=sprite.scale.y;
    sprite.position.set(width/2,Math.max(12,(height-158-sprite.height*.74)/2));return sprite;
  }
  draw(){
    if(this.disposed)return;
    const frame=wardrobeFrame(this.elapsed);
    this.frost.alpha=frame.focus;
    this.shade.alpha=frame.focus;this.glow.alpha=frame.focus;
    this.next.alpha=frame.newAlpha*frame.focus;
    this.caption.alpha=frame.focus;
    this.onChange?.({elapsed:this.elapsed,...frame});
  }
  tick(elapsed){
    if(this.disposed)return;
    this.elapsed+=Math.max(0,elapsed);
    const frame=wardrobeFrame(this.elapsed);
    if(frame.committed && !this.committed){this.committed=true;this.onCommit();}
    this.draw();if(frame.complete)this.destroy(true);
  }
  finish(){this.tick(WARDROBE_DURATION);}
  destroy(completed=false){
    if(this.disposed)return;this.disposed=true;
    this.background.visible=this.previousVisible;
    // Retain the overlay tree too: destroying text/graphics here invalidates
    // the stage's render instructions on the first frame back at the table.
    this.root.alpha=0;this.root.eventMode='none';
    // Keep the baked texture and shaders for the next reveal. Returning to the
    // table does not delete GPU textures or compile the filter again.
    this.resolve(completed);
  }
}
