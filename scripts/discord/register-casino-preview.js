import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {casinoPreviewCommand} from '../../server/discord/casino-preview.js';

const app = JSON.parse(readFileSync('.tools/discord-test-app.json', 'utf8'));
const id = '1567875182792544256', guild = '760012177326997544', channel = '1564243344857632818';
assert.deepEqual([app.purpose, app.clientId, app.guildId, app.channelId], ['discord-test', id, guild, channel]);
assert.ok(app.clientSecret, 'Missing test App client secret');
const base = 'https://discord.com/api/v10';
const auth = await fetch(base + '/oauth2/token', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: {Authorization: 'Basic ' + Buffer.from(id + ':' + app.clientSecret).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({grant_type: 'client_credentials', scope: 'applications.commands.update'}),
});
assert.ok(auth.ok, 'Test App authorization returned HTTP ' + auth.status);
const {access_token: token} = await auth.json();
const endpoint = base + '/applications/' + id + '/guilds/' + guild + '/commands';
const headers = {Authorization: 'Bearer ' + token};
const current = await fetch(endpoint, {headers, redirect: 'error', signal: AbortSignal.timeout(15000)});
assert.ok(current.ok, 'Test command listing returned HTTP ' + current.status);
const existing = (await current.json()).find(command => command.name === casinoPreviewCommand.name && command.type === casinoPreviewCommand.type);
const response = await fetch(existing ? endpoint + '/' + existing.id : endpoint, {
  method: existing ? 'PATCH' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: {...headers, 'Content-Type': 'application/json'},
  body: JSON.stringify(existing ? {options: casinoPreviewCommand.options} : casinoPreviewCommand),
});
assert.ok(response.ok, 'Test command registration returned HTTP ' + response.status);
const command = await response.json();
assert.deepEqual([command.application_id, command.guild_id, command.name], [id, guild, casinoPreviewCommand.name]);
if(existing)assert.equal(command.id, existing.id);
assert.deepEqual(command.options?.[0]?.choices?.map(({name,value})=>({name,value})), casinoPreviewCommand.options[0].choices);
console.log('已註冊測試伺服器專用 /' + command.name);
