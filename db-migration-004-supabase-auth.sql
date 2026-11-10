-- MAXWEB account-provider boundary for a fresh Neon database.
-- Supabase Auth owns identities and credentials. Neon stores business profiles
-- and roles, keyed by the Supabase Auth UUID as text.
ALTER TABLE public.maxweb_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Existing admin queries use this read-only compatibility view to join
-- account IDs to their business-facing name/email fields.
CREATE VIEW public."user" AS
SELECT user_id AS id, COALESCE(full_name, '') AS name, email
FROM public.maxweb_profiles;
