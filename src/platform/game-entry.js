export const GAME_ENTRY_PATH = '/game-entry.json';

export async function readGameEntry(fetchImpl = fetch, {after,signal} = {}) {
  const timeout=AbortSignal.timeout(after===undefined?5000:15000);
  const response = await fetchImpl(GAME_ENTRY_PATH+'?controls=1'+(after===undefined?'':'&after='+after), {
    cache: 'no-store',
    signal: signal?AbortSignal.any([signal,timeout]):timeout,
  });
  if(after!==undefined&&response.status===204)return null;
  if (!response.ok) throw new Error('Game entry status is unavailable');
  const {mode, previewUserIds, revision} = await response.json();
  if (!['open', 'maintenance'].includes(mode) || !Array.isArray(previewUserIds) ||
      !previewUserIds.every(id => typeof id === 'string' && /^\d{17,20}$/.test(id))) {
    throw new Error('Invalid game entry status');
  }
  return {mode, previewUserIds, ...(Number.isSafeInteger(revision)&&revision>=0?{revision}:{})};
}

export function canEnterGame({mode, previewUserIds}, activity) {
  if (mode === 'open') return true;
  const id = activity?.session?.userId;
  return activity?.mode === 'discord' && activity.user?.id === id && previewUserIds.includes(id);
}
