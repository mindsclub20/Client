-- Allow AI conversations to belong to either Supabase Auth or verified Authgear identities.
-- Authgear subjects are mapped to stable UUIDv5 values and written only through
-- the server-side service-role client after validating the encrypted Authgear session.
alter table public.ai_conversations
  drop constraint if exists ai_conversations_user_id_fkey;

comment on column public.ai_conversations.user_id is
  'Stable user UUID: Supabase Auth user id or namespaced UUIDv5 for a verified Authgear subject. Authgear writes are server-only and ownership-filtered.';
