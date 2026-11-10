import { createClient } from '@supabase/supabase-js';

let authClient;

async function getAuthClient() {
  if (authClient) return authClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_AUTH_NOT_CONFIGURED');
  const { createClient } = await import('@supabase/supabase-js');
  const { createClient } = await import('@supabase/supabase-js');
  authClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'maxweb-server-auth' } },
  });
  return authClient;
}

export function extractBearerToken(request) {
  const value = request?.headers?.get?.('authorization') || '';
  const match = value.match(/^Bearer\s+(\S{20,8192})$/i);
  return match ? match[1] : null;
}

export function normalizeSupabaseUser(value) {
  if (!value || typeof value.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
      typeof value.email !== 'string' || !value.email.includes('@')) return null;
  const metadata = value.user_metadata && typeof value.user_metadata === 'object'
    ? value.user_metadata : {};
  return {
    id: value.id,
    email: value.email.trim().toLowerCase(),
    name: typeof metadata.full_name === 'string' ? metadata.full_name.trim().slice(0, 120) : '',
    emailVerified: Boolean(value.email_confirmed_at || value.confirmed_at),
  };
}

export async function getSupabaseUser(request) {
  const token = extractBearerToken(request);
  if (!token) return null;
  const { data, error } = await (await getAuthClient()).auth.getUser(token);
  if (error) return null;
  return normalizeSupabaseUser(data?.user);
}
