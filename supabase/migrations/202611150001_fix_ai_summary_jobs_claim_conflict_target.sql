-- Resolve PL/pgSQL ambiguity between the RETURNS TABLE output variable
-- conversation_id and the INSERT ... ON CONFLICT target.
-- The live table's primary key constraint was verified as ai_summary_jobs_pkey.
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
  -- Upsert every currently stale conversation so older unsummarized
  -- conversations cannot be starved by a fixed newest-N window.
  insert into public.ai_summary_jobs (conversation_id, source_updated_at)
  select c.id, c.updated_at
  from public.ai_conversations c
  where c.summary is null
     or c.summary_generated_at is null
     or c.updated_at > c.summary_generated_at
  on conflict on constraint ai_summary_jobs_pkey do update
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
    limit greatest(1, least(coalesce(p_limit, 3), 10))
    for update of j skip locked
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

revoke all on function public.claim_ai_summary_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_summary_jobs(integer, integer) to service_role;
