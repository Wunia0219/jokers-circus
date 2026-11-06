export async function revealCard({motion,scale,showFront,isValid=()=>true}) {
  const closed=await motion.to(scale,{x:.035},150);
  if(!closed || !isValid())return false;
  showFront();
  const opened=await motion.to(scale,{x:1},180);
  return opened && isValid();
}
