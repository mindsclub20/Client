-- Additive: client demo request flag
alter table public.ai_conversations
  add column if not exists demo_requested_at timestamptz;

create index if not exists ai_conversations_demo_requested_idx
  on public.ai_conversations (demo_requested_at desc nulls last);
