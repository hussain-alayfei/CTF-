-- ============================================================
--  KGSP / Meras CTF — full database schema (safe to commit; no flags)
--
--  This is an accurate reference snapshot of the LIVE Supabase project
--  (source of truth). Apply to a fresh project, then load challenge
--  content from your own seed.sql (see seed.example.sql). No flags,
--  answers, or hints live here.
--
--  Identity model: no Supabase Auth. Players register with
--  username + password (bcrypt via extensions.crypt) + emoji avatar and
--  get a random secret token. All mutations go through SECURITY DEFINER
--  RPCs that verify the token. The admin is a normal player row with
--  is_admin = true; login_player then also returns the admin_config
--  secret as admin_token. Secret tables (flags/answers/hints/codes) have
--  RLS enabled with NO select policy, so clients can never read them.
--
--  NOTE: pgcrypto lives in the `extensions` schema — functions that hash
--  or HMAC set search_path = public, extensions, pg_temp and call
--  extensions.crypt / extensions.gen_salt / extensions.hmac.
--
--  NOTE: pg-safeupdate is enabled on this project — any DELETE/UPDATE
--  without a WHERE is rejected even inside SECURITY DEFINER functions;
--  intentional full-table deletes use `where true`.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- TABLES ----------
create table if not exists public.players (
  id                 uuid primary key default gen_random_uuid(),
  username           text not null unique,
  token              uuid not null default gen_random_uuid(),
  password_hash      text,
  avatar             text not null default '🕵️',
  is_admin           boolean not null default false,
  exclude_from_board boolean not null default false,   -- hidden from competition (test/instructor accounts)
  created_at         timestamptz not null default now(),
  constraint username_len check (char_length(username) between 2 and 24)
);

create table if not exists public.challenges (
  id                text primary key,
  title             text not null,
  category          text not null,
  difficulty        text not null check (difficulty in ('easy','medium','hard','danger')),
  points            int  not null,
  first_blood_bonus int  not null default 50,
  sort_order        int  not null,
  prompt            text not null,
  asset_url         text,
  action_url        text,
  num_hints         int  not null default 0,
  day               int  not null default 1,
  is_extra          boolean not null default false,
  suggested_tool    text,               -- kept for admin reference; not shown to players
  is_dynamic        boolean not null default false,  -- true => per-player flag via challenge_answer_keys
  created_at        timestamptz not null default now()
);

-- Static flags (only for is_dynamic = false challenges). SECRET.
create table if not exists public.challenge_flags (
  challenge_id text primary key references public.challenges(id) on delete cascade,
  flag         text not null
);

-- Per-player dynamic challenges (is_dynamic = true). SECRET.
--  answer        = the value the player must recover & submit
--  secret        = random per-challenge HMAC seed (flag = KGSP{hmac(player_id, secret)[:12]})
--  live_material = optional decode key(s) shown ONLY on the logged-in page,
--                  never shipped in the downloadable artifact
create table if not exists public.challenge_answer_keys (
  challenge_id  text primary key references public.challenges(id) on delete cascade,
  answer        text not null,
  secret        text not null,
  live_material jsonb
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
  name             text not null default 'Meras CTF',
  starts_at        timestamptz,
  ends_at          timestamptz,
  duration_minutes int  not null default 35,
  freeze_minutes   int  not null default 15,   -- final-minutes score blackout on /board
  active_day       int,                         -- which day's leaderboard is "live"
  updated_at       timestamptz not null default now()
);
insert into public.event_config (id) values (1) on conflict do nothing;

create table if not exists public.admin_config (
  id            int primary key default 1 check (id = 1),
  secret        text not null,
  username      text,          -- legacy direct-admin login (admin_login); no longer used by the UI
  password_hash text
);

-- Day roadmap.
create table if not exists public.days (
  day           int primary key,
  title         text not null,
  subtitle      text,
  is_open       boolean not null default false,
  event_label   text,
  sort_order    int not null default 0,
  is_rest       boolean not null default false,
  requires_code boolean not null default false
);

-- Per-day access codes. SECRET (RLS, no select policy).
create table if not exists public.day_codes (
  day  int primary key,
  code text not null
);

