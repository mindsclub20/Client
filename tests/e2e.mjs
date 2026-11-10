// Authenticated smoke test for the Supabase Auth + Neon application architecture.
// Usage: BASE_URL=https://maxweb-one.vercel.app SUPABASE_ACCESS_TOKEN=<test-user-access-token> node tests/e2e.mjs
// The access token is read from the environment and is never printed.
const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
if (!BASE || !TOKEN) {
  console.error('Set BASE_URL and SUPABASE_ACCESS_TOKEN for an authenticated smoke test.');
  process.exit(2);
}
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' -> ' + detail));
}
async function call(path, token) {
  const headers = { origin: BASE };
  if (token) headers.authorization = 'Bearer ' + token;
  const response = await fetch(BASE + path, { headers, redirect: 'manual', cache: 'no-store' });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
let result = await call('/api/config');
check('public Supabase client configuration is available', result.status === 200 && Boolean(result.data?.url && result.data?.publishableKey), result.status);
check('public config does not expose a secret key', result.data?.secretKey === undefined && result.data?.serviceRoleKey === undefined, 'unexpected secret field');
result = await call('/api/me');
check('unauthenticated identity request is rejected', result.status === 401, result.status);
result = await call('/api/me', 'invalid-token-for-smoke-test');
check('invalid bearer token is rejected', result.status === 401, result.status);
result = await call('/api/me', TOKEN);
check('Supabase access token resolves a MAXWEB identity', result.status === 200 && Boolean(result.data?.user?.id && result.data?.profile?.role), result.status);
if (result.status === 200) {
  const portal = await call('/api/portal/projects', TOKEN);
  check('authenticated client portal API responds', portal.status === 200, portal.status);
}
const failed = results.filter((item) => !item.ok).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed.');
process.exit(failed ? 1 : 0);
