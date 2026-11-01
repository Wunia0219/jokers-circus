import stage0 from '../../../images/yakyuken/dealer/stage-0.webp';
import stage1 from '../../../images/yakyuken/dealer/stage-1.webp';
import stage2 from '../../../images/yakyuken/dealer/stage-2.webp';

export const DEALER_ART = Object.freeze([
  {url:stage0, name:'邀你入局', description:'酒紅襯衫與黑色背心，伸手邀請猜拳'},
  {url:stage1, name:'漸入佳境', description:'酒紅襯衫、自然撥髮與剪刀手勢'},
  {url:stage2, name:'終幕', description:'後頸低束長髮、赤膊與黑色長褲'},
]);

export async function preloadArt() {
  return Promise.all(DEALER_ART.map(({url}) => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => image.decode().then(() => resolve(image),reject);
    image.onerror = () => reject(new Error('角色圖片載入失敗，請重新載入試玩。'));
    image.src = url;
  })));
}
