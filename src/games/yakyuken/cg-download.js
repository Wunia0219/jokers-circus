// Static download URLs are deliberately excluded from Assets/preloadArt imports.
// Browsers request the original PNG only after the player activates Download.
export async function downloadCG(archive,characterId,index,activity=null){
  if(characterId!=='dealer' || !Number.isInteger(index) || index<0 || index>2 || !archive.isUnlocked(characterId,index))return false;
  if(activity?.mode==='discord'){
    if(!activity.sdk?.commands?.openExternalLink)throw new Error('下載連線尚未就緒，請關閉活動後重新啟動。');
    const result=await activity.sdk.commands.openExternalLink({url:`https://jokers-circus-yakyuken-test.nini900219.workers.dev/cg-download.html?stage=${index}`});
    return result?.opened===true;
  }
  const link=document.createElement('a');
  link.href=`/downloads/yakyuken/dealer-stage-${index}.png`;
  link.download=`Jokers-Circus-dealer-CG-${index+1}.png`;
  link.hidden=true;document.body.append(link);link.click();link.remove();return true;
}
