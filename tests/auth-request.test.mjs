import test from 'node:test';
import assert from 'node:assert/strict';
import { routeAuthRequest } from '../lib/auth-request.js';

test('maps rewritten POST requests back to the original Better Auth path and preserves body', async () => {
  const request = new Request('https://maxweb-one.vercel.app/api/auth?path=sign-up/email&callbackURL=%2Fportal', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://maxweb-one.vercel.app' },
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'test-only-password' }),
  });
  const routed = routeAuthRequest(request);
  assert.equal(routed.url, 'https://maxweb-one.vercel.app/api/auth/sign-up/email?callbackURL=%2Fportal');
  assert.equal(routed.method, 'POST');
  assert.equal(routed.headers.get('origin'), 'https://maxweb-one.vercel.app');
  assert.deepEqual(await routed.json(), { name: 'Test User', email: 'test@example.com', password: 'test-only-password' });
});

test('preserves query parameters for GET auth routes', async () => {
  const request = new Request('https://maxweb-one.vercel.app/api/auth?path=get-session&foo=bar');
  const routed = routeAuthRequest(request);
  assert.equal(routed.url, 'https://maxweb-one.vercel.app/api/auth/get-session?foo=bar');
});

test('rejects empty or traversal paths', () => {
  assert.equal(routeAuthRequest(new Request('https://maxweb-one.vercel.app/api/auth?path=')).status, 400);
  assert.equal(routeAuthRequest(new Request('https://maxweb-one.vercel.app/api/auth?path=..%2Fme')).status, 400);
});
