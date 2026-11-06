export const LOBBY_READY_EVENT='circus:lobby-rendered';
export const LOBBY_FAILED_EVENT='circus:lobby-failed';

// Readiness carries no credentials and never crosses the same-origin host.
export function reportLobbyBoot(ok){
  try{
    if(window.parent!==window&&window.parent.location.origin===location.origin){
      window.parent.postMessage({type:ok?LOBBY_READY_EVENT:LOBBY_FAILED_EVENT},location.origin);
    }
  }catch{ /* A standalone game has no launch host to notify. */ }
}
