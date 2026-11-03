import {Container,FillGradient,Graphics,Sprite} from 'pixi.js';
import {CHARACTERS,ENTRY_FEE} from '../characters.js';
import {label,PALETTE,PixiButton} from './ui.js';
import {lobbyLayout} from './lobby-layout.js';

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
    logo(scene,root,width/2,headerHeight+12,l.logoWidth);
    title('選擇遊戲',width/2,l.headingY,root,19);
    for(const [index,name] of ['老虎機','野球拳'].entries()){
      const r=l.games[index],button=new PixiButton({name:`選擇${name}`,width:r.width,height:r.height,onPress:()=>index?scene.visitScreen('characters'):scene.openSlot()});
      button.position.set(r.x,r.y);root.addChild(button);
      const gradient=new FillGradient({start:{x:0,y:0},end:{x:1,y:1},colorStops:[{offset:0,color:index?0x4a253b:0x44302b},{offset:.55,color:0x171526},{offset:1,color:0x321a29}]});
      button.background.clear().roundRect(-r.width/2,-r.height/2,r.width,r.height,14).fill(gradient).stroke({color:0xc59a53,width:1});
      button.background.roundRect(-r.width/2+5,-r.height/2+5,r.width-10,r.height-10,10).stroke({color:0xe7be71,width:1,alpha:.23});
      if(index){portrait(scene.dealerTextures[0],button,{x:-r.width/2+6,y:-r.height/2+6,width:r.width-12,height:r.height-12},r.height*2.0);}
      else{
        const reels=new Graphics(),rw=Math.min(76,r.width*.17),rh=Math.min(112,r.height*.47),reelY=-r.height*.13;
        for(let reel=-1;reel<=1;reel++){
          reels.roundRect(reel*(rw+8)-rw/2,reelY-rh/2,rw,rh,8).fill(0xefd7a4).stroke({color:0xbb8843,width:3});
          title(reel===0?'J':'7',reel*(rw+8),reelY,button,Math.min(54,rh*.6),0x9d2139,{fontFamily:['Georgia','serif'],fontWeight:'bold'});
        }
        button.addChildAt(reels,2);
      }
      const band=new Graphics().roundRect(-r.width/2+6,r.height/2-77,r.width-12,71,8).fill({color:0x201322,alpha:.95});button.addChild(band);
      title(name,0,r.height/2-50,button,22,PALETTE.cream,{fontWeight:'500'});
      title(index?'選擇對手，展開一場猜拳對決':'進入經典老虎機',0,r.height/2-24,button,12,PALETTE.muted);
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
    at(new PixiButton({text:'進入試玩',name:'進入野球拳試玩',variant:'gold',width:176,height:44,fontSize:14,onPress:()=>scene.enterCharacter()}),c.infoX,c.enterY,root);
  }
}
