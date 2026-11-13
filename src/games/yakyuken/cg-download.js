// Static download URLs are deliberately excluded from Pixi Assets imports.
// Browsers request the original PNG only after the player activates Download.
import {CG_ORIGIN,CG_ART} from './cg-catalog.js';

const testTowelDownload='https://jokers-circus-arcade-test.nini900219.workers.dev/arcade/feature/youran-finale.png';

export async function downloadCG(archive,characterId,index,activity=null){
  const art=Object.hasOwn(CG_ART,characterId)&&Number.isInteger(index)?CG_ART[characterId][index]:null;
  if(!art || !archive.isUnlocked(characterId,index))return false;
  if(activity?.mode==='discord'){
    if(!activity.sdk?.commands?.openExternalLink)throw new Error('下載連線尚未就緒，請關閉活動後重新啟動。');
    const url=import.meta.env?.VITE_ARCADE_TEST_TOWEL==='true'&&activity.session?.environment==='test'&&
      characterId==='guest-1'&&art.slug==='finale'?testTowelDownload:CG_ORIGIN+art.path;
    const result=await activity.sdk.commands.openExternalLink({url});
    return result?.opened===true;
  }
  const link=document.createElement('a');
  link.href=art.download;
  link.download=art.filename;
  link.hidden=true;document.body.append(link);link.click();link.remove();return true;
}
