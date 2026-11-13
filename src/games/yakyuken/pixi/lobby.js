import {Container,FillGradient,Graphics,Sprite} from 'pixi.js';
import {CHARACTERS,ENTRY_FEE,characterRule} from '../characters.js';
import {label,PALETTE,PixiButton} from './ui.js';
import {lobbyLayout} from './lobby-layout.js';
import {buildGameLobby} from '../../../ui/lobby/game-lobby.js';
import {LOBBY_COVERS} from '../lobby-art.js';
import {CHARACTER_INTROS} from '../assets.js';

const at=(node,x,y,parent)=>{node.position.set(x,y);parent.addChild(node);return node;};
function portrait(texture,parent,area,fullHeight){
  const art=new Sprite(texture);art.anchor.set(.5,0);art.height=fullHeight;art.scale.x=art.scale.y;
  art.position.set(area.x+area.width/2,area.y);art.eventMode='none';
  const mask=new Graphics().rect(area.x,area.y,area.width,area.height).fill(0xffffff);mask.eventMode='none';
  parent.addChild(art,mask);art.mask=mask;return art;
}
function title(text,x,y,parent,size=19,color=PALETTE.gold,options={}){return at(label(text,size,color,options),x,y,parent);}

export function buildLobby(scene){
  const {ui,scale}=scene.layout,{width,height,headerHeight}=ui;
  const root=new Container({label:`lobby:${scene.screen}`});root.scale.set(1/scale);scene.world.addChild(root);
  const l=lobbyLayout(width,height,scene.layout.contentTop??headerHeight);scene.lobbyLayout=l;
  if(scene.screen==='games'){
    buildGameLobby(root,{width,height,layout:l,logoTexture:scene.logoTexture,
      games:LOBBY_COVERS.map((cover,index)=>({name:cover.name,texture:scene.lobbyTextures[index],
        onPress:()=>index?scene.visitScreen('characters'):scene.openSlot()}))});
  }else{
    const c=l.character,s=c.contentScale,rule=characterRule(scene.selectedCharacter);
    const mobileIntro=c.vertical&&rule.id==='guest-4';
    portrait(scene.characterTextures[0],root,c.art,c.art.height/.58);
    if(!c.vertical){
      const p=c.panel,frame=new Graphics({label:'character-selection-frame',eventMode:'none'});
      frame.roundRect(p.x-p.width/2,p.y-p.height/2,p.width,p.height,18*s).fill({color:0x171525,alpha:.55}).stroke({color:PALETTE.gold,alpha:.35,width:s});
      for(const sign of [-1,1])frame.moveTo(p.x+sign*p.width*.32,p.y-p.height/2).lineTo(p.x+sign*p.width*.42,p.y-p.height/2).stroke({color:PALETTE.gold,alpha:.85,width:2*s});
      root.addChild(frame);
    }
    title('野球拳・選擇對手',c.infoX,c.headingY,root,c.vertical?17:20*s);
    title(rule.name,c.infoX,c.nameY-(mobileIntro?20:0),root,c.vertical?19:30*s,PALETTE.cream,{fontWeight:'500'});
    if(!c.vertical||mobileIntro)title(CHARACTER_INTROS[rule.id],c.infoX,mobileIntro?c.nameY:c.descriptionY,root,c.vertical?12:14*s,PALETTE.muted);
    title(`${rule.winsRequired} 勝通關 · ${rule.lossLimit} 敗結束 · 獎金 ${rule.reward.toLocaleString('en-US')}`,c.infoX,c.rulesY,root,c.vertical?Math.min(13,(width-24)/25):15*s,PALETTE.gold);
    scene.portraitGradient ??=new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0x493037},{offset:.5,color:0x111729},{offset:1,color:0x251725}]});
    CHARACTERS.forEach((character,index)=>{
      const r=c.slots[index],button=new PixiButton({name:`選擇${character.name}`,width:r.width,height:r.height,onPress:()=>scene.selectCharacter(character.id)});
      const selected=character.id===rule.id;
      button.position.set(r.x,r.y);root.addChild(button);
      button.background.context.batchMode='batch';
      button.background.clear().roundRect(-r.width/2,-r.height/2,r.width,r.height,9*s)
        .fill(scene.portraitGradient)
        .stroke({color:selected?PALETTE.gold:0x6a5259,width:(selected?2:1)*s});
      const stage=new Graphics({label:'portrait-stage',eventMode:'none'});
      stage.poly([-r.width*.34,-r.height*.46,0,r.height*.34,r.width*.34,-r.height*.46]).fill({color:0xe6c488,alpha:selected?.10:.025});
      stage.moveTo(-r.width*.43,r.height*.32).lineTo(r.width*.43,r.height*.32).stroke({color:PALETTE.gold,width:s,alpha:.18});
      button.addChild(stage);
      if(character.enabled){portrait(scene.artTextures[character.id][0],button,{x:-r.width/2+3,y:-r.height/2+3,width:r.width-6,height:r.height-6},r.height*2.4);}
      else title(['','II','III','IV','V'][index],0,-8*s,button,22*s,0x887783,{fontFamily:['Georgia','serif']});
      button.addChild(new Graphics().rect(-r.width/2+3,r.height/2-24*s,r.width-6,21*s).fill({color:0x201522,alpha:.92}));
      title(character.enabled?(index?character.name:'荷官'):'準備中',0,r.height/2-13*s,button,Math.max(11,11*s),selected?PALETTE.gold:0xa493a0);
      if(!character.enabled)button.setEnabled(false);
    });
    title(scene.wallet?'入場費不予退還':'本機試玩暫不扣款',c.infoX,c.feeY,root,Math.max(12,12*s),PALETTE.muted);
    const paused=scene.wallet?.admissionOpen===false;
    const enter=at(new PixiButton({text:paused?'暫停新場次':`入場 ${ENTRY_FEE.toLocaleString('en-US')} 戲籌`,
      name:paused?'暫停新場次':scene.onLobby?'進入野球拳':'進入野球拳試玩',variant:'gold',width:c.buttonWidth,height:c.buttonHeight,fontSize:16*s,onPress:()=>scene.enterCharacter()}),c.infoX,c.enterY,root);
    enter.setEnabled(!paused);
  }
}
