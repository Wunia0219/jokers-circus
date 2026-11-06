// Static download URLs are deliberately excluded from Pixi Assets imports.
// Browsers request the original PNG only after the player activates Download.
import {CG_ORIGIN,DEALER_CG} from './cg-catalog.js';

export async function downloadCG(archive,characterId,index,activity=null){
  if(characterId!=='dealer' || !Number.isInteger(index) || index<0 || index>2 || !archive.isUnlocked(characterId,index))return false;
  const art=DEALER_CG[index];
  if(activity?.mode==='discord'){
    if(!activity.sdk?.commands?.openExternalLink)throw new Error('下載連線尚未就緒，請關閉活動後重新啟動。');
    const result=await activity.sdk.commands.openExternalLink({url:CG_ORIGIN+art.path});
    return result?.opened===true;
  }
  const link=document.createElement('a');
  link.href=`/downloads/yakyuken/dealer-stage-${index}.png`;
  link.download=art.filename;
  link.hidden=true;document.body.append(link);link.click();link.remove();return true;
}
