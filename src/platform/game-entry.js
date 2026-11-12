export const GAME_ENTRY_PATH = '/game-entry.json';

export async function readGameEntry(fetchImpl = fetch) {
  const response = await fetchImpl(GAME_ENTRY_PATH+'?controls=1', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Game entry status is unavailable');
  const {mode, previewUserIds} = await response.json();
  if (!['open', 'maintenance'].includes(mode) || !Array.isArray(previewUserIds) ||
      !previewUserIds.every(id => typeof id === 'string' && /^\d{17,20}$/.test(id))) {
    throw new Error('Invalid game entry status');
  }
  return {mode, previewUserIds};
}

export function canEnterGame({mode, previewUserIds}, activity) {
  if (mode === 'open') return true;
  const id = activity?.session?.userId;
  return activity?.mode === 'discord' && activity.user?.id === id && previewUserIds.includes(id);
}
