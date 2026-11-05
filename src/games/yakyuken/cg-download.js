// Static download URLs are deliberately excluded from Assets/preloadArt imports.
// Browsers request the original PNG only after the player activates Download.
export function downloadCG(archive,characterId,index){
  if(characterId!=='dealer' || !Number.isInteger(index) || index<0 || index>2 || !archive.isUnlocked(characterId,index))return false;
  const link=document.createElement('a');
  link.href=`/downloads/yakyuken/dealer-stage-${index}.png`;
  link.download=`Jokers-Circus-dealer-CG-${index+1}.png`;
  link.hidden=true;document.body.append(link);link.click();link.remove();return true;
}
