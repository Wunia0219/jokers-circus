// Public artwork identifiers only. Never include account or launch information.
export const CG_ORIGIN='https://jokers-circus-gallery.pages.dev';
export const DEALER_CG=Object.freeze([
  {slug:'invitation',name:'邀你入局'},
  {slug:'first-win',name:'漸入佳境'},
  {slug:'finale',name:'終幕'},
].map((art,index)=>Object.freeze({...art,index,path:`/cg/yakyuken/dealer/${art.slug}`,image:`/images/yakyuken/dealer/${art.slug}.png`,filename:`Jokers-Circus-Yakyuken-Dealer-${art.slug}.png`})));

export function cgFromLocation({pathname,search=''}){
  const path=pathname.replace(/\/$/,'');
  const art=DEALER_CG.find(art=>art.path===path);
  if(art)return art;
  // Old shared links remain readable; new links always use descriptive paths.
  const stage=new URLSearchParams(search).get('stage');
  return path==='/cg-download.html' && /^[0-2]$/.test(stage||'')?DEALER_CG[Number(stage)]:null;
}
