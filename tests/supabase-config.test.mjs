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
