// Pixi's accessibility overlay sends mouseover on focus, even for a pointer click.
// Native enter/leave and keyboard focus are tracked separately so neither sticks.
export function installPointerFeedback(target,signal){
  let hovered=null,focused=null,keyboard=false;
  const node=event=>event.target?.container;
  const clear=()=>{hovered?.hover?.(false);focused?.focus?.(false);hovered=focused=null;};
  target.addEventListener('pointerdown',()=>{keyboard=false;focused?.focus?.(false);focused=null;},{capture:true,signal});
  target.addEventListener('keydown',event=>{if(event.key==='Tab')keyboard=true;},{capture:true,signal});
  target.addEventListener('pointerover',event=>{const next=node(event);if(hovered!==next){hovered?.hover?.(false);hovered=next;hovered?.hover?.(true);}},{signal});
  target.addEventListener('pointerout',event=>{node(event)?.hover?.(false);if(hovered===node(event))hovered=null;},{signal});
  target.addEventListener('focusin',event=>{focused?.focus?.(false);focused=node(event);focused?.focus?.(keyboard);},{signal});
  target.addEventListener('focusout',event=>{node(event)?.focus?.(false);if(focused===node(event))focused=null;},{signal});
  target.defaultView?.addEventListener('blur',clear,{signal});
  signal.addEventListener('abort',clear,{once:true});
}
