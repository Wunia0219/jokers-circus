import {Container,FillGradient,Graphics,Sprite} from 'pixi.js';
import {CHARACTERS,ENTRY_FEE,characterRule} from '../characters.js';
import {label,PALETTE,PixiButton} from './ui.js';
import {lobbyLayout} from './lobby-layout.js';
import {createGameCover} from './game-cover.js';
import {LOBBY_COVERS} from '../lobby-art.js';

const at=(node,x,y,parent)=>{node.position.set(x,y);parent.addChild(node);return node;};
function portrait(texture,parent,area,fullHeight){
  const art=new Sprite(texture);art.anchor.set(.5,0);art.height=fullHeight;art.scale.x=art.scale.y;
  art.position.set(area.x+area.width/2,area.y);art.eventMode='none';
  const mask=new Graphics().rect(area.x,area.y,area.width,area.height).fill(0xffffff);mask.eventMode='none';
  parent.addChild(art,mask);art.mask=mask;return art;
}
function logo(scene,parent,x,y,width){const sprite=new Sprite(scene.logoTexture);sprite.anchor.set(.5,0);sprite.width=width;sprite.scale.y=sprite.scale.x;return at(sprite,x,y,parent);}
function title(text,x,y,parent,size=19,color=PALETTE.gold,options={}){return at(label(text,size,color,options),x,y,parent);}

export function buildLobby(scene){
  const {ui,scale}=scene.layout,{width,height,headerHeight}=ui;
  const root=new Container({label:`lobby:${scene.screen}`});root.scale.set(1/scale);scene.world.addChild(root);
  const l=lobbyLayout(width,height,scene.layout.contentTop??headerHeight);scene.lobbyLayout=l;
  if(scene.screen==='games'){
    logo(scene,root,width/2,l.logoY,l.logoWidth);
    title('選擇你的舞台',width/2,l.headingY,root,l.headingSize,PALETTE.cream,{fontWeight:'500'});
    title('經典轉輪，或一場與荷官的對決。',width/2,l.subtitleY,root,height<500?12:13,PALETTE.muted);
    title('聚光燈已亮起，好戲等你入場。',width/2,l.footerY,root,12,PALETTE.muted);
    for(const [index,cover] of LOBBY_COVERS.entries()){
      root.addChild(createGameCover({texture:scene.lobbyTextures[index],name:cover.name,area:l.games[index],
        onPress:()=>index?scene.visitScreen('characters'):scene.openSlot()}));
    }

  }else{
    const c=l.character,s=c.contentScale,rule=characterRule(scene.selectedCharacter);
    portrait(scene.dealerTextures[0],root,c.art,c.art.height/.58);
    if(!c.vertical){
      const p=c.panel,frame=new Graphics({label:'character-selection-frame',eventMode:'none'});
      frame.roundRect(p.x-p.width/2,p.y-p.height/2,p.width,p.height,18*s).fill({color:0x171525,alpha:.55}).stroke({color:PALETTE.gold,alpha:.35,width:s});
      for(const sign of [-1,1])frame.moveTo(p.x+sign*p.width*.32,p.y-p.height/2).lineTo(p.x+sign*p.width*.42,p.y-p.height/2).stroke({color:PALETTE.gold,alpha:.85,width:2*s});
      root.addChild(frame);
    }
    title('野球拳・選擇對手',c.infoX,c.headingY,root,c.vertical?17:20*s);
    title(rule.name,c.infoX,c.nameY,root,c.vertical?19:30*s,PALETTE.cream,{fontWeight:'500'});
    if(!c.vertical)title('酒紅襯衫、黑色背心，邀你入局。',c.infoX,c.descriptionY,root,14*s,PALETTE.muted);
    title(`${rule.winsRequired} 勝通關 · ${rule.lossLimit} 敗結束 · 獎金 ${rule.reward.toLocaleString('en-US')}`,c.infoX,c.rulesY,root,c.vertical?Math.min(13,(width-24)/25):15*s,PALETTE.gold);
    scene.portraitGradient ??=new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:0x493037},{offset:.5,color:0x111729},{offset:1,color:0x251725}]});
    CHARACTERS.forEach((character,index)=>{
      const r=c.slots[index],button=new PixiButton({name:`選擇${character.name}`,width:r.width,height:r.height,onPress:()=>scene.selectCharacter(character.id)});
      button.position.set(r.x,r.y);root.addChild(button);
      button.background.context.batchMode='batch';
      button.background.clear().roundRect(-r.width/2,-r.height/2,r.width,r.height,9*s)
        .fill(scene.portraitGradient)
        .stroke({color:index?0x6a5259:PALETTE.gold,width:(index?1:2)*s});
      const stage=new Graphics({label:'portrait-stage',eventMode:'none'});
      stage.poly([-r.width*.34,-r.height*.46,0,r.height*.34,r.width*.34,-r.height*.46]).fill({color:0xe6c488,alpha:index?.025:.10});
      stage.moveTo(-r.width*.43,r.height*.32).lineTo(r.width*.43,r.height*.32).stroke({color:PALETTE.gold,width:s,alpha:.18});
      button.addChild(stage);
      if(!index){portrait(scene.dealerTextures[0],button,{x:-r.width/2+3,y:-r.height/2+3,width:r.width-6,height:r.height-6},r.height*2.4);}
      else title(['','II','III','IV','V'][index],0,-8*s,button,22*s,0x887783,{fontFamily:['Georgia','serif']});
      button.addChild(new Graphics().rect(-r.width/2+3,r.height/2-24*s,r.width-6,21*s).fill({color:0x201522,alpha:.92}));
      title(index?'準備中':'荷官',0,r.height/2-13*s,button,Math.max(11,11*s),index?0xa493a0:PALETTE.gold);
      if(!character.enabled)button.setEnabled(false);
    });
    title(scene.wallet?'入場費不予退還':'本機試玩暫不扣款',c.infoX,c.feeY,root,Math.max(12,12*s),PALETTE.muted);
    at(new PixiButton({text:`入場 ${ENTRY_FEE.toLocaleString('en-US')} 戲籌`,name:'進入野球拳試玩',variant:'gold',width:c.buttonWidth,height:c.buttonHeight,fontSize:16*s,onPress:()=>scene.enterCharacter()}),c.infoX,c.enterY,root);
  }
}
