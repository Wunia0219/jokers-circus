import {Container,Graphics,Sprite} from 'pixi.js';
import {CHARACTERS,ENTRY_FEE} from '../characters.js';
import {label,PALETTE,PixiButton} from './ui.js';
import {lobbyLayout} from './lobby-layout.js';
import {createGameCover} from './game-cover.js';
import {LOBBY_COVERS} from '../lobby-art.js';
import {difficultyRule} from '../challenge.js';

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
  const l=lobbyLayout(width,height,headerHeight);scene.lobbyLayout=l;
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
    const c=l.character;
    portrait(scene.dealerTextures[0],root,c.art,c.art.height/.58);
    title('野球拳・選擇對手',c.infoX,c.headingY,root,ui.mobile?17:19);
    title('命運荷官',c.infoX,c.nameY,root,ui.mobile?19:26,PALETTE.cream,{fontWeight:'500'});
    if(!ui.mobile)title('酒紅襯衫、黑色背心，邀你入局。',c.infoX,c.descriptionY,root,13,PALETTE.muted);
    CHARACTERS.forEach((character,index)=>{
      const r=c.slots[index],button=new PixiButton({name:`選擇${character.name}`,width:r.width,height:r.height,onPress:()=>scene.selectCharacter(character.id)});
      button.position.set(r.x,r.y);root.addChild(button);
      button.background.clear().roundRect(-r.width/2,-r.height/2,r.width,r.height,9).fill(index?0x211a2b:0x57302f).stroke({color:index?0x6a5259:PALETTE.gold,width:index?1:2});
      if(!index){portrait(scene.dealerTextures[0],button,{x:-r.width/2+3,y:-r.height/2+3,width:r.width-6,height:r.height-6},r.height*2.4);}
      else title(['','II','III','IV','V'][index],0,-8,button,22,0x887783,{fontFamily:['Georgia','serif']});
      button.addChild(new Graphics().rect(-r.width/2+3,r.height/2-24,r.width-6,21).fill({color:0x201522,alpha:.92}));
      title(index?'準備中':'荷官',0,r.height/2-13,button,11,index?0xa493a0:PALETTE.gold);
      if(!character.enabled)button.setEnabled(false);
    });
    title(`入場 ${ENTRY_FEE.toLocaleString('en-US')} 戲籌・本機暫不扣款`,c.infoX,c.feeY,root,12,PALETTE.muted);
    const buttonWidth=Math.min(176,(width-44)/2),offset=(buttonWidth+12)/2;
    at(new PixiButton({text:`難度${difficultyRule(scene.selectedDifficulty).name}`,name:'選擇難度',width:buttonWidth,height:44,fontSize:14,onPress:()=>scene.openModal('difficulty')}),c.infoX-offset,c.enterY,root);
    at(new PixiButton({text:'進入試玩',name:'進入野球拳試玩',variant:'gold',width:buttonWidth,height:44,fontSize:14,onPress:()=>scene.enterCharacter()}),c.infoX+offset,c.enterY,root);
  }
}
