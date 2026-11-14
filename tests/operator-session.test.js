import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {serveOperatorSignIn,authorizeOperator} from '../cloud/operator-console.js';

for(const environment of ['production','test'])test(`${environment} dual-game operator retains same-origin remembered login`,async()=>{
  const origin=`https://${environment}.example`,key=randomBytes(32).toString('hex');
  const env={APP_ENV:environment,ARCADE_RELEASE_ENABLED:'true',ARCADE_CONSOLE_TOKEN:key};
  const request=(method,headers={})=>new Request(origin+'/__operator/sign-in',{method,headers});
  assert.equal(serveOperatorSignIn(request('POST',{Origin:'https://other.example',Authorization:'Bearer '+key}),env).status,403);
  assert.equal(serveOperatorSignIn(request('POST',{Origin:origin}),env).status,401);
  const login=serveOperatorSignIn(request('POST',{Origin:origin,Authorization:'Bearer '+key}),env);
  assert.equal(login.status,200);const cookie=login.headers.get('Set-Cookie');
  assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
  const {token}=await login.json();
  assert.equal(authorizeOperator(new Request(origin+'/__operator/status',{headers:{Authorization:'Bearer '+token}}),env),null);
  const remembered=serveOperatorSignIn(request('POST',{Origin:origin,Cookie:cookie.split(';')[0]}),env);
  assert.equal(remembered.status,200);
  const other={...env,ARCADE_CONSOLE_TOKEN:randomBytes(32).toString('hex')};
  assert.equal(serveOperatorSignIn(request('POST',{Origin:origin,Cookie:cookie.split(';')[0]}),other).status,401);
});
