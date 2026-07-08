-- Migration: admin/test-account exclusion + test-mode submit + score freeze back on
-- Applied to the live project on 2026-07-08. Safe/additive: no player rows or
-- solves are deleted. See supabase/schema.sql for the consolidated snapshot.

-- 1) Per-player exclusion flag (hide test/instructor accounts from the competition)
alter table public.players add column if not exists exclude_from_board boolean not null default false;

-- 2) All-time leaderboard view: also hide excluded accounts
create or replace view public.leaderboard with (security_invoker = on) as
 select p.id as player_id, p.username, p.avatar,
        coalesce(sum(s.points_awarded), 0)::integer as total_points,
        count(s.id)::integer as solves_count,
        max(s.solved_at) as last_solve_at
   from public.players p
   left join public.solves s on s.player_id = p.id
  where coalesce(p.is_admin, false) = false
    and coalesce(p.exclude_from_board, false) = false
  group by p.id, p.username, p.avatar;

-- 3) Day-scoped leaderboard: same exclusion
create or replace function public.day_leaderboard(p_day integer)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  with entrants as (
    select player_id from public.day_entries where day = p_day
    union
    select distinct s.player_id
      from public.solves s
      join public.challenges c on c.id = s.challenge_id
     where c.day = p_day
  )
  select coalesce(
    jsonb_agg(to_jsonb(x) order by x.total_points desc, x.last_solve_at asc nulls last, x.username asc),
    '[]'::jsonb)
  from (
    select p.id as player_id, p.username, p.avatar,
           coalesce(sum(s.points_awarded) filter (where c.day = p_day), 0)::int as total_points,
           count(s.id) filter (where c.day = p_day)::int as solves_count,
           max(s.solved_at) filter (where c.day = p_day) as last_solve_at
    from public.players p
    join entrants e on e.player_id = p.id
    left join public.solves s on s.player_id = p.id
    left join public.challenges c on c.id = s.challenge_id
    where coalesce(p.is_admin, false) = false
      and coalesce(p.exclude_from_board, false) = false
    group by p.id, p.username, p.avatar
  ) x;
$$;

-- 4) Admin roster exposes exclude_from_board so the dashboard can toggle it
create or replace function public.admin_list_players(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  return jsonb_build_object('ok', true, 'players', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.total_points desc, x.username), '[]'::jsonb) from (
      select p.id, p.username, coalesce(p.avatar,'🕵️') as avatar, p.created_at,
             coalesce(p.exclude_from_board,false) as exclude_from_board,
             (select coalesce(sum(s.points_awarded),0)::int from public.solves s where s.player_id = p.id) as total_points,
             (select count(*)::int from public.solves s where s.player_id = p.id) as solves_count,
             (select count(*)::int from public.solves s where s.player_id = p.id and s.is_first_blood) as first_bloods,
             (select coalesce(jsonb_agg(jsonb_build_object(
                        'challenge_id', s.challenge_id,
                        'points', s.points_awarded,
                        'first_blood', s.is_first_blood,
                        'solved_at', s.solved_at) order by s.solved_at), '[]'::jsonb)
                from public.solves s where s.player_id = p.id) as solves
      from public.players p where coalesce(p.is_admin,false) = false) x));
end; $$;

