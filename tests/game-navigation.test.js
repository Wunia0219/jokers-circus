import test from 'node:test';
import assert from 'node:assert/strict';
import {PREVIEW_LOBBY_PATH,slotLobbyPath,canReturnToLobby} from '../src/platform/game-navigation.js';

test('lobby navigation: only an explicit local preview visit offers the unpublished lobby',()=>{
  assert.equal(slotLobbyPath(new URL('http://127.0.0.1:4195/?lobby=preview')),PREVIEW_LOBBY_PATH);
  for(const url of ['http://127.0.0.1:4195/','http://127.0.0.1:4195/?lobby=https://example.com','https://example.com/?lobby=preview','https://123.discordsays.com/?lobby=preview'])assert.equal(slotLobbyPath(new URL(url)),null);
});
test('lobby navigation: active rounds, checkins and unresolved settlements block leaving',()=>{
  const idle={ready:true,busy:false,claiming:false,pending:false};
  assert.equal(canReturnToLobby(idle),true);
  for(const state of [{...idle,ready:false},{...idle,busy:true},{...idle,claiming:true},{...idle,pending:true}])assert.equal(canReturnToLobby(state),false);
  assert.equal(canReturnToLobby({...idle,pending:undefined}),true);
});
