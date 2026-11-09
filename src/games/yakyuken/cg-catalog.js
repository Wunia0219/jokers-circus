// Public artwork identifiers only. Never include account or launch information.
export const CG_ORIGIN='https://jokers-circus-gallery.pages.dev';
const collection=(characterId,key,displayKey,entries)=>Object.freeze(entries.map((art,index)=>Object.freeze({
  ...art,index,characterId,path:`/cg/yakyuken/${key}/${art.slug}`,image:`/images/yakyuken/${key}/${art.slug}.png`,
  download:`/downloads/yakyuken/${key}-stage-${index}.png`,filename:`Jokers-Circus-Yakyuken-${displayKey}-${art.slug}.png`,
})));

export const DEALER_CG=collection('dealer','dealer','Dealer',[
  {slug:'invitation',name:'邀你入局'},
  {slug:'first-win',name:'漸入佳境'},
  {slug:'finale',name:'終幕'},
]);
export const CG_ART=Object.freeze({dealer:DEALER_CG,'guest-1':collection('guest-1','youran','Youran',[
  {slug:'invitation',name:'工匠邀約'},
  {slug:'first-win',name:'熱身過後'},
  {slug:'second-win',name:'撥髮迎戰'},
  {slug:'finale',name:'優然終幕'},
])});
export const ALL_CG=Object.freeze(Object.values(CG_ART).flat());

export function cgFromLocation({pathname,search=''}){
  const path=pathname.replace(/\/$/,'');
  const art=ALL_CG.find(art=>art.path===path);
  if(art)return art;
  // Old shared links remain readable; new links always use descriptive paths.
  const stage=new URLSearchParams(search).get('stage');
  return path==='/cg-download.html' && /^[0-2]$/.test(stage||'')?DEALER_CG[Number(stage)]:null;
}
