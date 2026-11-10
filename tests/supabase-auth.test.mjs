import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, normalizeSupabaseUser } from '../lib/supabase-auth.js';

test('accepts a well-formed bearer token', () => {
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
