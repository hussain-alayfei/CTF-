-- Re-Identified (Danger) v2 — anon data moves fully server-side.
--
-- The root problem with v1: the anonymized patient table lived in reidentData.ts
-- which gets bundled → AI reads both tables from the page source, finds the
-- count-1 record in seconds, done. This migration replaces that with a
-- server-side query API: the data is embedded ONLY inside the RPC body, never
-- in any table the client can SELECT. The page now shows a query interface;
-- students must make API calls to explore the search space.
--
-- Per-player query log (rate limiting + hard cap). No client SELECT policy.
create table if not exists public.reident_query_log (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  queried_at timestamptz not null default now()
);
create index if not exists idx_reident_log_player_time
  on public.reident_query_log (player_id, queried_at desc);
alter table public.reident_query_log enable row level security;
-- No SELECT/INSERT policy → client can never read or write directly.

-- query_anon_db: the patient exploration tool.
-- Accepts optional demographic filters; returns only a count.
-- If count = 1 the server also reveals the anon_id and condition (the exposure).
-- Rate-limited (3 per 15 s) and hard-capped (40 total per player).
-- The patient VALUES live here only — never in any SELECT-able table.
create or replace function public.query_anon_db(
  p_player_id uuid,
  p_token     uuid,
  p_age       int  default null,
  p_zip       text default null,
  p_gender    text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_day int; v_recent int; v_total int;
  v_count int; v_anon_id text; v_condition text;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'auth', 'message', 'Session invalid — please log in again.');
  end if;
  select day into v_day from public.challenges where id = 'p5_reidentified';
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('ok', false, 'error', 'locked', 'message', 'Challenge is locked right now.');
  end if;

  -- Rate limit: max 3 queries per 15 seconds per player.
  select count(*) into v_recent
    from public.reident_query_log
   where player_id = p_player_id
     and queried_at > now() - interval '15 seconds';
  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate',
      'message', 'Too fast — wait a moment before querying again.');
  end if;

  -- Hard cap: 40 queries total per player per challenge run.
  select count(*) into v_total
    from public.reident_query_log
   where player_id = p_player_id;
  if v_total >= 40 then
    return jsonb_build_object('ok', false, 'error', 'budget',
      'message', 'Query budget exhausted (40/40). The answer is reachable in far fewer — think carefully.');
  end if;

  insert into public.reident_query_log (player_id) values (p_player_id);

  -- Anonymized dataset embedded here only — never shipped to clients.
  -- k-anonymity failure: A-7731 (age 29, zip 11215, F) is the sole record
  -- with that triple; every other patient shares their triple with at least one twin.
  with anon(anon_id, age, zip, gender, condition) as (
    values
      ('A-3300'::text, 34::int, '11201'::text, 'M'::text, 'Asthma'::text),
      ('A-3301', 34, '11201', 'M', 'Fractured wrist'),
      ('A-5012', 41, '11205', 'F', 'Migraine'),
      ('A-5013', 41, '11205', 'F', 'Hypertension'),
      ('A-6620', 27, '11201', 'F', 'Anxiety disorder'),
      ('A-6621', 27, '11201', 'F', 'Seasonal allergy'),
      ('A-7731', 29, '11215', 'F', 'HIV treatment'),
      ('A-8890', 52, '11205', 'M', 'Type 2 diabetes'),
      ('A-8891', 52, '11205', 'M', 'Back pain'),
      ('A-9002', 34, '11215', 'M', 'Sprained ankle'),
      ('A-9003', 34, '11215', 'M', 'Influenza'),
      ('A-1140', 45, '11201', 'F', 'Depression'),
      ('A-1141', 45, '11201', 'F', 'Thyroid disorder'),
      ('A-2205', 27, '11205', 'M', 'Concussion'),
      ('A-2206', 27, '11205', 'M', 'Broken nose')
  )
  select count(*),
         case when count(*) = 1 then min(anon_id) end,
         case when count(*) = 1 then min(condition) end
  into v_count, v_anon_id, v_condition
  from anon
  where (p_age    is null or age    = p_age)
    and (p_zip    is null or zip    = p_zip)
    and (p_gender is null or upper(gender) = upper(p_gender));

  if v_count = 1 then
    return jsonb_build_object(
      'ok', true, 'count', v_count,
      'anon_id', v_anon_id,
      'condition', v_condition,
      'remaining', 40 - v_total - 1);
  end if;
  return jsonb_build_object('ok', true, 'count', v_count, 'remaining', 40 - v_total - 1);
end; $$;

grant execute on function public.query_anon_db(uuid, uuid, int, text, text) to anon, authenticated;
