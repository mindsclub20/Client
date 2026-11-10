import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const response = await fetch('/api/config', { cache: 'no-store' });
const config = await response.json().catch(() => ({}));
if (!response.ok || !config.url || !config.publishableKey) {
  throw new Error('MAXWEB client login is not configured. Check the Supabase environment settings.');
}

export const supabase = createClient(config.url, config.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
