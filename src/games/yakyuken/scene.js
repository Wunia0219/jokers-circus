import {Application,Assets,Container,Graphics,Rectangle,Sprite,Texture,UPDATE_PRIORITY} from 'pixi.js';
import 'pixi.js/unsafe-eval';
import 'pixi.js/prepare';
import backgroundUrl from '../../../images/jokers-circus/circus-background.webp';
import mainUrl from '../../../images/main.webp';
import mainAtlas from '../../../images/main.json';
import {CHARACTER_ART,CHARACTER_INTROS} from './assets.js';
import {CG_ART} from './cg-catalog.js';
import {CARD_ART,CARD_CANVAS} from './card-assets.js';
import {LOBBY_COVERS} from './lobby-art.js';
import {PreviewAudio} from './audio.js';
import {HandCard} from './pixi/card.js';
import {tableLayout,TABLE_MOVES} from './pixi/layout.js';
import {Motion} from './pixi/motion.js';
import {WardrobeTransition,createWardrobeGradients,createWardrobeBackdrop,destroyWardrobeBackdrop} from './pixi/wardrobe-transition.js';
import {earnedPose,resultDialogue} from './duel-presentation.js';
import {createChallenge,playChallengeRound,applyChallengeDuel} from './challenge.js';
import {PlayerArchive} from './player-archive.js';
import {createTable} from './pixi/table.js';
import {label,PALETTE,PixiButton} from './pixi/ui.js';
import {buildSlotHud,updateSlotHud} from './pixi/chrome.js';
import {buildSlotDialog} from './pixi/dialogs.js';
import {buildLobby} from './pixi/lobby.js';
import {CHARACTERS,canEnterCharacter,characterRule} from './characters.js';
import {installPointerFeedback} from './pixi/pointer-feedback.js';
import {YakyukenEntryLoading,createYakyukenEntryGradients} from './pixi/entry-loading.js';
import {YakyukenScreenFade} from './pixi/screen-fade.js';
import {waitForEntryTask} from './pixi/entry-state.js';
import {slotEntryPath} from '../../platform/game-navigation.js';
import {loadPlayerPortrait,updateBalance} from './pixi/player-display.js';
import {RewardPresentation} from './reward-presentation.js';
import {createCheckinDialog} from './checkin-dialog.js';
import {createCheckinButton} from '../../ui/player/checkin-button.js';
import {checkinClaimFeedback,playerError} from '../../ui/player/player-copy.js';
import {icon} from '../../ui/shared/icons.js';

// Local previews use an archive; cloud and Discord tests inject a test wallet.
export class YakyukenScene {
  app = new Application();
  motion = new Motion();
  rewardPresentation = new RewardPresentation();
  abort = new AbortController();
  loaded = new Set();
  screen = 'games';
  selectedCharacter = 'dealer';
  challenge = null;
  cardTextures = {};
  entries = 0;
  entering = false;
  entryOverlay = null;
  phase = 'selecting';
  selected = null;
  duel = null;
  handTurn = null;
  completedRounds = 0;
  dealerStage = 'idle';
  pose = 0;
  presentedRound = 0;
  dialogue = '';
  wardrobe = null;
  ending = false;
  modal = null;
  epoch = 0;
  disposed = false;
  matchId = null;
  historyScroll = 0;
  cgIndex = 0;
  galleryCharacter = null;
  galleryAnchor = 0;

  get characterTextures(){return this.artTextures?.[this.selectedCharacter];}
  get characterCG(){return CG_ART[this.selectedCharacter];}

  constructor({playerId='local-guest',storage,wallet=null,music=null}={}){
    this.wallet=wallet;this.archive=wallet?.archive??new PlayerArchive({playerId,...(storage===undefined?{}:{storage})});
    this.audio=new PreviewAudio(()=>{this.refreshAudioIcons?.();this.updateLobbyMusic();},music);
  }