-- Who entered (unlocked) each day — drives "real competitors" on the board.
create table if not exists public.day_entries (
  player_id  uuid not null references public.players(id) on delete cascade,
  day        int not null,
  entered_at timestamptz not null default now(),
  primary key (player_id, day)
);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.players             enable row level security;
alter table public.challenges          enable row level security;
alter table public.challenge_flags     enable row level security;
alter table public.challenge_answer_keys enable row level security;
alter table public.challenge_hints     enable row level security;
alter table public.solves              enable row level security;
alter table public.hint_unlocks        enable row level security;
alter table public.submission_attempts enable row level security;
alter table public.event_config        enable row level security;
alter table public.admin_config        enable row level security;
alter table public.days                enable row level security;
alter table public.day_codes           enable row level security;
alter table public.day_entries         enable row level security;

-- Public reads (rows). Column exposure on players is further restricted by grants below.
drop policy if exists sel_players on public.players;
create policy sel_players      on public.players      for select to anon, authenticated using (true);
drop policy if exists sel_solves on public.solves;
create policy sel_solves       on public.solves       for select to anon, authenticated using (true);
drop policy if exists sel_hint_unlocks on public.hint_unlocks;
create policy sel_hint_unlocks on public.hint_unlocks for select to anon, authenticated using (true);
drop policy if exists sel_event on public.event_config;
create policy sel_event        on public.event_config for select to anon, authenticated using (true);
drop policy if exists sel_days on public.days;
create policy sel_days         on public.days         for select to anon, authenticated using (true);
drop policy if exists sel_day_entries on public.day_entries;
create policy sel_day_entries  on public.day_entries  for select to anon, authenticated using (true);
-- Only challenges on an OPEN day are visible to clients.
drop policy if exists sel_challenges on public.challenges;
create policy sel_challenges   on public.challenges   for select to anon, authenticated
  using (exists (select 1 from public.days d where d.day = challenges.day and d.is_open));
-- challenge_flags, challenge_answer_keys, challenge_hints, submission_attempts,
-- admin_config, day_codes: RLS enabled + NO policy => invisible to clients.
-- Only the SECURITY DEFINER functions below read them.

-- ---------- GRANTS ----------
revoke insert, update, delete on all tables in schema public from anon, authenticated;
-- players: hide token & password_hash & exclude_from_board; expose only display columns.
revoke select on public.players from anon, authenticated;
grant  select (id, username, avatar, created_at, is_admin) on public.players to anon, authenticated;
grant  select on public.leaderboard to anon, authenticated;

-- ---------- VIEWS ----------
-- All-time leaderboard. Excludes admins AND excluded (test) accounts.
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

-- ---------- RPC FUNCTIONS (the only way clients mutate state) ----------

create or replace function public._verify_player(p_player_id uuid, p_token uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.players where id = p_player_id and token = p_token);
$$;

create or replace function public.register_player(p_username text, p_password text, p_avatar text default '🕵️')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_name text := btrim(p_username); v_av text := coalesce(nullif(btrim(p_avatar),''),'🕵️');
        v_id uuid; v_tok uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    return jsonb_build_object('error','bad_username','message','Name must be 2–24 characters.');
  end if;
  if v_name !~ '^[A-Za-z0-9 _\-]+$' then
    return jsonb_build_object('error','bad_username','message','Letters, numbers, spaces, _ and - only.');
  end if;
  if p_password is null or char_length(p_password) < 4 then
    return jsonb_build_object('error','bad_password','message','Password must be at least 4 characters.');
  end if;
  if char_length(v_av) > 12 then v_av := '🕵️'; end if;
  begin
    insert into public.players (username, password_hash, avatar)
    values (v_name, extensions.crypt(p_password, extensions.gen_salt('bf')), v_av)
    returning id, token into v_id, v_tok;
  exception when unique_violation then
    return jsonb_build_object('error','username_taken','message','That name is taken — pick another or log in.');
  end;
  return jsonb_build_object('player_id', v_id, 'token', v_tok, 'username', v_name, 'avatar', v_av);
end; $$;

