import {Application,Assets,Container,Graphics,Rectangle,Sprite,Texture} from 'pixi.js';
import 'pixi.js/unsafe-eval';
import 'pixi.js/prepare';
import backgroundUrl from '../../../images/jokers-circus/circus-background.webp';
import mainUrl from '../../../images/main.webp';
import mainAtlas from '../../../images/main.json';
import {DEALER_ART} from './assets.js';
import {CARD_ART,CARD_CANVAS} from './card-assets.js';
import {LOBBY_COVERS} from './lobby-art.js';
import {PreviewAudio} from './audio.js';
import {HandCard} from './pixi/card.js';
import {tableLayout,TABLE_MOVES} from './pixi/layout.js';
import {Motion} from './pixi/motion.js';
import {createChallenge,difficultyRule,playChallengeRound} from './challenge.js';
import {createTable} from './pixi/table.js';
import {label,PALETTE,PixiButton} from './pixi/ui.js';
import {buildSlotHud,updateSlotHud} from './pixi/chrome.js';
import {buildSlotDialog} from './pixi/dialogs.js';
import {buildLobby} from './pixi/lobby.js';
import {canEnterCharacter} from './characters.js';
import {installPointerFeedback} from './pixi/pointer-feedback.js';
import {YakyukenEntryLoading,createYakyukenEntryGradients} from './pixi/entry-loading.js';
import {YakyukenScreenFade} from './pixi/screen-fade.js';
import {waitForEntryTask} from './pixi/entry-state.js';
import {PREVIEW_SLOT_PATH} from '../../platform/game-navigation.js';

// Local probability challenge; wallet settlement remains disconnected.
export class YakyukenScene {
  app = new Application();
  motion = new Motion();
  audio = new PreviewAudio(()=>this.refreshAudioIcons?.());
  abort = new AbortController();
  loaded = new Set();
  screen = 'games';
  selectedCharacter = 'dealer';
  selectedDifficulty = 1;
  challenge = null;
  cardTextures = {};
  entries = 0;
  entering = false;
  entryOverlay = null;
  phase = 'selecting';
  selected = null;
  duel = null;
  completedRounds = 0;
  dealerStage = 'idle';
  pose = 0;
  modal = null;
  epoch = 0;
  disposed = false;

