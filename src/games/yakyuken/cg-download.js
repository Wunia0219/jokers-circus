// Static download URLs are deliberately excluded from Pixi Assets imports.
// Browsers request the original PNG only after the player activates Download.
import {CG_ORIGIN,CG_ART} from './cg-catalog.js';

const testDownloads='https://jokers-circus-arcade-test.nini900219.workers.dev/arcade/feature/';

export async function downloadCG(archive,characterId,index,activity=null){
  const art=Object.hasOwn(CG_ART,characterId)&&Number.isInteger(index)?CG_ART[characterId][index]:null;
  if(!art || !archive.isUnlocked(characterId,index))return false;
  if(activity?.mode==='discord'){
    if(!activity.sdk?.commands?.openExternalLink)throw new Error('下載連線尚未就緒，請關閉活動後重新啟動。');
    let url=CG_ORIGIN+art.path;
    if(import.meta.env?.VITE_ARCADE_TEST_DOWNLOADS==='true'&&activity.session?.environment==='test'){
      if(characterId==='guest-1'&&art.slug==='finale')url=testDownloads+'youran-finale.png';
      if(characterId==='guest-3'&&index>0)url=testDownloads+'selo-stage-'+index+'.png';
    }
    const result=await activity.sdk.commands.openExternalLink({url});
    return result?.opened===true;
  }
  const link=document.createElement('a');
  link.href=art.download;
  link.download=art.filename;
  link.hidden=true;document.body.append(link);link.click();link.remove();return true;
}