create or replace function public.login_player(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_name text := btrim(p_username); r record; v_admin_token text;
begin
  select id, token, avatar, password_hash, is_admin into r from public.players where username = v_name;
  if r.id is null then
    return jsonb_build_object('error','no_user','message','No player with that name. Create a profile first.');
  end if;
  if r.password_hash is null or extensions.crypt(p_password, r.password_hash) <> r.password_hash then
    return jsonb_build_object('error','bad_password','message','Wrong password.');
  end if;
  if r.is_admin then
    select secret into v_admin_token from public.admin_config where id = 1;
  end if;
  return jsonb_build_object('player_id', r.id, 'token', r.token, 'username', v_name, 'avatar', r.avatar,
    'is_admin', coalesce(r.is_admin,false), 'admin_token', v_admin_token);
end; $$;

-- Legacy direct admin login (kept for compatibility; the UI uses login_player).
create or replace function public.admin_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  select username, password_hash, secret into r from public.admin_config where id = 1;
  if r.username is null or btrim(p_username) <> r.username then
    return jsonb_build_object('error','auth','message','Wrong admin username or password.');
  end if;
  if r.password_hash is null or extensions.crypt(p_password, r.password_hash) <> r.password_hash then
    return jsonb_build_object('error','auth','message','Wrong admin username or password.');
  end if;
  return jsonb_build_object('ok', true, 'token', r.secret, 'username', r.username);
end; $$;

create or replace function public.check_day_code(p_player_id uuid, p_token uuid, p_day integer, p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'error','auth','message','Session invalid — please log in again.');
  end if;
  select code into v_code from public.day_codes where day = p_day;
  if v_code is null or lower(btrim(p_code)) = lower(btrim(v_code)) then
    insert into public.day_entries (player_id, day) values (p_player_id, p_day)
      on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'message','Wrong code — ask your instructor.');
end; $$;

-- submit_flag: static (challenge_flags) or dynamic (per-player HMAC). Admin and
-- excluded (test) accounts are verified but NEVER recorded — no points, no first
-- blood, no live-feed entry.
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

  -- Admin / excluded accounts: verify but never score (test mode).
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

