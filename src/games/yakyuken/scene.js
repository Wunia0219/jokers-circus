import {Application,Assets,Container,Graphics,Rectangle,Sprite,Texture} from 'pixi.js';
import 'pixi.js/unsafe-eval';
import backgroundUrl from '../../../images/jokers-circus/circus-background.webp';
import mainUrl from '../../../images/main.webp';
import mainAtlas from '../../../images/main.json';
import {DEALER_ART} from './assets.js';
import {PreviewAudio} from './audio.js';
import {HandCard} from './pixi/card.js';
import {tableLayout,TABLE_MOVES,TABLE_MOVE_NAMES} from './pixi/layout.js';
import {Motion} from './pixi/motion.js';
import {demoDuel} from './pixi/demo-duel.js';
import {createTable} from './pixi/table.js';
import {label,PALETTE,PixiButton} from './pixi/ui.js';
import {buildSlotHud,updateSlotHud} from './pixi/chrome.js';
import {buildSlotDialog} from './pixi/dialogs.js';

// Fixed demonstration choreography; no probability or wallet dependency.
export class YakyukenScene {
  app = new Application();
  motion = new Motion();
  audio = new PreviewAudio();
  abort = new AbortController();
  loaded = new Set();
  phase = 'selecting';
  selected = null;
  duel = null;
  completedRounds = 0;
  history = [];
  dealerStage = 'idle';
  pose = 0;
  modal = null;
  epoch = 0;
  disposed = false;

