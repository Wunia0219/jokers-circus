import {Application,Assets,Container,Rectangle,Texture} from 'pixi.js';
import 'pixi.js/unsafe-eval';
import background from '../../images/jokers-circus/circus-background.webp';
import atlasImage from '../../images/main.webp';
import atlas from '../../images/main.json';
import slotCover from '../../images/lobby/slot-cover-v2.webp';
import teaserCover from '../../images/lobby/teaser.webp?no-inline';
import {gameLobbyLayout} from '../ui/lobby/lobby-layout.js';
import {addLobbyBackdrop,buildGameLobby} from '../ui/lobby/game-lobby.js';
import {installPointerFeedback} from '../ui/pixi/pointer-feedback.js';

export async function createArcadeLobbyView(host,signal){
  const [backgroundTexture,atlasTexture,slotTexture,teaserTexture]=await Promise.all(
    [background,atlasImage,slotCover,teaserCover].map(url=>Assets.load(url)));
  const {x,y,w,h}=atlas.frames['logo-long.png'].frame;
  const logoTexture=new Texture({source:atlasTexture.source,frame:new Rectangle(x,y,w,h)});
  const app=new Application();
  await app.init({
    width:Math.max(1,host.clientWidth),height:Math.max(1,host.clientHeight),
    background:0x0b1020,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio||1,2),
    preference:'webgl',autoStart:false,sharedTicker:false,
    accessibilityOptions:{enabledByDefault:true,deactivateOnMouseMove:false},
    eventFeatures:{move:true,click:true,globalMove:false,wheel:true},
  });
  host.append(app.canvas);
  app.canvas.setAttribute('aria-label','Joker’s Circus 遊戲大廳');
  app.renderer.accessibility.div.classList.add('lobby-accessibility');
  const root=new Container();
  app.stage.addChild(root);
  installPointerFeedback(document,signal);

  let state,cards=[],size;
  function draw(){
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height||!state)return;
    size={width,height};
    const focused=cards.findIndex(card=>card._accessibleDiv===document.activeElement);
    app.renderer.resize(width,height);
    root.removeChildren().forEach(node=>node.destroy({children:true}));
    addLobbyBackdrop(root,backgroundTexture,width,height);
    const {slot,feature}=state;
    cards=buildGameLobby(root,{width,height,layout:gameLobbyLayout(width,height),logoTexture,games:[
      {texture:slotTexture,name:'老虎機',...slot},
      feature??{texture:teaserTexture,frameTexture:slotTexture,name:'即將揭曉',status:'即將揭曉'},
    ]});
    app.render();
    if(focused>=0)cards[focused]._accessibleDiv?.focus({preventScroll:true});
  }
  const observer=new ResizeObserver(()=>{
    if(host.clientWidth!==size?.width||host.clientHeight!==size?.height)draw();
  });
  observer.observe(host);
  signal.addEventListener('abort',()=>{
    observer.disconnect();
    app.destroy({removeView:true},{children:true});
    logoTexture.destroy();
  },{once:true});
  return {
    show(next){state=next;draw();},
    loadCover:url=>Assets.load(url),
    setVisible(visible){if(visible)app.start();else app.stop();},
    focus(index){
      draw();
      cards[index]?._accessibleDiv?.focus({preventScroll:true});
    },
  };
}
