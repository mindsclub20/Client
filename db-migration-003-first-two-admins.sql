-- MAXWEB: first-two-verified-account admin slots.
-- user_id stores Supabase Auth UUIDs; authorization remains in Neon.
-- Apply before deploying the code that claims these slots.
CREATE TABLE IF NOT EXISTS public.maxweb_admin_slots (
  slot smallint PRIMARY KEY CHECK (slot IN (1, 2)),
  user_id text NOT NULL UNIQUE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

-- Remove previously hardcoded administrator assignments so the two slots
-- are allocated afresh under the new first-two-verified-accounts rule.
UPDATE public.maxweb_profiles
SET role = 'client', updated_at = now()
WHERE role IN ('admin', 'super_admin');