  async init(host) {
    this.host = host;
    await this.app.init({
      width:Math.max(host.clientWidth,1),height:Math.max(host.clientHeight,1),
      background:0x211426,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio || 1,2),
      preference:'webgl',autoStart:false,sharedTicker:false,
      accessibilityOptions:{enabledByDefault:true,deactivateOnMouseMove:false},
      eventFeatures:{move:true,click:true,globalMove:false,wheel:false},
    });
    this.initialized = true;
    if(this.disposed){this.app.destroy({removeView:true},{children:true});return;}
    host.replaceChildren(this.app.canvas);
    this.app.canvas.setAttribute('role','application');
    this.app.canvas.setAttribute('aria-label','野球拳：正在準備牌桌');
    this.root = new Container({label:'yakyuken-scene'});this.app.stage.addChild(this.root);
    const loading = label('正在準備舞台…',13,PALETTE.gold);
    loading.position.set(this.app.screen.width/2,this.app.screen.height/2);this.app.stage.addChild(loading);this.app.render();
    const resources = await Promise.allSettled([backgroundUrl,...DEALER_ART.map(art => art.url),mainUrl].map(async url => {
      const texture = await Assets.load(url);this.loaded.add(url);return texture;
    }));
    if(this.disposed){await this.unload();return;}
    loading.destroy();
    if(resources.some(value => value.status === 'rejected')) {
      await this.unload();
      const message = label('舞台素材載入失敗\n請重新載入試玩',17,PALETTE.gold,{lineHeight:30});
      message.position.set(this.app.screen.width/2,this.app.screen.height/2-40);
      const retry = new PixiButton({text:'重新載入',width:200,onPress:() => location.reload(),primary:true});
      retry.position.set(this.app.screen.width/2,this.app.screen.height/2+65);
      this.app.stage.addChild(message,retry);this.app.canvas.dataset.phase = 'error';this.app.render();return;
    }
    this.backgroundTexture = resources[0].value;
    this.dealerTextures = resources.slice(1,4).map(value => value.value);
    const f=mainAtlas.frames['logo-long.png'].frame;
    this.logoTexture=new Texture({source:resources[4].value.source,frame:new Rectangle(f.x,f.y,f.w,f.h)});
    this.media = matchMedia('(prefers-reduced-motion: reduce)');this.motion.reduced = this.media.matches;
    this.media.addEventListener('change',() => {this.motion.reduced = this.media.matches || !!this.reducePreference;if(this.motion.reduced)this.motion.finish();},{signal:this.abort.signal});
    this.app.ticker.maxFPS = 60;
    this.app.ticker.add(ticker => this.motion.tick(ticker.elapsedMS));
    this.observer = new ResizeObserver(() => this.resize());this.observer.observe(host);
    document.addEventListener('keydown',event => this.keydown(event),{signal:this.abort.signal});
    document.addEventListener('visibilitychange',() => {if(document.hidden)this.pause();else this.resume();},{signal:this.abort.signal});
    this.resize();this.app.start();
  }

  resize() {
    if(this.disposed || !this.dealerTextures)return;
    const width=Math.max(this.host.clientWidth,1),height=Math.max(this.host.clientHeight,1);
    this.app.renderer.resize(width,height);this.layout = tableLayout(width,height,{touch:matchMedia('(hover: none) and (pointer: coarse)').matches});
    this.motion.finish();this.epoch++;
    if(this.phase === 'presenting'){this.phase = 'confirmed';this.dealerStage = 'shown';}
    this.changing=false;
    this.root.removeChildren().forEach(child => child.destroy({children:true}));
    this.modalRoot=null;this.root.scale.set(this.layout.scale);
    this.world = new Container({label:'table-world'});this.root.addChild(this.world);this.overlay = null;
    this.buildRoom();this.buildCards();this.buildHud();this.updateControls();
    if(this.modal)this.buildModal(this.modal);
    this.app.render();
  }

  buildRoom() {
    const l=this.layout,{w,h}=l;
    const background = new Sprite(this.backgroundTexture);
    background.width=w;background.height=l.portrait?h*.59:h;background.eventMode='none';this.world.addChild(background);
    const shade = new Graphics().rect(0,0,w,h).fill({color:0x070d1c,alpha:.16});shade.eventMode='none';this.world.addChild(shade);
    if(l.logo.width){const logo=new Sprite(this.logoTexture);logo.anchor.set(.5,0);logo.width=l.logo.width;logo.scale.y=logo.scale.x;logo.position.set(l.logo.x,l.logo.y);logo.eventMode='none';this.world.addChild(logo);}
    this.dealer = new Sprite(this.dealerTextures[this.pose]);this.dealer.anchor.set(.5,0);
    this.dealer.height=l.dealer.height;this.dealer.scale.x=this.dealer.scale.y;
    this.dealer.position.set(l.dealer.x,l.dealer.y);this.dealer.eventMode='none';
    this.world.addChild(this.dealer,createTable(l));
    if(l.ui.gameBottom-l.ui.gameTop>280){const name=label('命運荷官',13/l.scale,PALETTE.gold);name.position.set(w/2,l.dealerCards.y-100*l.dealerCards.scale-12/l.scale);this.world.addChild(name);}
  }

  buildCards() {
    const l=this.layout;
    this.dealerCards=TABLE_MOVES.map((move,index) => {
      const card = new HandCard({move,index,owner:'dealer',motion:this.motion});
      card.place(l.dealerCards.x+(index-1)*l.dealerCards.gap,l.dealerCards.y,l.dealerCards.scale,(index-1)*.035,{selectedLift:l.dealerLift});
      const shown=this.dealerStage==='shown';
      card.selected=shown && this.duel?.dealer===move;card.highlight.visible=card.selected;
      card.setFaceUp(!!card.selected);
      if(card.selected){card.y-=l.dealerLift;card.rotation=0;}
      card.alpha=shown && !card.selected ? .45 : .94;
      this.world.addChild(card);return card;
    });
    this.playerCards=TABLE_MOVES.map((move,index) => {
      const card = new HandCard({move,index,owner:'player',motion:this.motion,onChoose:value => this.select(value)});
      card.place(l.playerCards.x+(index-1)*l.playerCards.gap,l.playerCards.y,l.playerCards.scale,(index-1)*.055,{selectedLift:l.selectedLift,hoverLift:l.hoverLift});
      card.selected=move === this.selected;card.highlight.visible=card.selected;if(card.selected)card.y-=this.phase==='confirmed'?l.confirmedLift:l.selectedLift;
      card.lock(this.phase !== 'selecting');this.world.addChild(card);return card;
    });
  }

  buildHud() { buildSlotHud(this); }

  select(move) {
    if(this.disposed || this.modal || this.phase !== 'selecting' || !TABLE_MOVES.includes(move))return;
    this.selected=move;this.playerCards.forEach(card => card.choose(card.move === move));this.audio.cue('draw');this.updateControls();
  }
  async confirm() {
    if(this.disposed || this.modal || this.phase === 'presenting')return;
    if(this.phase === 'confirmed'){
      this.phase='selecting';this.selected=null;this.duel=null;this.dealerStage='idle';
      this.playerCards.forEach((card,index) => {card.lock(false);card.choose(false);card.rotation=(index-1)*.055;});
      this.dealerCards.forEach((card,index) => {card.choose(false);card.setFaceUp(false);card.visual.scale.x=1;card.alpha=.94;card.rotation=(index-1)*.035;});
      this.updateControls();return;
    }
    if(!this.selected)return;
    this.duel=demoDuel(this.completedRounds,this.selected);this.completedRounds++;
    this.history.push({...this.duel,round:this.completedRounds});
    this.phase='presenting';this.dealerStage='thinking';this.playerCards.forEach(card => card.lock(true));this.updateControls();
    const epoch=this.epoch,card=this.playerCards.find(value => value.move === this.selected);
    await this.motion.to(card,{y:card.baseY-this.layout.confirmedLift,rotation:0},240);
    if(this.disposed || epoch !== this.epoch)return;
    await this.motion.to({time:0},{time:1},260);
    if(this.disposed || epoch !== this.epoch)return;
    this.dealerStage='playing';
    const dealerCard=this.dealerCards.find(value => value.move===this.duel.dealer);
    this.dealerCards.forEach(value => {value.selected=value===dealerCard;value.highlight.visible=value.selected;value.alpha=value.selected ? .94 : .45;});
    this.updateControls();
    await Promise.all([this.motion.to(dealerCard,{y:dealerCard.baseY-this.layout.dealerLift,rotation:0},280),dealerCard.reveal(()=>this.updateControls())]);
    if(this.disposed || epoch !== this.epoch)return;
    this.phase='confirmed';this.dealerStage='shown';this.audio.cue(this.duel.outcome);this.updateControls();
  }
  updateControls() {
    if(!this.confirmButton)return;
    updateSlotHud(this);
    const result=this.duel?{win:'你贏了',loss:'荷官獲勝',draw:'平手'}[this.duel.outcome]:'';
    this.status.text=this.phase==='confirmed'?`${result}，你出${TABLE_MOVE_NAMES[this.selected]}，荷官出${TABLE_MOVE_NAMES[this.duel.dealer]}`:this.phase==='presenting'?'荷官正在出牌':this.selected?'準備好了，就出這一張。':'請選擇一張手牌';
    this.status.visible=!this.selected;this.statusDetail.visible=false;
    const fronts=this.dealerCards.filter(card=>card.faceUp).length;
    Object.assign(this.app.canvas.dataset,{phase:this.phase,selected:this.selected || '',pose:String(this.pose),scene:'yakyuken-table',dealerStage:this.dealerStage,
      dealerFrontCount:String(fronts),dealerMove:fronts?this.duel?.dealer || '':'',outcome:this.phase==='confirmed'?this.duel?.outcome || '':'',round:String(this.completedRounds),uiStyle:'slot'});
    this.app.canvas.setAttribute('aria-label',`野球拳第一人稱牌桌。${this.status.text}。荷官已翻開 ${fronts} 張牌，其餘為背面。`);
  }

  openModal(type) {
    if(this.disposed || this.phase === 'presenting' || this.changing)return;
    this.closeModal();this.modal=type;this.buildModal(type);
  }
  closeModal() {
    this.modal=null;if(this.modalRoot){this.modalRoot.destroy({children:true});this.modalRoot=null;}
    if(this.world){this.world.interactiveChildren=true;this.world.accessibleChildren=true;}
    this.app.canvas.dataset.modal='';
  }
  buildModal(type) { buildSlotDialog(this,type); }

  async changePose(index) {
    if(this.changing || this.disposed)return;
    this.closeModal();if(index === this.pose)return;
    this.changing=true;this.world.interactiveChildren=false;this.world.accessibleChildren=false;
    const epoch=this.epoch,{w,h}=this.layout,overlay=new Container({label:'wardrobe-emblem'});overlay.alpha=0;
    const shade=new Graphics().rect(0,0,w,h).fill({color:0x080b17,alpha:.96});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,w,h);overlay.addChild(shade);
    const emblem=new Container();emblem.position.set(w/2,h/2-30);
    const star=new Graphics().star(0,0,8,120,68).fill({color:0x784b22,alpha:.3}).stroke({color:PALETTE.gold,width:2});
    const frame=new Graphics().poly([0,-88,68,0,0,88,-68,0]).stroke({color:PALETTE.gold,width:1});emblem.addChild(star,frame,label('幕',68,PALETTE.bright));overlay.addChild(emblem);
    const caption=label(DEALER_ART[index].name,34,PALETTE.gold,{letterSpacing:6});caption.position.set(w/2,h/2+150);overlay.addChild(caption);
    this.root.addChild(overlay);this.overlay=overlay;
    await this.motion.to(overlay,{alpha:1},220);
    if(this.disposed || epoch !== this.epoch)return;
    this.pose=index;this.dealer.texture=this.dealerTextures[index];this.app.canvas.dataset.pose=String(index);this.audio.cue('win');
    await this.motion.to({time:0},{time:1},300);await this.motion.to(overlay,{alpha:0},320);
    if(this.disposed || epoch !== this.epoch)return;
    overlay.destroy({children:true});this.overlay=null;this.changing=false;this.world.interactiveChildren=true;this.world.accessibleChildren=true;
  }
  keydown(event) {
    if(event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || this.disposed || document.hidden)return;
    if(event.key==='Escape'){event.preventDefault();if(this.modal)this.closeModal();else if(!this.changing)this.openModal('menu');return;}
    if(this.modal || this.changing)return;
    const move=TABLE_MOVES[Number(event.key)-1];
    if(move){event.preventDefault();this.select(move);}
    else if(event.key==='Enter' && (event.target===document.body || event.target===this.app.canvas || this.selected && event.target?.getAttribute('aria-label')?.startsWith('選擇'))){event.preventDefault();void this.confirm();}
  }
  pause() {if(this.disposed || !this.initialized)return;this.motion.suspended=true;this.motion.finish();this.audio.pauseMusic();this.app.stop();}
  resume() {if(!this.disposed && this.dealerTextures && !document.hidden){this.motion.suspended=false;this.audio.resumeMusic();this.app.start();}}
  async unload() {const urls=[...this.loaded];this.loaded.clear();await Promise.allSettled(urls.map(url => Assets.unload(url)));}
  async destroy() {
    if(this.disposed)return;this.disposed=true;this.abort.abort();this.observer?.disconnect();this.motion.destroy();this.audio.destroy();
    if(this.initialized){this.app.stop();this.app.destroy({removeView:true,releaseGlobalResources:true},{children:true});}
    this.logoTexture?.destroy();await this.unload();
  }
}
