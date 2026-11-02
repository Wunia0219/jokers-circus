import {Application,Assets,Container,FillGradient,Graphics,Rectangle,Sprite} from 'pixi.js';
import 'pixi.js/unsafe-eval';
import backgroundUrl from '../../../images/jokers-circus/circus-background.webp';
import {DEALER_ART} from './assets.js';
import {PreviewAudio} from './audio.js';
import {HandCard} from './pixi/card.js';
import {tableLayout,TABLE_MOVES,TABLE_MOVE_NAMES} from './pixi/layout.js';
import {Motion} from './pixi/motion.js';
import {demoDuel} from './pixi/demo-duel.js';
import {createTable} from './pixi/table.js';
import {diamond,label,panel,PALETTE,PixiButton} from './pixi/ui.js';

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
  dealerStage = 'idle';
  pose = 0;
  modal = null;
  epoch = 0;
  disposed = false;

  async init(host) {
    this.host = host;
    await this.app.init({
      width:Math.max(host.clientWidth,1),height:Math.max(host.clientHeight,1),
      background:0x0b1122,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio || 1,2),
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
    const loading = label('正在點亮命運牌桌…',23,PALETTE.gold);
    loading.position.set(this.app.screen.width/2,this.app.screen.height/2);this.app.stage.addChild(loading);this.app.render();
    const resources = await Promise.allSettled([backgroundUrl,...DEALER_ART.map(art => art.url)].map(async url => {
      const texture = await Assets.load(url);this.loaded.add(url);return texture;
    }));
    if(this.disposed){await this.unload();return;}
    loading.destroy();
    if(resources.some(value => value.status === 'rejected')) {
      await this.unload();
      const message = label('舞台素材載入失敗\n請重新載入試玩',24,PALETTE.gold,{lineHeight:40});
      message.position.set(this.app.screen.width/2,this.app.screen.height/2-40);
      const retry = new PixiButton({text:'重新載入',width:200,onPress:() => location.reload(),primary:true});
      retry.position.set(this.app.screen.width/2,this.app.screen.height/2+65);
      this.app.stage.addChild(message,retry);this.app.canvas.dataset.phase = 'error';this.app.render();return;
    }
    this.backgroundTexture = resources[0].value;
    this.dealerTextures = resources.slice(1).map(value => value.value);
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
    this.app.renderer.resize(width,height);this.layout = tableLayout(width,height);
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
    this.dealer = new Sprite(this.dealerTextures[this.pose]);this.dealer.anchor.set(.5,0);
    this.dealer.height=l.dealer.height;this.dealer.scale.x=this.dealer.scale.y;
    this.dealer.position.set(l.dealer.x,l.dealer.y);this.dealer.eventMode='none';
    this.world.addChild(this.dealer,createTable(l));
    const name = label('命運荷官',l.portrait?28:25,PALETTE.bright,{letterSpacing:4});name.position.set(l.portrait?w*.17:w*.23,h*.275);
    const tag = label('THE DEALER',13,PALETTE.gold,{letterSpacing:3});tag.position.set(name.x,name.y+32);this.world.addChild(name,tag);
    if(!l.portrait){
      const quote = label('「選一張，\n讓我看看你的運氣。」',24,0xe7cba2,{lineHeight:42,letterSpacing:2});
      quote.position.set(w*.78,h*.28);quote.alpha=.9;this.world.addChild(quote,diamond(w*.78,h*.28-65,5));
    }
    const dealerLabel=label('荷 官 手牌',l.portrait?22:18,PALETTE.gold,{letterSpacing:3});
    dealerLabel.position.set(w/2,l.dealerCards.y-94*l.dealerCards.scale-33);this.world.addChild(dealerLabel);
  }

  buildCards() {
    const l=this.layout;
    this.dealerCards=TABLE_MOVES.map((move,index) => {
      const card = new HandCard({move,index,owner:'dealer',motion:this.motion});
      card.place(l.dealerCards.x+(index-1)*l.dealerCards.gap,l.dealerCards.y,l.dealerCards.scale,(index-1)*.035);
      const shown=this.dealerStage==='shown' || this.dealerStage==='playing';
      card.selected=shown && this.duel?.dealer===move;card.highlight.visible=card.selected;
      if(card.selected){card.y-=20;card.rotation=0;}
      card.alpha=shown && !card.selected ? .45 : .94;
      this.world.addChild(card);return card;
    });
    this.playerCards=TABLE_MOVES.map((move,index) => {
      const card = new HandCard({move,index,owner:'player',motion:this.motion,onChoose:value => this.select(value)});
      card.place(l.playerCards.x+(index-1)*l.playerCards.gap,l.playerCards.y,l.playerCards.scale,(index-1)*.055);
      card.selected=move === this.selected;card.highlight.visible=card.selected;if(card.selected)card.y-=this.phase==='confirmed'?32:24;
      card.lock(this.phase !== 'selecting');this.world.addChild(card);return card;
    });
  }

  buildHud() {
    const l=this.layout,{w,h,portrait}=l,height=Math.max(portrait?116:80,56/l.scale);
    const gradient=new FillGradient({start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0x0c1020},{offset:1,color:0x1d1427}]});
    const hud=new Graphics().rect(0,0,w,height).fill(gradient).stroke({color:0x987441,width:1});
    hud.rect(0,h-(portrait?210:118),w,portrait?210:118).fill({color:0x0d1221,alpha:.91});
    hud.moveTo(0,h-(portrait?210:118)).lineTo(w,h-(portrait?210:118)).stroke({color:PALETTE.gold,width:1,alpha:.5});this.world.addChild(hud);
    const brand=label('JOKER’S CIRCUS',portrait?22:24,PALETTE.bright,{letterSpacing:3});brand.position.set(portrait?w/2:250,portrait?36:31);
    const title=label('野 球 拳',portrait?32:29,PALETTE.cream,{letterSpacing:4});title.position.set(w/2,portrait?78:40);this.world.addChild(brand,title);
    if(!portrait){const sub=label('命 運 馬 戲 團',12,PALETTE.gold,{letterSpacing:4});sub.position.set(250,58);this.world.addChild(sub);}
    const size=Math.max(portrait?88:54,44/l.scale);
    const menu=new PixiButton({text:'≡',name:'開啟選單',width:size,height:size,fontSize:portrait?45:33,onPress:() => this.openModal('menu')});menu.position.set(portrait?65:52,height/2);this.world.addChild(menu);
    const info=new PixiButton({text:'?',name:'遊戲說明',width:size,height:size,fontSize:portrait?36:26,onPress:() => this.openModal('help')});info.position.set(w-(portrait?65:52),height/2);this.world.addChild(info);
    const settings=new PixiButton({text:'設定',name:'開啟設定',width:Math.max(portrait?104:94,44/l.scale),height:size,fontSize:portrait?27:19,onPress:() => this.openModal('settings')});settings.position.set(w-(portrait?178:145),height/2);this.world.addChild(settings);
    this.status=label('',portrait?28:23,PALETTE.cream,{letterSpacing:2});this.status.position.set(w/2,l.statusY);
    this.statusDetail=label('',portrait?20:16,PALETTE.muted,{letterSpacing:1});this.statusDetail.position.set(w/2,l.statusY+35);this.statusDetail.visible=portrait;this.world.addChild(this.status,this.statusDetail);
    const confirmHeight=Math.max(portrait?86:62,44/l.scale);
    this.selectionLabel=label('',portrait?25:20,PALETTE.gold,{letterSpacing:2});this.selectionLabel.position.set(portrait?w/2:w*.25,portrait?l.actionY-Math.max(63,confirmHeight/2+28):l.actionY);this.world.addChild(this.selectionLabel);
    this.confirmButton=new PixiButton({text:'確認出牌',name:'確認出牌',width:portrait?350:280,height:confirmHeight,fontSize:portrait?30:25,primary:true,onPress:() => this.confirm()});
    this.confirmButton.position.set(w/2,l.actionY);this.world.addChild(this.confirmButton);
    if(!portrait){const character=new PixiButton({text:'荷官與造型',name:'荷官與造型',width:220,height:Math.max(58,44/l.scale),fontSize:20,onPress:() => this.openModal('wardrobe')});character.position.set(w*.80,l.actionY);this.world.addChild(character);}
    const foot=label('互動展示 · 固定出牌順序 · 不扣戲籌',portrait?17:12,PALETTE.muted,{letterSpacing:2});foot.position.set(w/2,h-28);this.world.addChild(foot);
  }

  select(move) {
    if(this.disposed || this.modal || this.phase !== 'selecting' || !TABLE_MOVES.includes(move))return;
    this.selected=move;this.playerCards.forEach(card => card.choose(card.move === move));this.audio.cue('draw');this.updateControls();
  }
  async confirm() {
    if(this.disposed || this.modal || this.phase === 'presenting')return;
    if(this.phase === 'confirmed'){
      this.phase='selecting';this.selected=null;this.duel=null;this.dealerStage='idle';
      this.playerCards.forEach((card,index) => {card.lock(false);card.choose(false);card.rotation=(index-1)*.055;});
      this.dealerCards.forEach((card,index) => {card.choose(false);card.alpha=.94;card.rotation=(index-1)*.035;});
      this.updateControls();return;
    }
    if(!this.selected)return;
    this.duel=demoDuel(this.completedRounds,this.selected);this.completedRounds++;
    this.phase='presenting';this.dealerStage='thinking';this.playerCards.forEach(card => card.lock(true));this.updateControls();
    const epoch=this.epoch,card=this.playerCards.find(value => value.move === this.selected);
    await this.motion.to(card,{y:card.baseY-32,rotation:0},240);
    if(this.disposed || epoch !== this.epoch)return;
    await this.motion.to({time:0},{time:1},260);
    if(this.disposed || epoch !== this.epoch)return;
    this.dealerStage='playing';
    const dealerCard=this.dealerCards.find(value => value.move===this.duel.dealer);
    this.dealerCards.forEach(value => {value.selected=value===dealerCard;value.highlight.visible=value.selected;value.alpha=value.selected ? .94 : .45;});
    this.updateControls();
    await this.motion.to(dealerCard,{y:dealerCard.baseY-20,rotation:0},280);
    if(this.disposed || epoch !== this.epoch)return;
    this.phase='confirmed';this.dealerStage='shown';this.audio.cue(this.duel.outcome);this.updateControls();
  }
  updateControls() {
    if(!this.confirmButton)return;
    this.confirmButton.setText(this.phase === 'confirmed'?'下一局':this.phase === 'presenting'?'荷官出牌中…':'確認出牌');
    const name=this.phase === 'confirmed'?'下一局':'確認出牌';this.confirmButton.accessibleTitle=name;this.confirmButton.accessibleHint=name;
    this.confirmButton.setEnabled(this.phase === 'confirmed' || this.phase === 'selecting' && !!this.selected);
    const result=this.duel?{win:'你贏了',loss:'荷官獲勝',draw:'平手'}[this.duel.outcome]:'';
    this.selectionLabel.text=this.phase==='confirmed'?`${result} · 你出${TABLE_MOVE_NAMES[this.selected]}／荷官出${TABLE_MOVE_NAMES[this.duel.dealer]}`:this.phase==='presenting'?`你出${TABLE_MOVE_NAMES[this.selected]} · 荷官正在出牌`:this.selected?`你的選擇 · ${TABLE_MOVE_NAMES[this.selected]}`:'你的手牌 · 請選擇';
    this.selectionLabel.style.fill=this.phase==='confirmed' && this.duel.outcome==='loss'?0xe6a8aa:PALETTE.gold;
    this.status.text=this.phase==='confirmed'?this.selectionLabel.text:this.phase==='presenting'?'荷官正在出牌':this.selected?'準備好了，就出這一張。':'選一張牌，與荷官過招。';
    this.statusDetail.text='拳頭 · 剪刀 · 布';
    this.status.visible=!this.selected;this.statusDetail.visible=this.layout.portrait && this.layout.h>=1250 && !this.selected;
    Object.assign(this.app.canvas.dataset,{phase:this.phase,selected:this.selected || '',pose:String(this.pose),scene:'yakyuken-table',dealerStage:this.dealerStage,
      dealerMove:this.dealerStage==='playing' || this.dealerStage==='shown'?this.duel?.dealer || '':'',outcome:this.phase==='confirmed'?this.duel?.outcome || '':'',round:String(this.completedRounds)});
    this.app.canvas.setAttribute('aria-label',`野球拳第一人稱牌桌。${this.status.text}。雙方各三張手牌。`);
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
  buildModal(type) {
    const l=this.layout,{w,h,portrait}=l;
    this.world.interactiveChildren=false;this.world.accessibleChildren=false;
    this.modalRoot=new Container({label:`modal:${type}`});this.root.addChild(this.modalRoot);
    const shade=new Graphics().rect(0,0,w,h).fill({color:0x050710,alpha:.84});shade.eventMode='static';shade.hitArea=new Rectangle(0,0,w,h);shade.on('pointertap',() => this.closeModal());this.modalRoot.addChild(shade);
    const mw=portrait?680:900,mh=type==='wardrobe'?(portrait?1000:600):type==='help'?(portrait?860:620):(portrait?760:580);
    const body=new Container({label:'modal-panel'});body.position.set(w/2,h/2);body.scale.set(Math.min(1,(h-36)/mh));body.eventMode='static';body.hitArea=new Rectangle(-mw/2,-mh/2,mw,mh);body.on('pointertap',event => event.stopPropagation());this.modalRoot.addChild(body);body.addChild(panel(mw,mh));
    const title=label({menu:'命運牌桌',help:'遊戲說明',settings:'遊戲設定',wardrobe:'荷官與造型'}[type],portrait?38:32,PALETTE.gold,{letterSpacing:4});title.y=-mh/2+58;body.addChild(title);
    const modalTouchSize=Math.max(portrait?88:54,44/(l.scale*body.scale.x));
    const close=new PixiButton({text:'×',name:'關閉視窗',width:modalTouchSize,height:modalTouchSize,fontSize:portrait?40:31,onPress:() => this.closeModal()});close.position.set(mw/2-(portrait?65:46),-mh/2+(portrait?62:45));body.addChild(close);
    const addButton=(text,y,action,name=text,width=portrait?480:420) => {
      const button=new PixiButton({text,name,width,height:Math.max(portrait?88:60,modalTouchSize),fontSize:portrait?29:22,onPress:action});button.y=y;body.addChild(button);return button;
    };
    if(type==='menu'){
      addButton('返回牌桌',portrait?-145:-150,() => this.closeModal());
      addButton('荷官與造型',portrait?-15:-48,() => this.openModal('wardrobe'));
      addButton('遊戲說明',portrait?115:54,() => this.openModal('help'));
      addButton('遊戲設定',portrait?245:156,() => this.openModal('settings'));
    } else if(type==='help'){
      const text=label('你坐在牌桌這端，命運荷官在對面。\n\n雙方各有拳頭、剪刀、布三張手牌。\n點選你面前的牌，再按「確認出牌」。\n\n可用鍵盤 1、2、3 選牌，Enter 確認。\nEsc 關閉視窗或返回選單。',portrait?27:23,PALETTE.cream,{lineHeight:portrait?48:40});text.y=portrait?-40:-15;body.addChild(text);
      const note=label('展示模式：荷官依固定順序出牌，僅演示勝負，不扣戲籌。',portrait?23:19,PALETTE.muted,{wordWrap:true,wordWrapWidth:mw-100,lineHeight:34});note.y=mh/2-125;body.addChild(note);
      addButton('回到牌桌',mh/2-(portrait?73:58),() => this.closeModal());
    } else if(type==='settings'){
      const audioButton=addButton(this.audio.muted?'音效：關閉':'音效：開啟',portrait?-155:-105,async () => {
        try {await this.audio.toggle();if(!this.disposed && !audioButton.destroyed && this.modal==='settings')audioButton.setText(this.audio.muted?'音效：關閉':'音效：開啟');}
        catch {if(!this.disposed && !audioButton.destroyed)audioButton.setText('此裝置無法啟用音效');}
      },'切換音效');
      const motionButton=addButton(this.motion.reduced?'動態效果：減少':'動態效果：標準',portrait?-25:-10,() => {
        this.reducePreference=!this.motion.reduced;this.motion.reduced=!!this.reducePreference || this.media.matches;if(this.motion.reduced)this.motion.finish();this.openModal('settings');
      },'切換動態效果');
      if(this.media.matches){motionButton.setText('動態效果：跟隨系統減少');motionButton.setEnabled(false);}
      const fullscreenButton=addButton(document.fullscreenElement?'離開全螢幕':'全螢幕',portrait?105:85,async () => {
        try {if(document.fullscreenElement)await document.exitFullscreen();else await this.host.requestFullscreen();}
        catch {if(!fullscreenButton.destroyed)fullscreenButton.setText('此視窗不支援全螢幕');return;}
        if(!this.disposed && this.modal==='settings')this.openModal('settings');
      },'切換全螢幕');
    } else if(type==='wardrobe'){
      const hint=label('命運荷官 · 造型圖鑑',portrait?26:20,PALETTE.muted);hint.y=-mh/2+120;body.addChild(hint);
      const gap=portrait?202:245,artHeight=portrait?430:270;
      DEALER_ART.forEach((art,index) => {
        const image=new Sprite(this.dealerTextures[index]);image.anchor.set(.5,0);image.height=artHeight;image.scale.x=image.scale.y;image.position.set((index-1)*gap,-mh/2+(portrait?182:155));body.addChild(image);
        const button=new PixiButton({text:art.name,name:`預覽${art.name}造型`,width:portrait?182:210,height:Math.max(portrait?88:58,modalTouchSize),fontSize:portrait?24:20,primary:index===this.pose,onPress:() => this.changePose(index)});button.position.set((index-1)*gap,portrait?218:mh/2-110);body.addChild(button);
      });
      const future=label('其餘四位角色 · 敬請期待',portrait?23:18,PALETTE.muted,{letterSpacing:2});future.y=mh/2-(portrait?60:45);body.addChild(future);
    }
    this.app.canvas.dataset.modal=type;
  }

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
  pause() {if(this.disposed || !this.initialized)return;this.motion.suspended=true;this.motion.finish();this.app.stop();}
  resume() {if(!this.disposed && this.dealerTextures && !document.hidden){this.motion.suspended=false;this.app.start();}}
  async unload() {const urls=[...this.loaded];this.loaded.clear();await Promise.allSettled(urls.map(url => Assets.unload(url)));}
  async destroy() {
    if(this.disposed)return;this.disposed=true;this.abort.abort();this.observer?.disconnect();this.motion.destroy();this.audio.destroy();
    if(this.initialized){this.app.stop();this.app.destroy({removeView:true,releaseGlobalResources:true},{children:true});}
    await this.unload();
  }
}