create or replace function public.unlock_hint(p_player_id uuid, p_token uuid, p_challenge_id text, p_hint_number integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_body text; v_pen int; v_starts timestamptz; v_ends timestamptz; v_ins int; v_solved boolean;
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
  select exists(select 1 from public.solves where player_id = p_player_id and challenge_id = p_challenge_id) into v_solved;
  if v_solved then
    return jsonb_build_object('body', v_body, 'penalty', 0, 'already_unlocked', true,
      'message','Free hint (you already solved this).');
  end if;
  insert into public.hint_unlocks (player_id, challenge_id, hint_number, penalty)
  values (p_player_id, p_challenge_id, p_hint_number, v_pen)
  on conflict (player_id, challenge_id, hint_number) do nothing;
  get diagnostics v_ins = row_count;
  return jsonb_build_object('body', v_body, 'penalty', v_pen, 'already_unlocked', (v_ins = 0),
    'message', case when v_ins = 0 then 'Hint (already unlocked)' else 'Hint unlocked (−'||v_pen||' pts on this challenge)' end);
end; $$;

-- Dynamic challenges: verify the recovered answer, mint a per-player flag. No points awarded here.
create or replace function public.verify_challenge_answer(p_player_id uuid, p_token uuid, p_challenge_id text, p_answer text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_starts timestamptz; v_ends timestamptz; v_day int; v_recent int;
  v_answer text; v_secret text; v_flag text; v_correct boolean;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'message', 'Session invalid — please register again.');
  end if;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('ok', false, 'message', 'The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('ok', false, 'message', 'Time is up — the event has ended.');
  end if;
  select day into v_day from public.challenges where id = p_challenge_id;
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('ok', false, 'message', 'This challenge is locked right now.');
  end if;
  select count(*) into v_recent from public.submission_attempts
   where player_id = p_player_id and created_at > now() - interval '8 seconds';
  if v_recent >= 6 then
    return jsonb_build_object('ok', false, 'message', 'Too fast! Wait a moment and try again.');
  end if;
  select answer, secret into v_answer, v_secret
    from public.challenge_answer_keys where challenge_id = p_challenge_id;
  if v_answer is null then
    return jsonb_build_object('ok', false, 'message', 'Unknown challenge.');
  end if;
  v_correct := lower(btrim(p_answer)) = lower(btrim(v_answer));
  insert into public.submission_attempts (player_id, challenge_id, correct) values (p_player_id, p_challenge_id, v_correct);
  if not v_correct then
    return jsonb_build_object('ok', false, 'message', 'Not quite — check your work and try again.');
  end if;
  v_flag := 'KGSP{' || substr(encode(extensions.hmac(p_player_id::text, v_secret, 'sha256'), 'hex'), 1, 12) || '}';
  return jsonb_build_object('ok', true, 'message', 'Correct — here is your personal flag. Paste it into the arena flag box.', 'flag', v_flag);
end; $$;

-- Withheld decode material for dynamic challenges (shown only on the logged-in page).
create or replace function public.challenge_live_material(p_player_id uuid, p_token uuid, p_challenge_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_day int; v_material jsonb;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error','auth','message','Session invalid — please register again.');
  end if;
  select day into v_day from public.challenges where id = p_challenge_id;
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error','locked','message','This challenge is locked right now.');
  end if;
  select live_material into v_material from public.challenge_answer_keys where challenge_id = p_challenge_id;
  return jsonb_build_object('ok', true, 'material', coalesce(v_material, '{}'::jsonb));
end; $$;

-- Day-scoped "live" leaderboard: entrants of the day only, admin/excluded hidden.
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

-- ---------- ADMIN RPCs (gated by admin_config.secret) ----------
create or replace function public.admin_start_event(p_secret text, p_minutes integer default 60)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_s timestamptz; v_e timestamptz;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_minutes < 1 or p_minutes > 600 then p_minutes := 60; end if;
  update public.event_config
     set starts_at = now(), ends_at = now() + (p_minutes || ' minutes')::interval,
         duration_minutes = p_minutes, updated_at = now()
   where id = 1
  returning starts_at, ends_at into v_s, v_e;
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

-- Reset clears scores/attempts/hints for ONE day (p_day) and the shared event
-- clock. Players are KEPT. Scoped by day on purpose — an earlier unscoped
-- `where true` version wiped every day's history at once whenever any day
-- was reset (a real incident: it erased Day 3 solves while "resetting" Day 4).
create or replace function public.admin_reset(p_secret text, p_day integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_day is null then
    return jsonb_build_object('error','no_day','message','No day specified — refusing to reset.');
  end if;
  delete from public.submission_attempts
   where challenge_id in (select id from public.challenges where day = p_day);
  delete from public.hint_unlocks
   where challenge_id in (select id from public.challenges where day = p_day);
  delete from public.solves
   where challenge_id in (select id from public.challenges where day = p_day);
  update public.event_config set starts_at = null, ends_at = null, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'message', 'Day ' || p_day || ' reset. Players kept, other days'' scores untouched.');
end; $$;

create or replace function public.admin_set_day(p_secret text, p_day integer, p_is_open boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.days set is_open = p_is_open where day = p_day;
  return jsonb_build_object('ok', true, 'day', p_day, 'is_open', p_is_open);
end; $$;

create or replace function public.admin_set_freeze(p_secret text, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_minutes < 0 or p_minutes > 120 then p_minutes := 15; end if;
  update public.event_config set freeze_minutes = p_minutes, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'freeze_minutes', p_minutes);
end; $$;

create or replace function public.admin_set_day_code(p_secret text, p_day integer, p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_clean text := btrim(coalesce(p_code,''));
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if v_clean = '' then
    delete from public.day_codes where day = p_day;
    update public.days set requires_code = false where day = p_day;
  else
    insert into public.day_codes(day, code) values (p_day, v_clean)
      on conflict (day) do update set code = excluded.code;
    update public.days set requires_code = true where day = p_day;
  end if;
  return jsonb_build_object('ok', true, 'day', p_day, 'code', v_clean);
end; $$;

create or replace function public.admin_set_active_day(p_secret text, p_day integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.event_config set active_day = p_day, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'active_day', p_day);
end; $$;

-- Hide/show a player from the competition (test/instructor accounts). Solves are kept.
create or replace function public.admin_set_player_excluded(p_secret text, p_player_id uuid, p_excluded boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.players set exclude_from_board = p_excluded where id = p_player_id;
  return jsonb_build_object('ok', true, 'exclude_from_board', p_excluded);
end; $$;

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

create or replace function public.admin_delete_player(p_secret text, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_del int;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  delete from public.players where id = p_player_id;
  get diagnostics v_del = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_del);
end; $$;

create or replace function public.admin_delete_all_players(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_del int;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  delete from public.submission_attempts where true;
  delete from public.hint_unlocks where true;
  delete from public.solves where true;
  delete from public.players where true;
  get diagnostics v_del = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_del, 'message', 'All players removed.');
end; $$;

create or replace function public.admin_overview(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  return jsonb_build_object(
    'ok', true,
    'event', (select to_jsonb(e) from (
        select name, starts_at, ends_at, duration_minutes, freeze_minutes, active_day from public.event_config where id=1) e),
    'players_count', (select count(*) from public.players where coalesce(is_admin,false) = false),
    'total_solves', (select count(*) from public.solves),
    'days', (select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order, d.day),'[]'::jsonb) from (
        select dd.day, dd.title, dd.subtitle, dd.is_open, dd.event_label, dd.sort_order,
               dd.is_rest, dd.requires_code, dc.code
        from public.days dd left join public.day_codes dc on dc.day = dd.day) d),
    'challenges', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day, x.sort_order),'[]'::jsonb) from (
        select c.id, c.title, c.day, c.category, c.difficulty, c.points, c.first_blood_bonus,
               c.sort_order, c.num_hints, c.prompt, c.asset_url, c.action_url, c.is_extra, c.suggested_tool,
               c.is_dynamic, coalesce(ak.answer, f.flag) as flag,
               (select count(*) from public.solves s where s.challenge_id = c.id) as solves_count,
               (select p.username from public.solves s join public.players p on p.id = s.player_id
                 where s.challenge_id = c.id and s.is_first_blood limit 1) as first_blood_by,
               (select coalesce(jsonb_agg(jsonb_build_object('n',h.hint_number,'body',h.body,'penalty',h.penalty)
                        order by h.hint_number),'[]'::jsonb)
                  from public.challenge_hints h where h.challenge_id = c.id) as hints
        from public.challenges c
        left join public.challenge_flags f on f.challenge_id = c.id
        left join public.challenge_answer_keys ak on ak.challenge_id = c.id) x)
  );
end; $$;

-- ---------- FUNCTION GRANTS ----------
revoke all on function public._verify_player(uuid,uuid) from public, anon, authenticated;
grant execute on function public.register_player(text,text,text)              to anon, authenticated;
grant execute on function public.login_player(text,text)                      to anon, authenticated;
grant execute on function public.admin_login(text,text)                       to anon, authenticated;
grant execute on function public.check_day_code(uuid,uuid,integer,text)       to anon, authenticated;
grant execute on function public.submit_flag(uuid,uuid,text,text)             to anon, authenticated;
grant execute on function public.unlock_hint(uuid,uuid,text,integer)          to anon, authenticated;
grant execute on function public.verify_challenge_answer(uuid,uuid,text,text) to anon, authenticated;
grant execute on function public.challenge_live_material(uuid,uuid,text)      to anon, authenticated;
grant execute on function public.day_leaderboard(integer)                     to anon, authenticated;
grant execute on function public.admin_start_event(text,integer)              to anon, authenticated;
grant execute on function public.admin_stop_event(text)                       to anon, authenticated;
grant execute on function public.admin_reset(text,integer)                    to anon, authenticated;
grant execute on function public.admin_set_day(text,integer,boolean)          to anon, authenticated;
grant execute on function public.admin_set_freeze(text,integer)               to anon, authenticated;
grant execute on function public.admin_set_day_code(text,integer,text)        to anon, authenticated;
grant execute on function public.admin_set_active_day(text,integer)           to anon, authenticated;
grant execute on function public.admin_set_player_excluded(text,uuid,boolean) to anon, authenticated;
grant execute on function public.admin_list_players(text)                     to anon, authenticated;
grant execute on function public.admin_delete_player(text,uuid)               to anon, authenticated;
grant execute on function public.admin_delete_all_players(text)               to anon, authenticated;
grant execute on function public.admin_overview(text)                         to anon, authenticated;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.solves;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.event_config;
alter publication supabase_realtime add table public.days;
alter publication supabase_realtime add table public.day_entries;
