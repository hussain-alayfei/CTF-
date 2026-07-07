-- ============================================================
--  KGSP CTF — full database schema (safe to commit; no flags)
--  Apply this to a fresh Supabase project, then run seed.sql
--  (build your own from seed.example.sql) to load challenges.
--
--  Identity model: no Supabase Auth. Each player gets a random
--  secret token at registration. All mutations go through
--  SECURITY DEFINER functions that verify the token. Reads of
--  public data go through RLS policies open to the anon role.
--  Flags & hints live in tables with NO select policy => the
--  anon/authenticated roles can never read them.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABLES ----------
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  username    text not null unique,
  token       uuid not null default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  constraint username_len check (char_length(username) between 2 and 24)
);

create table if not exists public.challenges (
  id                text primary key,
  title             text not null,
  category          text not null,
  difficulty        text not null check (difficulty in ('easy','medium','hard')),
  points            int  not null,
  first_blood_bonus int  not null default 50,
  sort_order        int  not null,
  prompt            text not null,
  asset_url         text,
  action_url        text,
  num_hints         int  not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists public.challenge_flags (
  challenge_id text primary key references public.challenges(id) on delete cascade,
  flag         text not null
);

create table if not exists public.challenge_hints (
  challenge_id text not null references public.challenges(id) on delete cascade,
  hint_number  int  not null,
  body         text not null,
  penalty      int  not null default 25,
  primary key (challenge_id, hint_number)
);

create table if not exists public.solves (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  challenge_id   text not null references public.challenges(id) on delete cascade,
  points_awarded int  not null,
  is_first_blood boolean not null default false,
  solved_at      timestamptz not null default now(),
  unique (player_id, challenge_id)
);

create table if not exists public.hint_unlocks (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  hint_number  int  not null,
  penalty      int  not null default 0,
  unlocked_at  timestamptz not null default now(),
  unique (player_id, challenge_id, hint_number)
);

create table if not exists public.submission_attempts (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  challenge_id text not null,
  correct      boolean not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_attempts_player_time
  on public.submission_attempts (player_id, created_at desc);

create table if not exists public.event_config (
  id               int primary key default 1 check (id = 1),
  name             text not null default 'KGSP CTF',
  starts_at        timestamptz,
  ends_at          timestamptz,
  duration_minutes int  not null default 60,
  updated_at       timestamptz not null default now()
);
insert into public.event_config (id) values (1) on conflict do nothing;

create table if not exists public.admin_config (
  id     int primary key default 1 check (id = 1),
  secret text not null
);
-- Set your own admin secret:
-- insert into public.admin_config (id, secret) values (1, 'change-me') on conflict do nothing;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.players             enable row level security;
alter table public.challenges          enable row level security;
alter table public.challenge_flags     enable row level security;
alter table public.challenge_hints     enable row level security;
alter table public.solves              enable row level security;
alter table public.hint_unlocks        enable row level security;
alter table public.submission_attempts enable row level security;
alter table public.event_config        enable row level security;
alter table public.admin_config        enable row level security;

drop policy if exists sel_players on public.players;
create policy sel_players      on public.players      for select to anon, authenticated using (true);
drop policy if exists sel_challenges on public.challenges;
create policy sel_challenges   on public.challenges   for select to anon, authenticated using (true);
drop policy if exists sel_solves on public.solves;
create policy sel_solves       on public.solves       for select to anon, authenticated using (true);
drop policy if exists sel_hint_unlocks on public.hint_unlocks;
create policy sel_hint_unlocks on public.hint_unlocks for select to anon, authenticated using (true);
drop policy if exists sel_event on public.event_config;
create policy sel_event        on public.event_config for select to anon, authenticated using (true);
-- challenge_flags, challenge_hints, submission_attempts, admin_config:
-- RLS enabled + NO policy => invisible to clients. Only the functions below read them.

revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke select on public.players from anon, authenticated;
grant  select (id, username, created_at) on public.players to anon, authenticated;

-- ---------- RPC FUNCTIONS (the only way clients mutate state) ----------
create or replace function public._verify_player(p_player_id uuid, p_token uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.players where id = p_player_id and token = p_token);
$$;

create or replace function public.register_player(p_username text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text := btrim(p_username); v_id uuid; v_tok uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    return jsonb_build_object('error','bad_username','message','Name must be 2–24 characters.');
  end if;
  if v_name !~ '^[A-Za-z0-9 _\-]+$' then
    return jsonb_build_object('error','bad_username','message','Letters, numbers, spaces, _ and - only.');
  end if;
  begin
    insert into public.players (username) values (v_name) returning id, token into v_id, v_tok;
  exception when unique_violation then
    return jsonb_build_object('error','username_taken','message','That name is already taken — pick another.');
  end;
  return jsonb_build_object('player_id', v_id, 'token', v_tok, 'username', v_name);
end; $$;

create or replace function public.submit_flag(p_player_id uuid, p_token uuid, p_challenge_id text, p_flag text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_starts timestamptz; v_ends timestamptz; v_recent int; v_flag text;
  v_points int; v_bonus int; v_correct boolean; v_first boolean;
  v_penalty int; v_awarded int; v_existing int; v_total int; v_ins int;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error','auth','message','Session invalid — please register again.');
  end if;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('error','not_started','message','The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('error','ended','message','Time is up — the event has ended.');
  end if;
  select count(*) into v_recent from public.submission_attempts
   where player_id = p_player_id and created_at > now() - interval '8 seconds';
  if v_recent >= 6 then
    return jsonb_build_object('error','rate_limited','message','Too fast! Wait a moment and try again.');
  end if;
  perform pg_advisory_xact_lock(hashtext(p_challenge_id));
  select flag into v_flag from public.challenge_flags where challenge_id = p_challenge_id;
  if v_flag is null then return jsonb_build_object('error','no_challenge','message','Unknown challenge.'); end if;
  v_correct := lower(btrim(p_flag)) = lower(btrim(v_flag));
  insert into public.submission_attempts (player_id, challenge_id, correct) values (p_player_id, p_challenge_id, v_correct);
  if not v_correct then
    return jsonb_build_object('correct', false, 'message','Not quite — check your work and try again.');
  end if;
  select points_awarded into v_existing from public.solves where player_id = p_player_id and challenge_id = p_challenge_id;
  if v_existing is not null then
    return jsonb_build_object('correct', true, 'already_solved', true, 'points_awarded', v_existing,
      'message','You already solved this one ✅');
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
    'message', case when v_first then '🩸 FIRST BLOOD! +'||v_awarded||' points'
                    else 'Correct! +'||v_awarded||' points' end);
end; $$;

create or replace function public.unlock_hint(p_player_id uuid, p_token uuid, p_challenge_id text, p_hint_number int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_body text; v_pen int; v_starts timestamptz; v_ends timestamptz; v_ins int;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error','auth','message','Session invalid — please register again.');
  end if;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('error','not_started','message','The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('error','ended','message','Time is up — the event has ended.');
  end if;
  select body, penalty into v_body, v_pen from public.challenge_hints
   where challenge_id = p_challenge_id and hint_number = p_hint_number;
  if v_body is null then return jsonb_build_object('error','no_hint','message','No such hint.'); end if;
  insert into public.hint_unlocks (player_id, challenge_id, hint_number, penalty)
  values (p_player_id, p_challenge_id, p_hint_number, v_pen)
  on conflict (player_id, challenge_id, hint_number) do nothing;
  get diagnostics v_ins = row_count;
  return jsonb_build_object('body', v_body, 'penalty', v_pen, 'already_unlocked', (v_ins = 0),
    'message', case when v_ins = 0 then 'Hint (already unlocked)' else 'Hint unlocked (−'||v_pen||' pts on this challenge)' end);
end; $$;

create or replace function public.admin_start_event(p_secret text, p_minutes int default 60)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_s timestamptz; v_e timestamptz;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_minutes < 1 or p_minutes > 600 then p_minutes := 60; end if;
  update public.event_config set starts_at = now(), ends_at = now() + (p_minutes || ' minutes')::interval,
    duration_minutes = p_minutes, updated_at = now() where id = 1 returning starts_at, ends_at into v_s, v_e;
  return jsonb_build_object('starts_at', v_s, 'ends_at', v_e, 'duration_minutes', p_minutes);
end; $$;

create or replace function public.admin_stop_event(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.event_config set ends_at = now(), updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'message','Event stopped.');
end; $$;

create or replace function public.admin_reset(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  delete from public.submission_attempts;
  delete from public.hint_unlocks;
  delete from public.solves;
  update public.event_config set starts_at = null, ends_at = null, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'message','Game reset. Players kept, scores cleared.');
end; $$;

create or replace view public.leaderboard with (security_invoker = on) as
select p.id as player_id, p.username,
       coalesce(sum(s.points_awarded),0)::int as total_points,
       count(s.id)::int as solves_count,
       max(s.solved_at) as last_solve_at
from public.players p
left join public.solves s on s.player_id = p.id
group by p.id, p.username;

revoke all on function public._verify_player(uuid,uuid)                from public, anon, authenticated;
grant execute on function public.register_player(text)                 to anon, authenticated;
grant execute on function public.submit_flag(uuid,uuid,text,text)      to anon, authenticated;
grant execute on function public.unlock_hint(uuid,uuid,text,int)       to anon, authenticated;
grant execute on function public.admin_start_event(text,int)           to anon, authenticated;
grant execute on function public.admin_stop_event(text)                to anon, authenticated;
grant execute on function public.admin_reset(text)                     to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;

alter publication supabase_realtime add table public.solves;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.event_config;

-- ============================================================
--  v2 additions: multi-day roadmap, score freeze, admin dashboard
-- ============================================================

-- Each challenge belongs to a "day".
alter table public.challenges add column if not exists day int not null default 1;

-- Day roadmap (Day 1 open today, future days locked until unlocked).
create table if not exists public.days (
  day         int primary key,
  title       text not null,
  subtitle    text,
  is_open     boolean not null default false,
  event_label text,
  sort_order  int not null default 0
);
alter table public.days enable row level security;
drop policy if exists sel_days on public.days;
create policy sel_days on public.days for select to anon, authenticated using (true);

-- Score-freeze window (hide the leaderboard in the final N minutes).
alter table public.event_config add column if not exists freeze_minutes int not null default 15;

-- Only challenges on an OPEN day are visible to clients.
drop policy if exists sel_challenges on public.challenges;
create policy sel_challenges on public.challenges for select to anon, authenticated
using (exists (select 1 from public.days d where d.day = challenges.day and d.is_open));

-- NOTE: submit_flag also gains a "day must be open" check — see the app's
-- migration history. The definitive function body lives in the database.

-- Admin: full overview (returns flags + per-challenge stats + day status).
create or replace function public.admin_overview(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  return jsonb_build_object(
    'ok', true,
    'event', (select to_jsonb(e) from (
        select name, starts_at, ends_at, duration_minutes, freeze_minutes from public.event_config where id=1) e),
    'players_count', (select count(*) from public.players),
    'total_solves', (select count(*) from public.solves),
    'days', (select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order, d.day),'[]'::jsonb) from (
        select day, title, subtitle, is_open, event_label, sort_order from public.days) d),
    'challenges', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day, x.sort_order),'[]'::jsonb) from (
        select c.id, c.title, c.day, c.category, c.difficulty, c.points, c.first_blood_bonus,
               c.sort_order, c.num_hints, f.flag,
               (select count(*) from public.solves s where s.challenge_id = c.id) as solves_count,
               (select p.username from public.solves s join public.players p on p.id = s.player_id
                 where s.challenge_id = c.id and s.is_first_blood limit 1) as first_blood_by,
               (select coalesce(jsonb_agg(jsonb_build_object('n',h.hint_number,'body',h.body,'penalty',h.penalty)
                        order by h.hint_number),'[]'::jsonb)
                  from public.challenge_hints h where h.challenge_id = c.id) as hints
        from public.challenges c left join public.challenge_flags f on f.challenge_id = c.id) x)
  );
end; $$;

create or replace function public.admin_set_day(p_secret text, p_day int, p_is_open boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.days set is_open = p_is_open where day = p_day;
  return jsonb_build_object('ok', true, 'day', p_day, 'is_open', p_is_open);
end; $$;

create or replace function public.admin_set_freeze(p_secret text, p_minutes int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_minutes < 0 or p_minutes > 120 then p_minutes := 15; end if;
  update public.event_config set freeze_minutes = p_minutes, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'freeze_minutes', p_minutes);
end; $$;

grant execute on function public.admin_overview(text)            to anon, authenticated;
grant execute on function public.admin_set_day(text,int,boolean) to anon, authenticated;
grant execute on function public.admin_set_freeze(text,int)      to anon, authenticated;

alter publication supabase_realtime add table public.days;