  async init(host) {
    this.host = host;
    loadPlayerPortrait(this);
    const lobbyArrival=new URLSearchParams(location.search).get('transition')==='fade';
    this.audio.start({target:document,signal:this.abort.signal});
    installPointerFeedback(document,this.abort.signal);
    await this.app.init({
      width:Math.max(host.clientWidth,1),height:Math.max(host.clientHeight,1),
      background:0x0b1020,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio || 1,2),
      preference:'webgl',autoStart:false,sharedTicker:false,
      accessibilityOptions:{enabledByDefault:true,deactivateOnMouseMove:false},
      eventFeatures:{move:true,click:true,globalMove:false,wheel:true},
    });
    this.initialized = true;
    if(this.disposed){this.app.destroy({removeView:true},{children:true});return;}
    host.replaceChildren(this.app.canvas);
    this.app.renderer.accessibility.div.classList.add('yakyuken-pixi-accessibility');
    this.checkinButton=createCheckinButton(()=>this.showCheckin());
    const music=this.lobbyMusicButton=document.createElement('button');
    music.type='button';music.className='lobby-music';music.hidden=true;
    music.setAttribute('aria-label','背景音樂');
    music.addEventListener('click',()=>void this.audio.toggleMusic(),{signal:this.abort.signal});
    host.append(this.checkinButton.element,music);
    this.app.canvas.setAttribute('role','application');
    this.app.canvas.setAttribute('aria-label','野球拳：正在準備牌桌');
    this.root = new Container({label:'yakyuken-scene'});this.app.stage.addChild(this.root);
    const loading = label('正在準備舞台…',13,PALETTE.gold);
    loading.visible=!lobbyArrival;
    loading.position.set(this.app.screen.width/2,this.app.screen.height/2);this.app.stage.addChild(loading);this.app.render();
    const resources = await Promise.allSettled([backgroundUrl,CHARACTER_ART.dealer[0],mainUrl,...LOBBY_COVERS.map(art=>art.url)].map(async url => {
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
    this.artTextures=Object.fromEntries(Object.keys(CHARACTER_ART).map(id=>[id,[]]));
    this.artTextures.dealer[0]=resources[1].value;
    this.lobbyTextures = resources.slice(3).map(value=>value.value);
    const f=mainAtlas.frames['logo-long.png'].frame;
    this.logoTexture=new Texture({source:resources[2].value.source,frame:new Rectangle(f.x,f.y,f.w,f.h)});
    const short=mainAtlas.frames['logo-short.png'].frame;
    this.entryLogoTexture=new Texture({source:resources[2].value.source,frame:new Rectangle(short.x,short.y,short.w,short.h)});
    this.media = matchMedia('(prefers-reduced-motion: reduce)');this.motion.reduced = this.media.matches;
    this.media.addEventListener('change',() => {this.motion.reduced = this.media.matches || !!this.reducePreference;if(this.motion.reduced){this.motion.finish();this.wardrobe?.finish();}if(this.entryOverlay){this.entryOverlay.motion.reduced=this.motion.reduced;if(this.motion.reduced)this.entryOverlay.motion.finish();}},{signal:this.abort.signal});
    this.app.ticker.maxFPS = 60;
    this.app.ticker.add(ticker => {this.motion.tick(ticker.elapsedMS);this.entryOverlay?.tick(ticker.elapsedMS);this.wardrobe?.tick(ticker.elapsedMS);this.tickReward(ticker.elapsedMS);});
    this.observer = new ResizeObserver(() => {
      const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);
      if(this.disposed || this.resizeFrame || width===this.layout?.ui.width && height===this.layout?.ui.height)return;
      // Rebuild outside ResizeObserver delivery so canvas/accessibility layout
      // cannot schedule another notification inside the same delivery cycle.
      this.resizeFrame=requestAnimationFrame(()=>{
        this.resizeFrame=0;
        if(!this.disposed && (Math.max(host.clientWidth,1)!==this.layout?.ui.width || Math.max(host.clientHeight,1)!==this.layout?.ui.height))this.resize();
      });
    });this.observer.observe(host);
    document.addEventListener('keydown',event => this.keydown(event),{signal:this.abort.signal});
    document.addEventListener('visibilitychange',() => {if(document.hidden)this.pause();else this.resume();},{signal:this.abort.signal});
    addEventListener('storage',event=>{if(this.archive.owns(event.key) && ['collection','history'].includes(this.modal))this.openModal(this.modal);},{signal:this.abort.signal});
    // A cross-document return starts on the same plain cover as the slot exit.
    // Keep the lobby hidden until its incoming cover exists to prevent a flash.
    if(lobbyArrival)this.root.visible=false;
    this.resize();this.app.start();
    if(lobbyArrival){const arrival=this.beginEntry('arrival');this.root.visible=true;await arrival;}
  }

  resize() {
    if(this.disposed || !this.artTextures)return;
    const width=Math.max(this.host.clientWidth,1),height=Math.max(this.host.clientHeight,1);
    this.app.renderer.resize(width,height);this.layout = tableLayout(width,height,{touch:matchMedia('(hover: none) and (pointer: coarse)').matches});
    if(this.screen==='games')this.layout.ui.headerHeight=0;
    this.motion.finish();this.epoch++;
    const wasPresenting=this.phase==='presenting';
    if(wasPresenting){
      if(this.handTurn)this.handTurn.presented=true;
      this.phase=this.handTurn&&!this.handTurn.settled?(this.handTurn.error?'retrying':'confirming'):'confirmed';this.dealerStage='shown';
    }
    this.changing=!!this.wardrobe;
    this.root.removeChildren().forEach(child => child.destroy({children:true}));
    this.modalRoot=null;this.root.scale.set(this.layout.scale);
    this.world = new Container({label:'table-world'});this.root.addChild(this.world);this.overlay = null;
    this.confirmButton=null;this.lobbyButton=null;this.status=null;this.statusDetail=null;this.playerCards=[];this.dealerCards=[];
    if(this.screen==='table'){this.buildRoom();this.buildCards();}
    else{this.buildBackdrop();buildLobby(this);}
    this.buildHud();this.updateControls();
    if(this.modal)this.buildModal(this.modal);
    this.syncWorldInput();
    this.entryOverlay?.resize(width,height);this.wardrobe?.resize(width,height);
    this.app.render();
    if(wasPresenting){
      this.playReveal(this.handTurn);
      if(this.phase==='confirmed')void this.presentResult();
    }
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
    this.dealer = new Sprite(this.characterTextures[this.pose]);this.dealer.anchor.set(.5,0);
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
      card.selected=move === this.selected;card.highlight.visible=card.selected;if(card.selected)card.y-=this.phase==='confirmed'||this.handTurn?.presented?l.confirmedLift:l.selectedLift;
      card.lock(this.phase !== 'selecting');this.world.addChild(card);return card;
    });
  }

  buildHud() { buildSlotHud(this); }

  visitScreen(screen){
    if(this.settling||this.wallet?.pending||this.rewardPresentation.busy)return;
    if(this.disposed || this.entering || this.entryOverlay || this.ending || this.phase==='presenting' || this.changing || !['games','characters'].includes(screen))return;
    if(screen==='characters' && this.screen!=='games')return;
    return this.beginEntry(screen==='characters'?'game':'lobby');
  }
  openSlot(){
    if(this.disposed || this.entering || this.entryOverlay || this.screen!=='games' || this.modal)return;
    // Preserve the activity launch context when opening the slot entry.
    location.assign(slotEntryPath(location));
  }
  selectCharacter(id){
    if(this.disposed || this.entering || this.entryOverlay || this.modal || this.screen!=='characters' || !canEnterCharacter(id))return;
    if(id===this.selectedCharacter)return;
    this.selectedCharacter=id;this.resize();
  }
  enterCharacter(){
    if(this.entering)return this.entryPromise;
    if(this.disposed || this.modal || this.screen!=='characters' || !canEnterCharacter(this.selectedCharacter))return Promise.resolve(false);
    return this.beginEntry('table');
  }
  needsLeaveConfirmation(){return this.screen==='table'&&(this.wallet?this.wallet.active()?.status:this.challenge?.status)==='playing';}
  confirmLeave(){
    if(this.modal!=='leave'||this.disposed||this.entering||this.settling||this.wallet?.pending)return;
    return this.beginEntry('lobby',{leaveConfirmed:true});
  }
  returnToCharacters(){
    if(this.disposed||this.entering||this.entryOverlay||this.settling||this.wallet?.pending||this.changing||this.modal||this.rewardPresentation.busy||this.screen!=='table'||this.phase!=='confirmed'||!['won','lost'].includes(this.challenge?.status))return;
    return this.beginEntry('reselect');
  }
  beginEntry(kind,{leaveConfirmed=false}={}){
    if(this.disposed)return Promise.resolve(false);
    if(this.entering)return this.entryPromise;
    if(this.rewardPresentation.busy)return Promise.resolve(false);
    if(kind==='lobby'&&this.needsLeaveConfirmation()&&!leaveConfirmed){this.openModal('leave');return Promise.resolve(false);}
    this.rewardPresentation.clear();this.audio.background.cancelCues();
    const source=this.screen;this.closeModal();this.app.canvas.dataset.entryKind=kind;
    this.entryOverlay?.destroy();this.entering=true;
    this.world.interactiveChildren=false;this.world.accessibleChildren=false;this.updateControls();
    const branded=kind==='game'||kind==='table';
    if(branded)this.entryGradients ??=createYakyukenEntryGradients();
    const Presentation=branded?YakyukenEntryLoading:YakyukenScreenFade;
    const overlay=this.entryOverlay=new Presentation({app:this.app,logoTexture:this.entryLogoTexture,reduced:this.motion.reduced,gradients:this.entryGradients,covered:kind==='arrival',
      table:kind==='table',
      onChange:state=>{
        if(this.disposed)return;
        Object.assign(this.app.canvas.dataset,{entryStage:state.stage,entryProgress:String(Math.floor(state.target)),entryDisplayed:String(Math.floor(state.displayed))});
        this.app.canvas.setAttribute('aria-busy',String(state.stage!=='complete' && state.stage!=='error'));
      },onRetry:()=>this.beginEntry(kind,{leaveConfirmed}),onBack:()=>this.cancelEntry()});
    const pending=this.performEntry(overlay,kind,source).finally(()=>{if(this.entryPromise===pending)this.entryPromise=null;});
    this.entryPromise=pending;return pending;
  }
  async prepareEntry(overlay){
    let completed=0;
    const portraits=Object.entries(CHARACTER_ART).flatMap(([id,urls])=>urls.map((url,index)=>({id,url,index})));
    const artwork=[...portraits,...Object.entries(CARD_ART).map(([key,url])=>({key,url}))];
    const results=await Promise.allSettled(artwork.map(async art=>{
      if(!(art.key?this.cardTextures[art.key]:this.artTextures[art.id][art.index])){
        const texture=await Assets.load(art.url);this.loaded.add(art.url);
        if(this.disposed){this.loaded.delete(art.url);await Assets.unload(art.url);return;}
        if(art.key){
          const {width,height}=CARD_CANVAS;
          this.cardTextures[art.key]=new Texture({source:texture.source,frame:texture.frame,
            orig:new Rectangle(0,0,width,height),trim:new Rectangle((width-texture.width)/2,(height-texture.height)/2,texture.width,texture.height)});
        }else this.artTextures[art.id][art.index]=texture;
      }
      completed++;overlay.update(15+completed/artwork.length*55,'正在準備角色與典藏牌組…');
    }));
    if(results.some(result=>result.status==='rejected'))throw new Error('Yakyuken entry resources unavailable');
  }
  async performEntry(overlay,kind,source){
    try{
      await overlay.open();if(this.disposed)return false;
      if(kind==='game' && !await waitForEntryTask(this.prepareEntry(overlay),this.abort.signal))return false;
      if(this.wallet&&kind==='table'){
        overlay.update(24,'正在確認入場與戲籌…');
        await this.wallet.begin(this.selectedCharacter);
      }
      if(this.wallet&&kind==='lobby')await this.wallet.leave(this.matchId);
      if(this.disposed)return false;
      overlay.update?.(76,kind==='table'?'正在準備牌桌…':'正在準備選角舞台…');
      this.screen=kind==='table'?'table':kind==='game' || kind==='reselect'?'characters':'games';this.phase='selecting';this.selected=null;this.duel=null;this.dealerStage='idle';this.handTurn=null;
      if(kind==='table'){
        const active=this.wallet?.active();this.selectedCharacter=active?.characterId??this.selectedCharacter;
        const rounds=this.wallet?.nextHand&&this.wallet.nextHand.matchId===active?.id?this.wallet.nextHand.index:active?active.wins+active.losses:0;
        this.challenge=active?{...active,rounds,draws:rounds-active.wins-active.losses,last:null}:createChallenge(this.selectedCharacter);
        this.completedRounds=this.challenge.rounds;this.pose=earnedPose(this.challenge.wins,this.characterTextures.length);this.presentedRound=this.challenge.rounds;this.dialogue='';
      }
      this.resize();
      const portraits=kind==='game'?Object.values(this.artTextures).flat():this.characterTextures;
      if(!await waitForEntryTask(this.app.renderer.prepare.upload([this.backgroundTexture,...portraits,...Object.values(this.cardTextures),this.logoTexture]),this.abort.signal))return false;
      if(this.disposed)return false;
      overlay.update?.(95,'正在佈置舞台…');
      // Compile the current table behind the opaque cover, without retaining
      // Graphics from a world that may be replaced by a viewport resize.
      this.app.render();
      if(!await overlay.finish() || this.disposed)return false;
      if(kind==='table'){this.entries++;this.matchId=this.archive.begin(this.selectedCharacter);}
      if(kind==='lobby'){this.archive.leave(this.matchId);this.matchId=null;}
      if(kind==='reselect'){this.matchId=null;this.challenge=null;this.completedRounds=0;this.presentedRound=0;this.dialogue='';this.pose=0;this.ending=false;}
      this.entering=false;overlay.destroy();this.entryOverlay=null;
      this.world.interactiveChildren=true;this.world.accessibleChildren=true;this.updateControls();return true;
    }catch(error){
      if(this.disposed)return false;
      this.entering=false;
      if(kind==='reselect'){
        this.screen='characters';this.phase='selecting';this.matchId=null;this.challenge=null;this.completedRounds=0;this.presentedRound=0;this.dialogue='';this.pose=0;this.ending=false;this.resize();
      }else if(this.screen!==source){this.screen=source;this.phase='selecting';this.resize();}
      const uncertain=!!this.wallet?.pending;
      overlay.fail(this.wallet&&['table','lobby'].includes(kind)?`${error.message}\n${uncertain?'請重試原操作，以確認戲籌結果。':'請再試一次，或返回上一頁。'}`:undefined,!uncertain);this.updateControls();this.world.interactiveChildren=false;this.world.accessibleChildren=false;return false;
    }
  }
  cancelEntry(){
    if(this.disposed || this.entering)return;
    this.entryOverlay?.destroy();this.entryOverlay=null;this.app.canvas.dataset.entryStage='';this.app.canvas.setAttribute('aria-busy','false');
    this.world.interactiveChildren=true;this.world.accessibleChildren=true;this.updateControls();
  }
  select(move) {
    if(this.settling||this.wallet?.pending||this.rewardPresentation.busy)return;
    if(this.disposed || this.entering || this.entryOverlay || this.ending || this.challenge?.status==='lost' || this.changing || this.modal || this.screen!=='table' || this.phase !== 'selecting' || !TABLE_MOVES.includes(move))return;
    this.selected=move;this.playerCards.forEach(card => card.choose(card.move === move));this.updateControls();
  }
  async confirm() {
    if(this.settling||this.rewardPresentation.busy)return;
    if(this.disposed || this.entering || this.entryOverlay || this.ending || this.changing || this.modal || this.screen!=='table' || this.phase === 'presenting')return;
    if(this.phase==='retrying')return this.retryHandTurn();
    if(['requesting','confirming'].includes(this.phase))return;
    if(this.phase === 'confirmed'){
      const restarting=this.challenge.status!=='playing';
      if(restarting&&this.wallet)return this.beginEntry('table');
      if(restarting){
        this.challenge=createChallenge(this.selectedCharacter);this.completedRounds=0;this.presentedRound=0;
        this.matchId=this.archive.begin(this.selectedCharacter);
      }
      this.phase='selecting';this.selected=null;this.duel=null;this.dealerStage='idle';this.dialogue='';this.handTurn=null;
      this.playerCards.forEach((card,index) => {card.lock(false);card.choose(false);card.rotation=(index-1)*.055;});
      this.dealerCards.forEach(card => {card.choose(false);card.setFaceUp(false);card.visual.scale.x=1;card.rotation=0;});
      this.updateControls();if(restarting && this.pose!==0)await this.changePose(0);return;
    }
    if(!this.selected)return;
    const prepared=this.wallet?.previewHand?.(this.matchId,this.selected);
    const turn=this.handTurn={before:this.challenge,move:this.selected,handIndex:prepared?.handIndex,duel:prepared?.duel,settled:!this.wallet,presented:false,error:null};
    if(this.wallet){
      this.phase='requesting';this.playerCards.forEach(card=>card.lock(true));
      // Dispatch the original request first; the already-authoritative ticket
      // lets both cards move while Firestore confirms this same hand.
      const settlement=this.settleHandTurn(turn);
      if(prepared){this.challenge=applyChallengeDuel(turn.before,prepared.duel);await Promise.all([settlement,this.animateHandTurn(turn)]);}
      else{await settlement;if(turn.settled)await this.animateHandTurn(turn);}
    }else{
      this.challenge=playChallengeRound(this.challenge,this.selected);turn.duel=this.challenge.last;
      this.archive.update(this.matchId,this.challenge);await this.animateHandTurn(turn);
    }
    await this.finishHandTurn(turn);
  }
  async settleHandTurn(turn){
    this.settling=true;turn.error=null;this.updateControls();
    try{
      const data=await this.wallet.hand(this.matchId,turn.move,turn.handIndex);
      if(this.disposed||this.handTurn!==turn)return;
      const record=data.wallet.records.find(r=>r.id===this.matchId);
      if(!record||data.duel?.player!==turn.move||turn.duel&&(data.duel.outcome!==turn.duel.outcome||data.duel.dealer!==turn.duel.dealer))throw new Error('出牌進度不符，請重新同步。');
      turn.duel=data.duel;turn.settled=true;
      if(record.status==='won'&&record.reward>0)this.rewardPresentation.hold({id:this.matchId,after:data.wallet.balance,reward:record.reward});
      this.challenge={...record,rounds:turn.before.rounds+1,draws:(turn.before.draws||0)+Number(data.duel.outcome==='draw'),last:data.duel};
    }catch(error){if(!this.disposed&&this.handTurn===turn)turn.error=error.message;}
    finally{this.settling=false;if(!this.disposed&&this.handTurn===turn)this.updateControls();}
  }
  async animateHandTurn(turn){
    if(this.disposed||this.handTurn!==turn)return;
    this.duel=turn.duel;this.completedRounds=this.challenge.rounds;
    this.phase='presenting';this.dealerStage='playing';this.playerCards.forEach(card=>card.lock(true));
    const card=this.playerCards.find(value=>value.move===turn.move);
    const dealerCard=this.dealerCards[0];
    dealerCard.setMove(this.duel.dealer,TABLE_MOVES.indexOf(this.duel.dealer));
    dealerCard.selected=true;dealerCard.highlight.visible=true;
    this.updateControls();
    await Promise.all([this.motion.to(card,{y:card.baseY-this.layout.confirmedLift,rotation:0},240),this.motion.to(dealerCard,{y:dealerCard.baseY-this.layout.dealerLift,rotation:0},280),dealerCard.reveal(()=>{
      this.updateControls();this.playReveal(turn);
    })]);
    if(this.disposed||this.handTurn!==turn)return;
    turn.presented=true;this.dealerStage='shown';
    this.phase=turn.settled?'confirmed':turn.error?'retrying':'confirming';this.updateControls();
  }
  playReveal(turn){
    if(this.disposed||!turn||this.handTurn!==turn||turn.revealSoundPlayed)return;
    turn.revealSoundPlayed=true;this.audio.flipCard();
  }
  async finishHandTurn(turn){
    if(this.disposed||this.handTurn!==turn)return;
    this.phase=turn.settled&&turn.presented?'confirmed':turn.error?'retrying':'confirming';this.updateControls();
    if(this.phase==='confirmed')await this.presentResult();
  }
  async retryHandTurn(){
    const turn=this.handTurn;if(!turn||this.settling)return;
    if(this.wallet.pending?.action==='hand'){
      this.phase='confirming';await this.settleHandTurn(turn);
      if(turn.settled&&!turn.presented)await this.animateHandTurn(turn);
      return this.finishHandTurn(turn);
    }
    // A definitive conflict (for example another device consuming the ticket)
    // cannot be retried as a fresh hand. Reload current progress without a fee.
    this.settling=true;this.updateControls();
    try{
      await this.wallet.refresh();if(this.disposed)return;
      const active=this.wallet.active(),rounds=this.wallet.nextHand?.index??(active?.wins||0)+(active?.losses||0);
      this.handTurn=null;this.selected=null;this.duel=null;this.dealerStage='idle';this.phase='selecting';this.dialogue='';
      if(active?.status==='playing'){
        this.selectedCharacter=active.characterId;
        this.challenge={...active,rounds,draws:rounds-active.wins-active.losses,last:null};this.matchId=active.id;this.pose=earnedPose(active.wins,this.characterTextures.length);this.completedRounds=rounds;this.presentedRound=rounds;
      }else{this.screen='characters';this.challenge=null;this.matchId=null;}
      this.resize();
    }catch(error){turn.error=error.message;}
    finally{this.settling=false;if(!this.disposed)this.updateControls();}
  }
  async presentResult(){
    if(this.disposed || this.phase!=='confirmed' || !this.challenge || this.presentedRound===this.challenge.rounds)return;
    this.presentedRound=this.challenge.rounds;
    this.dialogue=resultDialogue({outcome:this.duel.outcome,round:this.challenge.rounds,status:this.challenge.status});
    this.updateControls();
    if(this.duel.outcome==='win'){
      await this.changePose(earnedPose(this.challenge.wins,this.characterTextures.length));
      if(!this.disposed&&this.rewardPresentation.stage==='holding'){
        // Start the reading/count timeline only after an actual frame of the
        // final outfit has rendered, including the reduced-motion path.
        this.rewardReveal=()=>{
          this.rewardReveal=null;
          if(!this.disposed&&this.rewardPresentation.reveal())this.updateControls();
        };
        this.app.ticker.addOnce(this.rewardReveal,undefined,UPDATE_PRIORITY.LOW-1);
      }
    }
  }
  updateControls() {
    updateSlotHud(this);
    this.syncWorldInput();
    this.updateLobbyMusic();
    const fronts=this.dealerCards.filter(card=>card.faceUp).length;
    Object.assign(this.app.canvas.dataset,{screen:this.screen,phase:this.entering?'entering':this.screen==='table'?this.phase:this.screen,selected:this.selected || '',pose:String(this.pose),scene:this.screen==='table'?'yakyuken-table':'circus-lobby',dealerStage:this.dealerStage,
      dealerFrontCount:String(fronts),dealerMove:fronts?this.duel?.dealer || '':'',outcome:this.phase==='confirmed'?this.duel?.outcome || '':'',round:String(this.completedRounds),uiStyle:'theatre-cards',character:this.selectedCharacter,entries:String(this.entries),changing:String(!!this.changing),dialogue:this.dialogue,
      wins:String(this.challenge?.wins || 0),losses:String(this.challenge?.losses || 0),draws:String(this.challenge?.draws || 0),challengeStatus:this.challenge?.status || '',reward:String(this.challenge?.reward || 0),rewardStage:this.rewardPresentation.stage});
    const selectedCharacter=characterRule(this.selectedCharacter);
    const opponent=this.selectedCharacter==='dealer'?'荷官':selectedCharacter.name;
    const selectionDescription=`目前選擇${selectedCharacter.name}。${CHARACTER_INTROS[this.selectedCharacter]}`;
    this.app.canvas.setAttribute('aria-label',this.entering?(this.app.canvas.dataset.entryKind==='game'?'野球拳，正在載入遊戲。':'正在切換畫面。'):this.screen==='table'?`野球拳第一人稱牌桌。${this.scoreDescription}。${this.status.text.replaceAll('\n','。')}。${this.statusDetail.text.replaceAll('\n','。')}。${this.dialogue?opponent+'說：'+this.dialogue+'。':''}右側${opponent}牌${fronts?'已翻開':'尚未揭曉'}。`:this.screen==='games'?'Joker’s Circus 遊戲大廳，請選擇老虎機或野球拳。':`野球拳角色選擇，共五個角色位置。目前開放${CHARACTERS.filter(character=>character.enabled).map(character=>character.name).join('、')}。${selectionDescription}${this.wallet?'入場將扣除測試戲籌。':'本機入場暫不扣款。'}`);
  }

  updateLobbyMusic(){
    const button=this.lobbyMusicButton;
    if(!button)return;
    button.hidden=this.screen!=='games'||this.entering||!!this.entryOverlay;
    const enabled=!this.audio.musicMuted,pressed=String(enabled);
    if(button.getAttribute('aria-pressed')===pressed)return;
    button.setAttribute('aria-pressed',pressed);
    button.title=enabled?'關閉背景音樂':'開啟背景音樂';
    button.innerHTML=icon(enabled?'music':'musicMuted');
  }

  openModal(type) {
    if(this.settling||this.rewardPresentation.busy||this.wallet?.pending)return;
    if(!['menu','collection','cg','history','settings','leave'].includes(type))return;
    if(type==='cg' && !this.archive.isUnlocked(this.galleryCharacter,this.cgIndex))return;
    if(this.disposed || this.entering || this.entryOverlay || this.ending || this.phase === 'presenting' || this.changing)return;
    this.closeModal();this.modal=type;this.buildModal(type);this.syncCheckinButton();
  }
  selectGalleryCharacter(character,restoreFocus=false){
    if(this.modal!=='collection'||!canEnterCharacter(character)||character===this.galleryCharacter)return;
    this.galleryCharacter=character;this.galleryAnchor=0;this.openModal('collection');
    if(restoreFocus)this.focusArchiveControl(`gallery-tab:${character}`);
  }
  showGalleryPage(index,focus){
    this.galleryAnchor=index;this.openModal('collection');
    if(focus)this.focusArchiveControl(focus);
  }
  focusArchiveControl(control){
    this.app.render();
    this.modalRoot?.getChildByLabel(control,true)?._accessibleDiv?.focus();
  }
  openCG(index,character=this.galleryCharacter??this.selectedCharacter){
    if(!canEnterCharacter(character)||!Number.isInteger(index)||!this.archive.isUnlocked(character,index)||!this.artTextures?.[character]?.[index])return false;
    this.galleryCharacter=character;this.galleryAnchor=this.cgIndex=index;this.openModal('cg');return this.modal==='cg';
  }
  stepCG(direction,restoreFocus=false){
    const unlocked=CG_ART[this.galleryCharacter].map((_,i)=>i).filter(i=>this.archive.isUnlocked(this.galleryCharacter,i));
    const at=unlocked.indexOf(this.cgIndex)+direction,index=unlocked[at];
    if(index!==undefined&&this.openCG(index)&&restoreFocus){
      const control=unlocked[at+direction]!==undefined?`gallery-step:${direction}`:'gallery-back';
      this.focusArchiveControl(control);
    }
  }
  closeModal() {
    this.scrollHistory=null;
    this.modal=null;if(this.modalRoot){this.modalRoot.destroy({children:true});this.modalRoot=null;}
    this.syncWorldInput();
    this.app.canvas.dataset.modal='';
    this.syncCheckinButton();
  }
  buildModal(type) { buildSlotDialog(this,type); }

  showCheckin(){
    if(this.disposed||this.modal||this.settling||this.rewardPresentation.busy||this.phase==='presenting'||this.entering||this.changing||this.ending)return;
    this.checkinDialog??=createCheckinDialog(this.host,()=>void this.claimDaily());
    if(this.checkinDialog.open)return;
    this.checkinDialog.update(this.wallet,false);
    this.checkinDialog.message('');
    this.checkinDialog.show();
  }

  syncCheckinButton(){
    const state=this.wallet?.wallet?.checkinView;
    this.checkinButton?.update({...state,visible:this.screen!=='games'&&!this.entryOverlay&&!this.entering&&!this.changing&&!this.modal,
      preview:!this.wallet,ready:!this.wallet||!!state&&!this.checkinReconnect,busy:this.settling||this.rewardPresentation.busy||this.phase==='presenting'||this.ending,
      claiming:this.claimingCheckin});
  }

  async claimDaily(){
    const dialog=this.checkinDialog, retry=this.wallet?.pending?.action==='checkin';
    if(!dialog?.open||!this.wallet||this.settling||this.checkinReconnect||(this.wallet.pending&&!retry)||(this.wallet.wallet.checkinView.claimed&&!retry))return;
    this.claimingCheckin=this.settling=true;this.updateControls();
    dialog.message('');dialog.update(this.wallet,true);
    let feedback;
    try{
      const update=await this.wallet.checkin();
      feedback={message:checkinClaimFeedback(update),tone:'success'};
    }catch(error){
      const copy=playerError(error,{context:'checkin'});
      this.checkinReconnect=copy.reconnect;
      feedback={...copy,tone:'info'};
    }
    finally{
      this.claimingCheckin=this.settling=false;
      if(!this.disposed){
        this.updateControls();dialog.update(this.wallet,false);
        dialog.feedback(feedback);
      }
    }
  }

  async changePose(index) {
    if(this.changing || this.disposed || this.entering || this.entryOverlay || this.screen!=='table' || !this.characterTextures[index])return;
    this.closeModal();if(index===this.pose)return;
    this.changing=true;this.world.interactiveChildren=false;this.world.accessibleChildren=false;this.updateControls();
    this.wardrobeGradients ??=createWardrobeGradients();
    this.wardrobeBackdrop ??=createWardrobeBackdrop();
    const transition=this.wardrobe=new WardrobeTransition({app:this.app,background:this.root,
      to:this.characterTextures[index],name:this.characterCG[index].name,backdrop:this.wardrobeBackdrop,
      subject:()=>this.dealer,
      dialogue:this.dialogue || '準備好了？那就再來一拳。',reduced:this.motion.reduced || this.motion.suspended,
      gradients:this.wardrobeGradients,
      onCommit:()=>{if(!this.disposed){this.pose=index;this.dealer.texture=this.characterTextures[index];this.updateControls();}},
      onChange:frame=>{if(!this.disposed){Object.assign(this.app.canvas.dataset,{wardrobeStage:frame.complete?'complete':frame.committed?'revealing':'focusing',wardrobeElapsed:String(Math.round(frame.elapsed))});}},
    });
    await transition.play();
    if(this.disposed || this.wardrobe!==transition)return;
    this.wardrobe=null;this.changing=false;this.updateControls();
  }
  syncWorldInput(){
    if(!this.world)return;
    const enabled=!this.entering&&!this.entryOverlay&&!this.changing&&!this.ending&&!this.modal;
    this.world.interactiveChildren=enabled;this.world.accessibleChildren=enabled;
  }
  tickReward(elapsed){
    if(this.disposed)return;
    const stage=this.rewardPresentation.stage;
    const ms=this.rewardSkipElapsed?0:elapsed;this.rewardSkipElapsed=false;
    const changed=this.rewardPresentation.tick(ms,{reduced:this.motion.reduced});
    if(!changed)return;
    if(stage!==this.rewardPresentation.stage)this.updateControls();else updateBalance(this);
  }
  keydown(event) {
    if(this.checkinDialog?.open)return;
    if(event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || this.disposed || this.entering || this.entryOverlay || this.ending || this.rewardPresentation.busy || document.hidden)return;
    if(event.key==='Escape'){event.preventDefault();if(this.modal==='cg')this.showGalleryPage(this.cgIndex,`gallery-tile:${this.cgIndex}`);else if(this.modal)this.closeModal();else if(!this.changing && this.screen!=='games')this.openModal('menu');return;}
    if(this.modal==='cg' && ['ArrowLeft','ArrowRight'].includes(event.key)){
      event.preventDefault();this.stepCG(event.key==='ArrowLeft'?-1:1,true);return;
    }
    if(this.modal==='history' && ['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key)){
      event.preventDefault();this.scrollHistory?.(({ArrowDown:60,ArrowUp:-60,PageDown:300,PageUp:-300}[event.key] || 0),event.key==='Home'?'start':event.key==='End'?'end':undefined);return;
    }
    if(this.modal || this.changing || this.screen!=='table')return;
    const move=TABLE_MOVES[Number(event.key)-1];
    if(move){event.preventDefault();this.select(move);}
    else if(event.key==='Enter' && (event.target===document.body || event.target===this.app.canvas || this.selected && event.target?.getAttribute('aria-label')?.startsWith('選擇'))){event.preventDefault();void this.confirm();}
  }
  pause() {if(this.disposed || !this.initialized)return;this.motion.suspended=true;this.motion.finish();this.wardrobe?.finish();if(this.entryOverlay){this.entryOverlay.motion.suspended=true;this.entryOverlay.motion.finish();}this.audio.pauseMusic();this.app.stop();}
  resume() {if(!this.disposed && this.artTextures && !document.hidden){this.rewardSkipElapsed=true;this.motion.suspended=false;if(this.entryOverlay)this.entryOverlay.motion.suspended=false;this.audio.resumeMusic();this.app.start();}}
  async unload() {const urls=[...this.loaded];this.loaded.clear();await Promise.allSettled(urls.map(url => Assets.unload(url)));}
  async destroy() {
    this.rewardPresentation.clear();
    if(this.rewardReveal){this.app.ticker.remove(this.rewardReveal);this.rewardReveal=null;}
    if(this.disposed)return;this.disposed=true;this.archive.leave(this.matchId);this.matchId=null;this.abort.abort();this.observer?.disconnect();if(this.resizeFrame)cancelAnimationFrame(this.resizeFrame);this.motion.destroy();this.wardrobe?.destroy();this.wardrobe=null;this.entryOverlay?.destroy();this.entryOverlay=null;this.audio.destroy();
    this.checkinDialog?.destroy();
    this.lobbyMusicButton?.remove();
    if(this.initialized){this.app.stop();this.app.destroy({removeView:true,releaseGlobalResources:true},{children:true});}
    destroyWardrobeBackdrop(this.wardrobeBackdrop);this.wardrobeBackdrop=null;
    this.entryGradients?.forEach(gradient=>gradient.destroy());this.entryGradients=null;
    this.wardrobeGradients?.forEach(gradient=>gradient.destroy());this.wardrobeGradients=null;
    this.portraitGradient?.destroy();this.portraitGradient=null;
    this.logoTexture?.destroy();this.entryLogoTexture?.destroy();
    this.avatarTexture?.destroy(true);this.avatarTexture=null;this.renderAvatar=null;
    Object.values(this.cardTextures).forEach(texture=>texture.destroy());this.cardTextures={};await this.unload();
  }
}
