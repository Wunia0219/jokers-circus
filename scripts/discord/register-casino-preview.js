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
const response = await fetch(base + '/applications/' + id + '/guilds/' + guild + '/commands', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
  body: JSON.stringify(casinoPreviewCommand),
});
assert.ok(response.ok, 'Test command registration returned HTTP ' + response.status);
const command = await response.json();
assert.deepEqual([command.application_id, command.guild_id, command.name], [id, guild, casinoPreviewCommand.name]);
console.log('已註冊測試伺服器專用 /' + command.name);
