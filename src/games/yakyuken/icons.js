const wrap = paths => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export function handIcon(move) {
  if (move === 'rock') return wrap('<path d="M18 48 12 37V26c0-5 8-5 8 0v7-13c0-5 8-5 8 0v11-14c0-5 8-5 8 0v14-11c0-5 8-5 8 0v15l2-6c2-6 9-3 7 3l-5 17-6 7H25Z"/><path d="M20 33v5m8-7v7m8-7v7m8-3v5M24 55h18"/>');
  if (move === 'paper') return wrap('<path d="m20 49-9-14c-3-5 3-9 6-5l6 7-3-25c-.7-6 7-7 8-1l2 20V7c0-6 8-6 8 0v24l3-21c1-6 9-5 8 1l-3 22 5-14c2-5 9-2 7 3l-7 25-8 10H28Z"/>');
  if (move === 'scissors') return wrap('<path d="m22 51-10-14c-3-5 3-9 6-5l7 9-8-27c-2-6 5-9 8-3l10 23 4-25c1-6 9-4 8 2l-3 25c2-5 8-4 8 1l-1 10-9 10H28Z"/><path d="M44 36c-6-4-11 2-7 7l7 3m-19-5 5 7"/>');
  return wrap('<path d="m32 10 20 22-20 22L12 32Z"/><path d="M28 26c1-6 10-6 10 0 0 4-6 4-6 9m0 7v1"/>');
}
export const soundIcon = muted => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4Z"/>${muted?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>'}</svg>`;