  async init(host) {
    this.host = host;
    const lobbyArrival=new URLSearchParams(location.search).get('transition')==='fade';
    this.audio.start({target:document,signal:this.abort.signal});
    installPointerFeedback(document,this.abort.signal);
    await this.app.init({
      width:Math.max(host.clientWidth,1),height:Math.max(host.clientHeight,1),
      background:0x0b1020,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio || 1,2),
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
    loading.visible=!lobbyArrival;
    loading.position.set(this.app.screen.width/2,this.app.screen.height/2);this.app.stage.addChild(loading);this.app.render();
    const resources = await Promise.allSettled([backgroundUrl,DEALER_ART[0].url,mainUrl,...LOBBY_COVERS.map(art=>art.url)].map(async url => {
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
    this.dealerTextures = [resources[1].value];
    this.lobbyTextures = resources.slice(3).map(value=>value.value);
    const f=mainAtlas.frames['logo-long.png'].frame;
    this.logoTexture=new Texture({source:resources[2].value.source,frame:new Rectangle(f.x,f.y,f.w,f.h)});
    const short=mainAtlas.frames['logo-short.png'].frame;
    this.entryLogoTexture=new Texture({source:resources[2].value.source,frame:new Rectangle(short.x,short.y,short.w,short.h)});
    this.media = matchMedia('(prefers-reduced-motion: reduce)');this.motion.reduced = this.media.matches;
    this.media.addEventListener('change',() => {this.motion.reduced = this.media.matches || !!this.reducePreference;if(this.motion.reduced)this.motion.finish();if(this.entryOverlay){this.entryOverlay.motion.reduced=this.motion.reduced;if(this.motion.reduced)this.entryOverlay.motion.finish();}},{signal:this.abort.signal});
    this.app.ticker.maxFPS = 60;
    this.app.ticker.add(ticker => {this.motion.tick(ticker.elapsedMS);this.entryOverlay?.tick(ticker.elapsedMS);});
    this.observer = new ResizeObserver(() => this.resize());this.observer.observe(host);
    document.addEventListener('keydown',event => this.keydown(event),{signal:this.abort.signal});
    document.addEventListener('visibilitychange',() => {if(document.hidden)this.pause();else this.resume();},{signal:this.abort.signal});
    // A cross-document return starts on the same plain cover as the slot exit.
    // Keep the lobby hidden until its incoming cover exists to prevent a flash.
    if(lobbyArrival)this.root.visible=false;
    this.resize();this.app.start();
    if(lobbyArrival){const arrival=this.beginEntry('arrival');this.root.visible=true;await arrival;}
  }

  resize() {
    if(this.disposed || !this.dealerTextures)return;
    const width=Math.max(this.host.clientWidth,1),height=Math.max(this.host.clientHeight,1);
    this.app.renderer.resize(width,height);this.layout = tableLayout(width,height,{touch:matchMedia('(hover: none) and (pointer: coarse)').matches});
    if(this.screen==='games')this.layout.ui.headerHeight=0;
    this.motion.finish();this.epoch++;
    if(this.phase === 'presenting'){this.phase = 'confirmed';this.dealerStage = 'shown';}
    this.changing=false;
    this.root.removeChildren().forEach(child => child.destroy({children:true}));
    this.modalRoot=null;this.root.scale.set(this.layout.scale);
    this.world = new Container({label:'table-world'});this.root.addChild(this.world);this.overlay = null;
    this.confirmButton=null;this.lobbyButton=null;this.status=null;this.statusDetail=null;this.playerCards=[];this.dealerCards=[];
    if(this.screen==='table'){this.buildRoom();this.buildCards();}
    else{this.buildBackdrop();buildLobby(this);}
    this.buildHud();this.updateControls();
    if(this.modal)this.buildModal(this.modal);
    if(this.entering || this.entryOverlay){this.world.interactiveChildren=false;this.world.accessibleChildren=false;}
    this.entryOverlay?.resize(width,height);
    this.app.render();
  }

  buildBackdrop() {
    const l=this.layout,{w,h}=l;
    const background = new Sprite(this.backgroundTexture);
    background.width=w;background.height=h;background.eventMode='none';this.world.addChild(background);
    const shade = new Graphics().rect(0,0,w,h).fill({color:0x070d1c,alpha:.16});shade.eventMode='none';this.world.addChild(shade);
  }
  buildRoom() {
    const l=this.layout,{w}=l;this.buildBackdrop();
    if(l.logo.width){const logo=new Sprite(this.logoTexture);logo.anchor.set(.5,0);logo.width=l.logo.width;logo.scale.y=logo.scale.x;logo.position.set(l.logo.x,l.logo.y);logo.eventMode='none';this.world.addChild(logo);}
    this.dealer = new Sprite(this.dealerTextures[this.pose]);this.dealer.anchor.set(.5,0);
    this.dealer.height=l.dealer.height;this.dealer.scale.x=this.dealer.scale.y;
    this.dealer.position.set(l.dealer.x,l.dealer.y);this.dealer.eventMode='none';
    this.world.addChild(this.dealer,createTable(l));
  }

  buildCards() {
    const l=this.layout;
    const shown=this.dealerStage==='shown',move=this.duel?.dealer || 'rock';
    const dealerCard=new HandCard({move,index:TABLE_MOVES.indexOf(move),owner:'dealer',motion:this.motion,textures:this.cardTextures});
    dealerCard.place(l.dealerCard.x,l.dealerCard.y,l.dealerCard.scale,0,{selectedLift:0,perspective:1});
    dealerCard.selected=shown;dealerCard.highlight.visible=shown;dealerCard.setFaceUp(shown);
    this.world.addChild(dealerCard);this.dealerCards=[dealerCard];
    this.playerCards=TABLE_MOVES.map((move,index) => {
      const card = new HandCard({move,index,owner:'player',motion:this.motion,textures:this.cardTextures,onChoose:value => this.select(value)});
      card.place(l.playerCards.x+(index-1)*l.playerCards.gap,l.playerCards.y,l.playerCards.scale,(index-1)*.055,{selectedLift:l.selectedLift,hoverLift:l.hoverLift,perspective:l.playerCards.perspective});
      card.selected=move === this.selected;card.highlight.visible=card.selected;if(card.selected)card.y-=this.phase==='confirmed'?l.confirmedLift:l.selectedLift;
      card.lock(this.phase !== 'selecting');this.world.addChild(card);return card;
    });
  }

  buildHud() { buildSlotHud(this); }

  visitScreen(screen){
    if(this.disposed || this.entering || this.entryOverlay || this.phase==='presenting' || this.changing || !['games','characters'].includes(screen))return;
    if(screen==='characters' && this.screen!=='games')return;
    if(screen==='characters')void this.audio.background.setMusicEnabled(true,{retryBlockedPlayback:true});
    return this.beginEntry(screen==='characters'?'game':'lobby');
  }
  openSlot(){
    if(this.disposed || this.entering || this.entryOverlay || this.screen!=='games' || this.modal)return;
    // This local preview opens the existing slot entry without changing its game.
    location.assign(PREVIEW_SLOT_PATH);
  }
  selectCharacter(id){
    if(this.disposed || this.entering || this.entryOverlay || this.screen!=='characters' || !canEnterCharacter(id))return;
    this.selectedCharacter=id;this.updateControls();
  }
  selectDifficulty(id){
    if(this.disposed || this.entering || this.entryOverlay || this.screen!=='characters')return;
    difficultyRule(id);this.selectedDifficulty=id;this.closeModal();this.resize();this.openModal('difficulty');
  }
  enterCharacter(){
    if(this.entering)return this.entryPromise;
    if(this.disposed || this.modal || this.screen!=='characters' || !canEnterCharacter(this.selectedCharacter))return Promise.resolve(false);
    return this.beginEntry('table');
  }
  beginEntry(kind){
    if(this.disposed)return Promise.resolve(false);
    if(this.entering)return this.entryPromise;
    const source=this.screen;this.closeModal();this.app.canvas.dataset.entryKind=kind;
    this.entryOverlay?.destroy();this.entering=true;
    this.world.interactiveChildren=false;this.world.accessibleChildren=false;this.updateControls();
    if(kind==='game')this.entryGradients ??=createYakyukenEntryGradients();
    const Presentation=kind==='game'?YakyukenEntryLoading:YakyukenScreenFade;
    const overlay=this.entryOverlay=new Presentation({app:this.app,logoTexture:this.entryLogoTexture,reduced:this.motion.reduced,gradients:this.entryGradients,covered:kind==='arrival',
      onChange:state=>{
        if(this.disposed)return;
        Object.assign(this.app.canvas.dataset,{entryStage:state.stage,entryProgress:String(Math.floor(state.target)),entryDisplayed:String(Math.floor(state.displayed))});
        this.app.canvas.setAttribute('aria-busy',String(state.stage!=='complete' && state.stage!=='error'));
      },onRetry:()=>this.beginEntry(kind),onBack:()=>this.cancelEntry()});
    const pending=this.performEntry(overlay,kind,source).finally(()=>{if(this.entryPromise===pending)this.entryPromise=null;});
    this.entryPromise=pending;return pending;
  }
  async prepareEntry(overlay){
    let completed=0;
    const artwork=[...DEALER_ART.map((art,index)=>({...art,index})),...Object.entries(CARD_ART).map(([key,url])=>({key,url}))];
    const results=await Promise.allSettled(artwork.map(async art=>{
      if(!(art.key?this.cardTextures[art.key]:this.dealerTextures[art.index])){
        const texture=await Assets.load(art.url);this.loaded.add(art.url);
        if(this.disposed){this.loaded.delete(art.url);await Assets.unload(art.url);return;}
        if(art.key){
          const {width,height}=CARD_CANVAS;
          this.cardTextures[art.key]=new Texture({source:texture.source,frame:texture.frame,
            orig:new Rectangle(0,0,width,height),trim:new Rectangle((width-texture.width)/2,(height-texture.height)/2,texture.width,texture.height)});
        }else this.dealerTextures[art.index]=texture;
      }
      completed++;overlay.update(15+completed/artwork.length*55,'正在準備荷官與典藏牌組…');
    }));
    if(results.some(result=>result.status==='rejected'))throw new Error('Yakyuken entry resources unavailable');
  }
  async performEntry(overlay,kind,source){
    try{
      await overlay.open();if(this.disposed)return false;
      if(kind==='game' && !await waitForEntryTask(this.prepareEntry(overlay),this.abort.signal))return false;
      if(this.disposed)return false;
      overlay.update?.(76,'正在準備選角舞台…');
      this.screen=kind==='table'?'table':kind==='game'?'characters':'games';this.phase='selecting';this.selected=null;this.duel=null;this.dealerStage='idle';
      if(kind==='table'){this.completedRounds=0;this.challenge=createChallenge(this.selectedDifficulty);this.pose=0;}
      this.resize();
      if(!await waitForEntryTask(this.app.renderer.prepare.upload([this.backgroundTexture,...this.dealerTextures,...Object.values(this.cardTextures),this.logoTexture]),this.abort.signal))return false;
      if(this.disposed)return false;
      overlay.update?.(95,'正在佈置舞台…');
      // Compile the current table behind the opaque cover, without retaining
      // Graphics from a world that may be replaced by a viewport resize.
      this.app.render();
      if(!await overlay.finish() || this.disposed)return false;
      if(kind==='table')this.entries++;
      this.entering=false;overlay.destroy();this.entryOverlay=null;
      this.world.interactiveChildren=true;this.world.accessibleChildren=true;this.updateControls();return true;
    }catch{
      if(this.disposed)return false;
      this.entering=false;
      if(this.screen!==source){this.screen=source;this.phase='selecting';this.resize();}
      overlay.fail();this.updateControls();this.world.interactiveChildren=false;this.world.accessibleChildren=false;return false;
    }
  }
  cancelEntry(){
    if(this.disposed || this.entering)return;
    this.entryOverlay?.destroy();this.entryOverlay=null;this.app.canvas.dataset.entryStage='';this.app.canvas.setAttribute('aria-busy','false');
    this.world.interactiveChildren=true;this.world.accessibleChildren=true;this.updateControls();
  }
  select(move) {
    if(this.disposed || this.entering || this.entryOverlay || this.modal || this.screen!=='table' || this.phase !== 'selecting' || !TABLE_MOVES.includes(move))return;
    this.selected=move;this.playerCards.forEach(card => card.choose(card.move === move));this.updateControls();
  }
  async confirm() {
    if(this.disposed || this.entering || this.entryOverlay || this.modal || this.screen!=='table' || this.phase === 'presenting')return;
    if(this.phase === 'confirmed'){
      if(this.challenge.status!=='playing'){
        this.challenge=createChallenge(this.selectedDifficulty);this.completedRounds=0;
      }
      this.phase='selecting';this.selected=null;this.duel=null;this.dealerStage='idle';
      this.playerCards.forEach((card,index) => {card.lock(false);card.choose(false);card.rotation=(index-1)*.055;});
      this.dealerCards.forEach(card => {card.choose(false);card.setFaceUp(false);card.visual.scale.x=1;card.rotation=0;});
      this.updateControls();return;
    }
    if(!this.selected)return;
    this.challenge=playChallengeRound(this.challenge,this.selected);
    this.duel=this.challenge.last;this.completedRounds=this.challenge.rounds;
    this.phase='presenting';this.dealerStage='thinking';this.playerCards.forEach(card => card.lock(true));this.updateControls();
    const epoch=this.epoch,card=this.playerCards.find(value => value.move === this.selected);
    await this.motion.to(card,{y:card.baseY-this.layout.confirmedLift,rotation:0},240);
    if(this.disposed || epoch !== this.epoch)return;
    await this.motion.to({time:0},{time:1},260);
    if(this.disposed || epoch !== this.epoch)return;
    this.dealerStage='playing';
    const dealerCard=this.dealerCards[0];
    dealerCard.setMove(this.duel.dealer,TABLE_MOVES.indexOf(this.duel.dealer));
    dealerCard.selected=true;dealerCard.highlight.visible=true;
    this.updateControls();
    await Promise.all([this.motion.to(dealerCard,{y:dealerCard.baseY-this.layout.dealerLift,rotation:0},280),dealerCard.reveal(()=>this.updateControls())]);
    if(this.disposed || epoch !== this.epoch)return;
    this.phase='confirmed';this.dealerStage='shown';this.updateControls();
  }
  updateControls() {
    updateSlotHud(this);
    const fronts=this.dealerCards.filter(card=>card.faceUp).length;
    Object.assign(this.app.canvas.dataset,{screen:this.screen,phase:this.entering?'entering':this.screen==='table'?this.phase:this.screen,selected:this.selected || '',pose:String(this.pose),scene:this.screen==='table'?'yakyuken-table':'circus-lobby',dealerStage:this.dealerStage,
      dealerFrontCount:String(fronts),dealerMove:fronts?this.duel?.dealer || '':'',outcome:this.phase==='confirmed'?this.duel?.outcome || '':'',round:String(this.completedRounds),uiStyle:'theatre-cards',character:this.selectedCharacter,entries:String(this.entries),
      difficulty:String(this.selectedDifficulty),wins:String(this.challenge?.wins || 0),losses:String(this.challenge?.losses || 0),draws:String(this.challenge?.draws || 0),challengeStatus:this.challenge?.status || '',reward:String(this.challenge?.reward || 0)});
    this.app.canvas.setAttribute('aria-label',this.entering?(this.app.canvas.dataset.entryKind==='game'?'野球拳，正在載入遊戲。':'正在切換畫面。'):this.screen==='table'?`野球拳第一人稱牌桌。${this.scoreDescription}。${this.status.text.replaceAll('\n','。')}。${this.statusDetail.text.replaceAll('\n','。')}。右側荷官牌${fronts?'已翻開':'尚未揭曉'}。`:this.screen==='games'?'Joker’s Circus 遊戲大廳，請選擇老虎機或野球拳。':'野球拳角色選擇，共五個角色位置。目前開放命運荷官，本機入場暫不扣款。');
  }

  openModal(type) {
    if(type==='history' || type==='difficulty' && this.screen!=='characters')return;
    if(this.disposed || this.entering || this.entryOverlay || this.phase === 'presenting' || this.changing || type==='wardrobe' && this.screen!=='table')return;
    this.closeModal();this.modal=type;this.buildModal(type);
  }
  closeModal() {
    this.modal=null;if(this.modalRoot){this.modalRoot.destroy({children:true});this.modalRoot=null;}
    if(this.world){this.world.interactiveChildren=true;this.world.accessibleChildren=true;}
    this.app.canvas.dataset.modal='';
  }
  buildModal(type) { buildSlotDialog(this,type); }

  async changePose(index) {
    if(this.changing || this.disposed || this.entering || this.entryOverlay || this.screen!=='table')return;
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
    this.pose=index;this.dealer.texture=this.dealerTextures[index];this.app.canvas.dataset.pose=String(index);
    await this.motion.to({time:0},{time:1},300);await this.motion.to(overlay,{alpha:0},320);
    if(this.disposed || epoch !== this.epoch)return;
    overlay.destroy({children:true});this.overlay=null;this.changing=false;this.world.interactiveChildren=true;this.world.accessibleChildren=true;
  }
  keydown(event) {
    if(event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || this.disposed || this.entering || this.entryOverlay || document.hidden)return;
    if(event.key==='Escape'){event.preventDefault();if(this.modal)this.closeModal();else if(!this.changing && this.screen!=='games')this.openModal('menu');return;}
    if(this.modal || this.changing || this.screen!=='table')return;
    const move=TABLE_MOVES[Number(event.key)-1];
    if(move){event.preventDefault();this.select(move);}
    else if(event.key==='Enter' && (event.target===document.body || event.target===this.app.canvas || this.selected && event.target?.getAttribute('aria-label')?.startsWith('選擇'))){event.preventDefault();void this.confirm();}
  }
  pause() {if(this.disposed || !this.initialized)return;this.motion.suspended=true;this.motion.finish();if(this.entryOverlay){this.entryOverlay.motion.suspended=true;this.entryOverlay.motion.finish();}this.audio.pauseMusic();this.app.stop();}
  resume() {if(!this.disposed && this.dealerTextures && !document.hidden){this.motion.suspended=false;if(this.entryOverlay)this.entryOverlay.motion.suspended=false;this.audio.resumeMusic();this.app.start();}}
  async unload() {const urls=[...this.loaded];this.loaded.clear();await Promise.allSettled(urls.map(url => Assets.unload(url)));}
  async destroy() {
    if(this.disposed)return;this.disposed=true;this.abort.abort();this.observer?.disconnect();this.motion.destroy();this.entryOverlay?.destroy();this.entryOverlay=null;this.audio.destroy();
    if(this.initialized){this.app.stop();this.app.destroy({removeView:true,releaseGlobalResources:true},{children:true});}
    this.entryGradients?.forEach(gradient=>gradient.destroy());this.entryGradients=null;
    this.logoTexture?.destroy();this.entryLogoTexture?.destroy();
    Object.values(this.cardTextures).forEach(texture=>texture.destroy());this.cardTextures={};await this.unload();
  }
}
