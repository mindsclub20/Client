import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, normalizeSupabaseUser } from '../lib/supabase-auth.js';

test('accepts a well-formed bearer token', () => { // Supabase access tokens are passed only as Bearer credentials.
  assert.equal(extractBearerToken(new Request('https://maxweb.example/api/me', {
    headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' },
  })), 'eyJhbGciOiJIUzI1NiJ9.payload.signature');
});

test('rejects missing, malformed, or non-bearer authorization', () => {
  assert.equal(extractBearerToken(new Request('https://maxweb.example/api/me')), null);
  assert.equal(extractBearerToken(new Request('https://maxweb.example/api/me', {
    headers: { authorization: 'Basic abc' },
  })), null);
  assert.equal(extractBearerToken(new Request('https://maxweb.example/api/me', {
    headers: { authorization: 'Bearer ' },
  })), null);
});

test('normalizes Supabase identity without trusting client metadata for roles', () => {
  const user = normalizeSupabaseUser({
    id: '0c7d4f56-6e85-4d6d-9a9a-a6b3f2d81b10',
    email: 'client@example.com',
    email_confirmed_at: '2026-11-10T00:00:00Z',
    user_metadata: { full_name: 'Client', role: 'super_admin' },
  });
  assert.equal(user.id, '0c7d4f56-6e85-4d6d-9a9a-a6b3f2d81b10');
  assert.equal(user.name, 'Client');
  assert.equal(user.emailVerified, true);
  assert.equal(user.role, undefined);
});

test('rejects identities without a stable id or email', () => {
  assert.equal(normalizeSupabaseUser({ id: 'abc' }), null);
  assert.equal(normalizeSupabaseUser({ email: 'a@example.com' }), null);
});

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('dashboard pages load shared and page scripts as ordered ES modules', async () => {
  const pages = ['admin.html', 'portal.html', 'accept-invite.html', 'setup-admin.html'];
  for (const page of pages) {
    const html = await readFile(resolve(root, page), 'utf8');
    assert.match(html, /<script type="module" src="\/js\/dashboard-common\.js"><\/script>/, page + ' must load dashboard-common as a module');
    assert.match(html, /<script type="module" src="\/js\/(?:admin|portal|accept-invite|setup-admin)\.js"><\/script>/, page + ' must load its page script as a module');
  }
});

test('fresh Neon migrations do not depend on the Better Auth user table', async () => {
  for (const file of ['db-migration-001.sql', 'db-migration-002.sql', 'db-migration-003-first-two-admins.sql']) {
    const sql = await readFile(resolve(root, file), 'utf8');
    assert.doesNotMatch(sql, /REFERENCES\s+public\."user"/i, file + ' must not create cross-provider account foreign keys');
  }
  const compatibility = await readFile(resolve(root, 'db-migration-004-supabase-auth.sql'), 'utf8');
  assert.match(compatibility, /CREATE VIEW public\."user"/i);
  assert.match(compatibility, /FROM public\.maxweb_profiles/i);
});


test('admin and portal modules wait for the shared auth client before using dashboard helpers', async () => {
  for (const file of ['js/admin.js', 'js/portal.js', 'js/accept-invite.js', 'js/setup-admin.js']) {
    const source = await readFile(resolve(root, file), 'utf8');
    assert.match(source, /^import ['"]\.\/dashboard-common\.js['"];?/, file + ' must import dashboard-common as a module dependency');
  }
});

import { isInitialSuperAdminEmail } from '../lib/admin-provisioning.js';

test('only the configured initial Super Admin email is eligible for bootstrap', () => {
  assert.equal(isInitialSuperAdminEmail('maxweb.w@gmail.com'), true);
  assert.equal(isInitialSuperAdminEmail('MAXWEB.W@GMAIL.COM'), true);
  assert.equal(isInitialSuperAdminEmail('another@example.com'), false);
  assert.equal(isInitialSuperAdminEmail(''), false);
  assert.equal(isInitialSuperAdminEmail(null), false);
});
