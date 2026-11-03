export const PREVIEW_LOBBY_PATH='/yakyuken-preview.html';
export const PREVIEW_SLOT_PATH='/?lobby=preview';

// The lobby is currently a local preview, not part of the deployed slot entry.
export function slotLobbyPath(location){
  return location.protocol==='http:' && location.hostname==='127.0.0.1' && new URLSearchParams(location.search).get('lobby')==='preview'?PREVIEW_LOBBY_PATH:null;
}
export function canReturnToLobby({ready,busy,claiming,pending}){return !!ready && !busy && !claiming && !pending;}
