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
  const loaded=new Set();
  let app,logoTexture,observer,disposed=false;
  const unload=urls=>Promise.allSettled(urls.map(url=>Assets.unload(url)));
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    observer?.disconnect();
    if(app?.renderer)app.destroy({removeView:true,releaseGlobalResources:true},{children:true});
    logoTexture?.destroy();
    const urls=[...loaded];loaded.clear();
    return unload(urls);
  };
  const load=async url=>{
    signal.throwIfAborted();
    const texture=await Assets.load(url);
    // A page can close while an image is decoding. Release late arrivals too.
    if(disposed||signal.aborted){await unload([url]);throw new DOMException('Lobby closed','AbortError');}
    loaded.add(url);return texture;
  };
  try{
    signal.throwIfAborted();
    const resources=await Promise.allSettled([background,atlasImage,slotCover,teaserCover].map(load));
    const failure=resources.find(result=>result.status==='rejected');
    if(failure)throw failure.reason;
    signal.throwIfAborted();
    const [backgroundTexture,atlasTexture,slotTexture,teaserTexture]=resources.map(result=>result.value);
    const {x,y,w,h}=atlas.frames['logo-long.png'].frame;
    logoTexture=new Texture({source:atlasTexture.source,frame:new Rectangle(x,y,w,h)});
    app=new Application();
    await app.init({
      width:Math.max(1,host.clientWidth),height:Math.max(1,host.clientHeight),
      background:0x0b1020,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio||1,2),
      preference:'webgl',autoStart:false,sharedTicker:false,
      accessibilityOptions:{enabledByDefault:true,deactivateOnMouseMove:false},
      eventFeatures:{move:true,click:true,globalMove:false,wheel:true},
    });
    signal.throwIfAborted();
    host.append(app.canvas);
    app.canvas.setAttribute('aria-label','Joker’s Circus 遊戲大廳');
    app.renderer.accessibility.div.classList.add('lobby-accessibility');
    const root=new Container();
    app.stage.addChild(root);
    installPointerFeedback(document,signal);

    let state,cards=[],size;
    function draw(){
      if(disposed)return;
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
    observer=new ResizeObserver(()=>{
      if(host.clientWidth!==size?.width||host.clientHeight!==size?.height)draw();
    });
    observer.observe(host);
    signal.addEventListener('abort',dispose,{once:true});
    return {
      show(next){state=next;draw();},
      loadCover:load,
      setVisible(visible){if(!disposed){if(visible)app.start();else app.stop();}},
      focus(index){
        draw();
        cards[index]?._accessibleDiv?.focus({preventScroll:true});
      },
    };
  }catch(error){await dispose();throw error;}
}
