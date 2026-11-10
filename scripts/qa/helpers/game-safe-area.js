import assert from 'node:assert/strict';

export async function setGameSafeArea(shell,frame,insets){
  await shell.evaluate(insets=>{
    for(const [edge,value] of Object.entries(insets)){
      const key='--discord-safe-area-inset-'+edge;
      if(value===null)document.documentElement.style.removeProperty(key);
      else document.documentElement.style.setProperty(key,value+'px');
    }
  },insets);
  await frame.waitForFunction(insets=>{
    const s=window.__playerScene,r=document.querySelector('#yakyuken-app')?.getBoundingClientRect();
    if(!s?.layout||!r)return false;
    const {top=0,right=0,bottom=0,left=0}=insets;
    return r.x===(left??0)&&r.y===(top??0)&&r.width===innerWidth-(left??0)-(right??0)&&r.height===innerHeight-(top??0)-(bottom??0)
      &&s.layout.ui.width===r.width&&s.layout.ui.height===r.height&&s.app.screen.width===r.width&&s.app.screen.height===r.height;
  },insets);
}

export async function yakyukenHeaderBounds(frame){
  return frame.evaluate(()=>{
    const s=window.__playerScene,r=s.app.canvas.getBoundingClientRect();
    const bounds=node=>{const b=node.getBounds();return {x:r.x+b.x,y:r.y+b.y,width:b.width,height:b.height};};
    return {checkin:s.checkinButton.element.getBoundingClientRect().toJSON(),tools:bounds(s.hud.getChildByLabel('player-tools-frame'))};
  });
}

export function assertSameGameHeader(yakyuken,slot){
  for(const key of ['checkin','tools'])for(const axis of ['x','y','width','height']){
    // Pixi's centered 1px stroke extends half a pixel beyond each CSS border.
    assert.ok(Math.abs(yakyuken[key][axis]-slot[key][axis])<=1.01,`${key}.${axis}: Yakyuken ${yakyuken[key][axis]} matches slot ${slot[key][axis]}`);
  }
}
