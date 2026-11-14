import {Graphics,Sprite} from 'pixi.js';
import {label,PALETTE} from '../pixi/ui.js';
import {createGameCover} from './game-cover.js';

export function addLobbyBackdrop(root,texture,width,height){
  const background=new Sprite({texture,eventMode:'none'});
  background.width=width;background.height=height;
  const shade=new Graphics().rect(0,0,width,height).fill({color:0x070d1c,alpha:.16});
  shade.eventMode='none';
  root.addChild(background,shade);
}

export function buildGameLobby(root,{width,height,layout,logoTexture,games}){
  const logo=new Sprite(logoTexture);
  logo.anchor.set(.5,0);logo.width=layout.logoWidth;logo.scale.y=logo.scale.x;
  logo.position.set(width/2,layout.logoY);root.addChild(logo);
  const title=(text,y,size,color,options)=>{
    const node=label(text,size,color,options);
    node.position.set(width/2,y);root.addChild(node);
  };
  title('選擇你的舞台',layout.headingY,layout.headingSize,PALETTE.cream,{fontWeight:'500'});
  title('玩轉輪，或挑一位對手猜拳。',layout.subtitleY,height<500?12:13,PALETTE.muted);
  title('聚光燈已亮起，好戲等你入場。',layout.footerY,12,PALETTE.muted);
  return games.map((game,index)=>{
    const card=createGameCover({...game,area:layout.games[index]});
    root.addChild(card);
    return card;
  });
}
