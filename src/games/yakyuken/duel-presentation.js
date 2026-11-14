const DIALOGUE = Object.freeze({
  dealer: {
    opening: '來，坐這邊。準備好了，我們就開場。',
    win: ['漂亮，這拳算你的。', '這拳打得好，我認輸。', '喔，這拳有點出乎我意料。'],
    loss: ['好，這拳我先收下了。', '差一點。再來一拳？', '別急，下一拳還有機會。'],
    draw: ['打平了？好，那就加演一拳。', '這麼巧？再來。', '平手。下一拳再分勝負。'],
    won: '這場打得漂亮。來，獎金是你的。',
    lost: '今天先到這裡。下次來，我再給你留個位子。',
  },
  'guest-1': {
    opening: '你看我看這麼久，想好要出哪一拳了沒？',
    win: ['欸，有一套嘛。', '好啦，這拳你贏。別笑得那麼開心。', '欸，我還以為這拳穩了。'],
    loss: ['這拳我贏了。你剛剛在看哪裡啊？', '嘿，被我猜到了吧。', '差一點喔。要不要再來？'],
    draw: ['也太有默契了吧。再來？', '你也出這個喔？', '平手欸。好啦，再猜一次。'],
    won: '好啦，我輸得心服口服。這樣你滿意了沒？',
    lost: '今天算我贏。下次換你讓我猜不到。',
  },
  'guest-2': {
    opening: '慢慢來，準備好了再出。',
    win: ['這拳你猜得剛剛好。', '啊，被你猜到了。', '我還以為你會出別的耶。'],
    loss: ['差一點。你可以再想一下。', '這拳我贏了。慢慢來。', '沒關係，還有下一拳。'],
    draw: ['我們想到一樣的了。再試一次？', '一樣耶。那就再來。', '平手。你要換嗎？我先不說。'],
    won: '你贏了。看來我剛剛鬆懈了。',
    lost: '今天先到這裡吧。跟你玩還滿開心的。',
  },
  'guest-3': {
    opening: '好了就出。',
    win: ['這拳選得好。', '嗯，這拳你贏。', '這拳我沒猜到。'],
    loss: ['差一點。再來？', '這拳我贏。', '我先贏一拳。'],
    draw: ['平手。誰也別得意。', '一樣。再來。', '好，這拳不算。'],
    won: '你贏了。我沒話說。',
    lost: '先到這。下次記得換招。',
  },
  'guest-4': {
    opening: '準備好了，就請出拳吧。',
    win: ['這一拳，你贏了。', '你猜得很準。', '這拳出得漂亮。'],
    loss: ['這一拳是我贏。', '這次是我猜中了。', '這拳我先拿下了。請繼續。'],
    draw: ['平手。請再出一拳。', '看來我們想到一樣的了。', '這拳打平了。再比一次吧。'],
    won: '你贏了。這一場打得很漂亮。',
    lost: '今天就到這裡吧。謝謝你來。',
  },
});

export function openingDialogue(characterId) {
  return DIALOGUE[characterId].opening;
}

export function resultDialogue({characterId, outcome, round, status}) {
  const voice = Object.hasOwn(DIALOGUE, characterId) ? DIALOGUE[characterId] : null;
  if (!voice || !['win', 'loss', 'draw'].includes(outcome) || !Number.isInteger(round) || round < 1) {
    throw new Error('Invalid revealed round');
  }
  if (status === 'won' || status === 'lost') return voice[status];
  return voice[outcome][(round - 1) % voice[outcome].length];
}

export function earnedPose(wins,artCount){return Math.min(Math.max(0,wins),artCount-1);}

export const WARDROBE_DURATION=2100;
const ramp=(t,start,end)=>Math.max(0,Math.min(1,(t-start)/(end-start)));
const ease=t=>t*t*(3-2*t);
// A single elapsed-time timeline survives resize and late frames without
// restarting, settling another hand, or committing an outfit twice.
export function wardrobeFrame(elapsed){
  const focus=ease(ramp(elapsed,0,360))*(1-ease(ramp(elapsed,1580,WARDROBE_DURATION)));
  return {focus,newAlpha:ease(ramp(elapsed,160,640)),
    committed:elapsed>=640,complete:elapsed>=WARDROBE_DURATION};
}
