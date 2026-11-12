import {readFileSync} from 'node:fs';

export const launchScreenMarkup={
  name:'launch-screen-markup',
  transformIndexHtml(html){
    const marker='<!-- launch-screen -->';
    if(!html.includes(marker))return;
    return html.replace(marker,readFileSync(new URL('../../src/platform/launch-screen.html',import.meta.url),'utf8'));
  },
};
