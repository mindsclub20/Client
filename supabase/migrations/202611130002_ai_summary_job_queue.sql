-- Durable queue and atomic leases for MAXWEB scheduled AI conversation summaries.
-- Apply this migration to the MAXWEB Supabase project before deploying the matching route.

create table if not exists public.ai_summary_jobs (
  conversation_id uuid primary key
    references public.ai_conversations(id) on delete cascade,
  source_updated_at timestamptz not null,
  claim_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_summary_jobs_ready_idx
  on public.ai_summary_jobs (next_attempt_at, lease_until, created_at);

alter table public.ai_summary_jobs enable row level security;
revoke all on public.ai_summary_jobs from anon, authenticated;
grant all on public.ai_summary_jobs to service_role;

create or replace function public.claim_ai_summary_jobs(
  p_limit integer default 3,
  p_lease_seconds integer default 180
)
returns table (
  conversation_id uuid,
  source_updated_at timestamptz,
  claim_token uuid,
  conversation_data jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Upsert every currently stale conversation. This prevents a fixed newest-N
  -- window from starving older unsummarized conversations.
  insert into public.ai_summary_jobs (conversation_id, source_updated_at)
  select c.id, c.updated_at
  from public.ai_conversations c
  where c.summary is null
     or c.summary_generated_at is null
     or c.updated_at > c.summary_generated_at
  on conflict (conversation_id) do update
    set source_updated_at = excluded.source_updated_at,
        attempts = 0,
        next_attempt_at = now(),
        completed_at = null,
        last_error = null,
        updated_at = now()
    where public.ai_summary_jobs.source_updated_at is distinct from excluded.source_updated_at
      and (public.ai_summary_jobs.lease_until is null
           or public.ai_summary_jobs.lease_until <= now());

  return query
  with eligible as (
    select j.conversation_id
    from public.ai_summary_jobs j
    join public.ai_conversations c on c.id = j.conversation_id
    where j.next_attempt_at <= now()
      and (j.lease_until is null or j.lease_until <= now())
      and j.source_updated_at = c.updated_at
      and (
        c.summary is null
        or c.summary_generated_at is null
        or c.updated_at > c.summary_generated_at
      )
    order by c.summary_generated_at asc nulls first, c.updated_at asc
    for update of j skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  ),
  claimed as (
    update public.ai_summary_jobs j
    set claim_token = gen_random_uuid(),
        lease_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 180), 900))),
        attempts = j.attempts + 1,
        updated_at = now()
    from eligible e
    where j.conversation_id = e.conversation_id
    returning j.conversation_id, j.source_updated_at, j.claim_token
  )
  select cl.conversation_id, cl.source_updated_at, cl.claim_token,
         jsonb_build_object(
           'website_type', c.website_type,
           'current_price', c.current_price,
           'status', c.status
         )
  from claimed cl
  join public.ai_conversations c on c.id = cl.conversation_id;
end;
$$;

create or replace function public.finish_ai_summary_job(
  p_conversation_id uuid,
  p_source_updated_at timestamptz,
  p_claim_token uuid,
  p_summary text default null,
  p_error text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
  v_rows integer;
  v_current_updated_at timestamptz;
begin
  select j.attempts into v_attempts
  from public.ai_summary_jobs j
  where j.conversation_id = p_conversation_id
    and j.claim_token = p_claim_token
    and j.source_updated_at = p_source_updated_at
    and j.lease_until > now()
  for update;

  if not found then
    return 'lease_lost';
  end if;

  if p_error is null and nullif(trim(p_summary), '') is not null then
    update public.ai_conversations c
    set summary = left(trim(p_summary), 800),
        summary_generated_at = now()
    where c.id = p_conversation_id
      and c.updated_at = p_source_updated_at
      and (
        c.summary_generated_at is null
        or c.summary_generated_at < p_source_updated_at
      );
    get diagnostics v_rows = row_count;

    if v_rows = 1 then
      update public.ai_summary_jobs
      set claim_token = null, lease_until = null, completed_at = now(),
          last_error = null, next_attempt_at = now(), updated_at = now()
      where conversation_id = p_conversation_id;
      return 'completed';
    end if;

    -- The conversation changed while Gemini was generating the summary.
    select c.updated_at into v_current_updated_at
    from public.ai_conversations c where c.id = p_conversation_id;

    update public.ai_summary_jobs
    set source_updated_at = coalesce(v_current_updated_at, p_source_updated_at),
        claim_token = null, lease_until = null, attempts = 0,
        next_attempt_at = now(), completed_at = null,
        last_error = 'conversation_changed_during_summary', updated_at = now()
    where conversation_id = p_conversation_id;
    return 'stale_snapshot';
  end if;

  update public.ai_summary_jobs
  set claim_token = null,
      lease_until = null,
      next_attempt_at = now() + make_interval(
        secs => least(3600, (60 * power(2, least(greatest(v_attempts - 1, 0), 6)))::integer)
      ),
      last_error = left(coalesce(p_error, 'empty_summary'), 500),
      updated_at = now()
  where conversation_id = p_conversation_id;

  return 'retry_scheduled';
end;
$$;

revoke all on function public.claim_ai_summary_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.finish_ai_summary_job(uuid, timestamptz, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_ai_summary_jobs(integer, integer) to service_role;
grant execute on function public.finish_ai_summary_job(uuid, timestamptz, uuid, text, text) to service_role;
