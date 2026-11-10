import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../api/config.js';

const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

test('Supabase config endpoint returns only the public URL and publishable key', async () => {
  process.env.SUPABASE_URL = 'https://example-ref.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_value';
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.url, 'https://example-ref.supabase.co');
  assert.equal(body.publishableKey, 'sb_publishable_test_value');
  assert.equal(Object.hasOwn(body, 'serviceRoleKey'), false);
});

test('Supabase config endpoint rejects non-Supabase URLs', async () => {
  process.env.SUPABASE_URL = 'https://example.com';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_value';
  const response = await GET();
  assert.equal(response.status, 503);
});

test('Supabase config endpoint fails closed when configuration is missing', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  const response = await GET();
  assert.equal(response.status, 503);
});

test.after(() => {
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
});

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('client auth keeps the existing Better Auth sign-in path available for administrators', async () => {
  const authUi = await readFile(resolve(root, 'js/auth.js'), 'utf8');
  const authRoute = await readFile(resolve(root, 'api/auth.js'), 'utf8');
  const adminPage = await readFile(resolve(root, 'admin.html'), 'utf8');
  assert.match(authUi, /legacyApi\("\/sign-in\/email"/);
  assert.match(authUi, /role === "admin" \|\| user\.role === "super_admin"/);
  assert.match(authRoute, /auth\.handler/);
  assert.match(adminPage, /js\/admin\.js/);
});

test('new client account pages use Supabase without modifying admin page wiring', async () => {
  const account = await readFile(resolve(root, 'client.html'), 'utf8');
  const accountScript = await readFile(resolve(root, 'js/client-account.js'), 'utf8');
  const clientReset = await readFile(resolve(root, 'client-reset-password.html'), 'utf8');
  assert.match(account, /js\/client-account\.js/);
  assert.match(accountScript, /supabase\.auth\.getSession/);
  assert.match(accountScript, /supabase\.auth\.signOut/);
  assert.match(clientReset, /js\/client-reset-password\.js/);
});
