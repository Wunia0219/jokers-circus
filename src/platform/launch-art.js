export const LAUNCH_ART=Object.freeze([
  Object.freeze({id:'golden-salon',url:new URL('../../images/launch/golden-salon.webp',import.meta.url).href,portrait:new URL('../../images/launch/portrait-golden-salon.webp',import.meta.url).href}),
  Object.freeze({id:'last-spin',url:new URL('../../images/launch/last-spin.webp',import.meta.url).href,portrait:new URL('../../images/launch/portrait-last-spin.webp',import.meta.url).href}),
  Object.freeze({id:'curtain-rises',url:new URL('../../images/launch/curtain-rises.webp',import.meta.url).href,portrait:new URL('../../images/launch/portrait-curtain-rises.webp',import.meta.url).href}),
]);

// Called once per outer activity document, never on resize or child navigation.
export function chooseLaunchArt(random=Math.random){
  const value=random(),unit=Number.isFinite(value)?Math.max(0,Math.min(value,1)):0;
  return LAUNCH_ART[Math.min(LAUNCH_ART.length-1,Math.floor(unit*LAUNCH_ART.length))];
}
