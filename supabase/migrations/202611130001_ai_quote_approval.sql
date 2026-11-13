-- MAXWEB quote approval lifecycle.
-- Apply only after reviewing this migration; it is additive and does not alter existing rows.

create table if not exists public.ai_quotes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  proposed_price integer not null check (proposed_price between 7000 and 15000),
  scope_summary text not null default 'Website consultation',
  status text not null default 'pending_admin'
    check (status in ('pending_admin', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_accepted_at timestamptz not null default now(),
  admin_approved_at timestamptz,
  admin_approved_by uuid references auth.users(id)
);

create index if not exists ai_quotes_user_created_idx
  on public.ai_quotes (user_id, created_at desc);
create index if not exists ai_quotes_status_created_idx
  on public.ai_quotes (status, created_at desc);
create unique index if not exists ai_quotes_one_open_or_approved_per_conversation
  on public.ai_quotes (conversation_id)
  where status in ('pending_admin', 'approved');

alter table public.ai_quotes enable row level security;

drop policy if exists "Users can view own quotes" on public.ai_quotes;
create policy "Users can view own quotes"
  on public.ai_quotes for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all quotes" on public.ai_quotes;
create policy "Admins can view all quotes"
  on public.ai_quotes for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update quotes" on public.ai_quotes;
create policy "Admins can update quotes"
  on public.ai_quotes for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select, update on public.ai_quotes to authenticated;

create or replace function public.submit_ai_quote(p_conversation_id uuid)
returns public.ai_quotes
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conversation public.ai_conversations%rowtype;
  v_quote public.ai_quotes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select * into v_conversation
  from public.ai_conversations
  where id = p_conversation_id
    and user_id = auth.uid()
    and status = 'active'
  for update;

  if not found then
    raise exception 'conversation_not_found_or_closed';
  end if;

  if v_conversation.current_price < v_conversation.minimum_price
     or v_conversation.current_price > 15000 then
    raise exception 'quote_price_out_of_range';
  end if;

  if exists (
    select 1 from public.ai_quotes
    where conversation_id = p_conversation_id
      and status in ('pending_admin', 'approved')
  ) then
    raise exception 'quote_already_submitted';
  end if;

  insert into public.ai_quotes (
    conversation_id, user_id, proposed_price, scope_summary, status
  ) values (
    v_conversation.id,
    v_conversation.user_id,
    v_conversation.current_price,
    coalesce(nullif(v_conversation.summary, ''), 'Website consultation'),
    'pending_admin'
  )
  returning * into v_quote;

  return v_quote;
end;
$$;

create or replace function public.admin_approve_ai_quote(p_quote_id uuid)
returns public.ai_quotes
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_quote public.ai_quotes%rowtype;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'forbidden';
  end if;

  select * into v_quote
  from public.ai_quotes
  where id = p_quote_id
    and status = 'pending_admin'
  for update;

  if not found then
    raise exception 'pending_quote_not_found';
  end if;

  update public.ai_quotes
  set status = 'approved',
      admin_approved_at = now(),
      admin_approved_by = auth.uid(),
      updated_at = now()
  where id = v_quote.id
  returning * into v_quote;

  update public.ai_conversations
  set agreed_price = v_quote.proposed_price,
      updated_at = now()
  where id = v_quote.conversation_id;

  return v_quote;
end;
$$;

revoke all on function public.submit_ai_quote(uuid) from public;
revoke all on function public.admin_approve_ai_quote(uuid) from public;
grant execute on function public.submit_ai_quote(uuid) to authenticated;
grant execute on function public.admin_approve_ai_quote(uuid) to authenticated;
