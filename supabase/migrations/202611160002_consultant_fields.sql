-- Applied on MAXWEB: preferred_language, contact fields, answers, requirement_report
alter table public.ai_conversations
  add column if not exists preferred_language text default 'en',
  add column if not exists customer_name text,
  add column if not exists business_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists answers jsonb default '{}'::jsonb,
  add column if not exists requirement_report jsonb;
