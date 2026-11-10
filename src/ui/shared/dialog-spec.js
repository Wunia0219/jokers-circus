// Shared brand typography and spacing for DOM and Pixi dialog footers.
// CSS counterparts are reviewed in game-rules.css / player-ui.css.
export const DIALOG_BRAND='JOKER’S CIRCUS';
export const DIALOG_FOOTER=Object.freeze({fontSize:11,fontFamily:['Georgia','serif'],letterSpacing:1,color:0xcfb6c1,legalGap:24,mobileInset:16,desktopInset:24});

// The slot rules use native HTML, while the CG collection uses Pixi. Keep
// their frame measurements and palette here rather than tuning them separately.
export const PROGRAMME=Object.freeze({maxWidth:960,maxHeight:880,margin:16,smallMargin:8,border:1,radius:20,smallRadius:16,
  header:60,smallHeader:61,shortHeader:56,inset:24,smallInset:16,title:20,smallTitle:18,close:44,icon:21,
  logo:200,smallLogo:220,shortLogo:180,mastheadInset:32,smallMastheadInset:16,mastheadPad:14,smallMastheadPad:20,shortMastheadPad:12,
  tabInset:32,smallTabInset:12,tabPad:8,
  gold:0xf5d28c,edge:0xb58b56,surface:0x201626,glow:0x573249,headStart:0x542234,headEnd:0x2a192c,line:0xd7ae65,
  backdrop:0x100818,closeSurface:0x281b2a,tab:48,tabGap:8});

export function programmeFrame(width,height,viewportWidth=width,viewportHeight=height){
  const mobile=viewportWidth<=600,short=!mobile&&viewportHeight<=500;
  return {mobile,short,width:Math.min(PROGRAMME.maxWidth,width-2*(mobile?PROGRAMME.smallMargin:PROGRAMME.margin)),
    height:Math.min(mobile||short?Infinity:PROGRAMME.maxHeight,height-2*(mobile||short?PROGRAMME.smallMargin:PROGRAMME.margin)),
    radius:mobile?PROGRAMME.smallRadius:PROGRAMME.radius,header:mobile?PROGRAMME.smallHeader:short?PROGRAMME.shortHeader:PROGRAMME.header,
    inset:mobile?PROGRAMME.smallInset:PROGRAMME.inset,title:mobile?PROGRAMME.smallTitle:PROGRAMME.title};
}

export function applyProgrammeTheme(element){
  const colours=new Set(['gold','edge','surface','glow','headStart','headEnd','line','backdrop','closeSurface']);
  for(const [key,value] of Object.entries(PROGRAMME)){
    element.style.setProperty('--programme-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),colours.has(key)?'#'+value.toString(16).padStart(6,'0'):value+'px');
  }
  element.style.setProperty('--programme-glow-tint',`#${PROGRAMME.glow.toString(16)}88`);
}

const gutters=new WeakMap();
export function programmeScrollbarWidth(doc){
  if(!gutters.has(doc)){
    const probe=doc.createElement('div');
    Object.assign(probe.style,{position:'fixed',visibility:'hidden',width:'100px',height:'100px',overflow:'auto',scrollbarWidth:'thin',scrollbarGutter:'stable'});
    doc.body.append(probe);gutters.set(doc,probe.offsetWidth-probe.clientWidth);probe.remove();
  }
  return gutters.get(doc);
}
