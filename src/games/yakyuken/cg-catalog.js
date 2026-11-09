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
]),'guest-2':collection('guest-2','xiache','Xiache',[
  {slug:'invitation',name:'整理袖口'},
  {slug:'first-win',name:'低頭解扣'},
  {slug:'second-win',name:'敞領側望'},
  {slug:'third-win',name:'收起襯衫'},
  {slug:'fourth-win',name:'輕撥瀏海'},
  {slug:'finale',name:'夏澄終幕'},
]),'guest-3':collection('guest-3','selo','Selo',[
  {slug:'invitation',name:'整袖入局'},
  {slug:'first-win',name:'收起外套'},
  {slug:'second-win',name:'卸下領帶'},
  {slug:'third-win',name:'敞開襯衫'},
  {slug:'fourth-win',name:'收起襯衫'},
  {slug:'fifth-win',name:'提鞋側望'},
  {slug:'sixth-win',name:'抱臂相望'},
  {slug:'finale',name:'瑟洛終幕'},
]),'guest-4':collection('guest-4','wanshi','Wanshi',[
  {slug:'invitation',name:'藍蝶赴約'},
  {slug:'sapphire-pin',name:'取下藍蝶領針'},
  {slug:'leather-gloves',name:'收起皮手套'},
  {slug:'fur-cape',name:'卸下毛領披肩'},
  {slug:'tuxedo-jacket',name:'褪下西裝外套'},
  {slug:'waistcoat',name:'卸下訂製背心'},
  {slug:'open-collar',name:'解開絲質襯衫'},
  {slug:'sapphire-earrings',name:'摘下藍寶石耳飾'},
  {slug:'dress-shoes',name:'褪去晚宴皮鞋'},
  {slug:'finale',name:'萬世終幕'},
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