-- 5) Toggle exclusion (admin-gated)
create or replace function public.admin_set_player_excluded(p_secret text, p_player_id uuid, p_excluded boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.players set exclude_from_board = p_excluded where id = p_player_id;
  return jsonb_build_object('ok', true, 'exclude_from_board', p_excluded);
end; $$;
grant execute on function public.admin_set_player_excluded(text,uuid,boolean) to anon, authenticated;

-- 6) submit_flag: admin/excluded accounts verified but never scored (test mode)
create or replace function public.submit_flag(p_player_id uuid, p_token uuid, p_challenge_id text, p_flag text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_starts timestamptz; v_ends timestamptz; v_recent int; v_flag text; v_day int;
  v_points int; v_bonus int; v_correct boolean; v_first boolean;
  v_penalty int; v_awarded int; v_existing int; v_total int; v_ins int;
  v_is_dynamic boolean; v_secret text; v_excluded boolean;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error','auth','message','Session invalid - please register again.');
  end if;
  select coalesce(is_admin,false) or coalesce(exclude_from_board,false)
    into v_excluded from public.players where id = p_player_id;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('error','not_started','message','The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('error','ended','message','Time is up - the event has ended.');
  end if;
  select day, is_dynamic into v_day, v_is_dynamic from public.challenges where id = p_challenge_id;
  if v_day is null then return jsonb_build_object('error','no_challenge','message','Unknown challenge.'); end if;
  if not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error','locked','message','This challenge is locked right now.');
  end if;
  select count(*) into v_recent from public.submission_attempts
   where player_id = p_player_id and created_at > now() - interval '8 seconds';
  if v_recent >= 6 then
    return jsonb_build_object('error','rate_limited','message','Too fast! Wait a moment and try again.');
  end if;
  perform pg_advisory_xact_lock(hashtext(p_challenge_id));

  if v_is_dynamic then
    select secret into v_secret from public.challenge_answer_keys where challenge_id = p_challenge_id;
    if v_secret is null then return jsonb_build_object('error','no_challenge','message','Unknown challenge.'); end if;
    v_flag := 'KGSP{' || substr(encode(extensions.hmac(p_player_id::text, v_secret, 'sha256'), 'hex'), 1, 12) || '}';
  else
    select flag into v_flag from public.challenge_flags where challenge_id = p_challenge_id;
    if v_flag is null then return jsonb_build_object('error','no_challenge','message','Unknown challenge.'); end if;
  end if;

  v_correct := lower(btrim(p_flag)) = lower(btrim(v_flag));
  insert into public.submission_attempts (player_id, challenge_id, correct) values (p_player_id, p_challenge_id, v_correct);

  if coalesce(v_excluded, false) then
    return jsonb_build_object('correct', v_correct, 'test_mode', true,
      'message', case when v_correct then 'Correct - test mode (not scored).'
                      else 'Not quite - check your work and try again.' end);
  end if;

  if not v_correct then
    return jsonb_build_object('correct', false, 'message','Not quite - check your work and try again.');
  end if;
  select points_awarded into v_existing from public.solves where player_id = p_player_id and challenge_id = p_challenge_id;
  if v_existing is not null then
    return jsonb_build_object('correct', true, 'already_solved', true, 'points_awarded', v_existing,
      'message','You already solved this one');
  end if;
  select points, first_blood_bonus into v_points, v_bonus from public.challenges where id = p_challenge_id;
  v_first := not exists (select 1 from public.solves where challenge_id = p_challenge_id);
  select coalesce(sum(penalty),0) into v_penalty from public.hint_unlocks
   where player_id = p_player_id and challenge_id = p_challenge_id;
  v_awarded := greatest(v_points - v_penalty, 0) + (case when v_first then v_bonus else 0 end);
  insert into public.solves (player_id, challenge_id, points_awarded, is_first_blood)
  values (p_player_id, p_challenge_id, v_awarded, v_first)
  on conflict (player_id, challenge_id) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    select points_awarded into v_existing from public.solves where player_id = p_player_id and challenge_id = p_challenge_id;
    return jsonb_build_object('correct', true, 'already_solved', true, 'points_awarded', coalesce(v_existing,0));
  end if;
  select coalesce(sum(points_awarded),0) into v_total from public.solves where player_id = p_player_id;
  return jsonb_build_object('correct', true, 'first_blood', v_first, 'points_awarded', v_awarded,
    'total_points', v_total,
    'message', case when v_first then 'FIRST BLOOD! +'||v_awarded||' points'
                    else 'Correct! +'||v_awarded||' points' end);
end; $$;

-- 7) Turn the score freeze back on (final 15 minutes on the projector board)
update public.event_config set freeze_minutes = 15, updated_at = now() where id = 1;
