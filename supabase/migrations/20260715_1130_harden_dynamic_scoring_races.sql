-- Harden solve-order scoring after the Day 9 release.
--
-- 1. A previously scored player who is later hidden must not cause a solve
--    position to be reused. Test/admin submissions never create solve rows, so
--    every stored solve counts toward the immutable position.
-- 2. Hint unlock and correct submission share the same challenge lock. Whichever
--    commits first becomes authoritative: hint-first costs points; solve-first
--    makes the hint free.
--
-- No existing solve row is updated.

create or replace function public.unlock_hint(
  p_player_id uuid,
  p_token uuid,
  p_challenge_id text,
  p_hint_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_body text;
  v_pen integer;
  v_starts timestamptz;
  v_ends timestamptz;
  v_ins integer;
  v_solved boolean;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error', 'auth', 'message', 'Session invalid — please register again.');
  end if;
  select starts_at, ends_at into v_starts, v_ends
    from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('error', 'not_started', 'message', 'The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('error', 'ended', 'message', 'Time is up — the event has ended.');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_challenge_id));

  select body, penalty into v_body, v_pen
    from public.challenge_hints
   where challenge_id = p_challenge_id and hint_number = p_hint_number;
  if v_body is null then
    return jsonb_build_object('error', 'no_hint', 'message', 'No such hint.');
  end if;

  select exists(
    select 1 from public.solves
     where player_id = p_player_id and challenge_id = p_challenge_id
  ) into v_solved;
  if v_solved then
    return jsonb_build_object(
      'body', v_body,
      'penalty', 0,
      'already_unlocked', true,
      'message', 'Free hint (you already solved this).'
    );
  end if;

  insert into public.hint_unlocks (player_id, challenge_id, hint_number, penalty)
  values (p_player_id, p_challenge_id, p_hint_number, v_pen)
  on conflict (player_id, challenge_id, hint_number) do nothing;
  get diagnostics v_ins = row_count;
  return jsonb_build_object(
    'body', v_body,
    'penalty', v_pen,
    'already_unlocked', (v_ins = 0),
    'message', case when v_ins = 0 then 'Hint (already unlocked)'
                    else 'Hint unlocked (−' || v_pen || ' pts on this challenge)' end
  );
end;
$$;

create or replace function public.submit_flag(
  p_player_id uuid,
  p_token uuid,
  p_challenge_id text,
  p_flag text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_starts timestamptz;
  v_ends timestamptz;
  v_recent integer;
  v_flag text;
  v_day integer;
  v_points integer;
  v_bonus integer;
  v_decay integer;
  v_minimum integer;
  v_rank integer;
  v_base integer;
  v_correct boolean;
  v_first boolean;
  v_penalty integer;
  v_awarded integer;
  v_existing integer;
  v_total integer;
  v_ins integer;
  v_is_dynamic boolean;
  v_secret text;
  v_excluded boolean;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error', 'auth', 'message', 'Session invalid - please register again.');
  end if;
  select coalesce(is_admin, false) or coalesce(exclude_from_board, false)
    into v_excluded from public.players where id = p_player_id;
  select starts_at, ends_at into v_starts, v_ends
    from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('error', 'not_started', 'message', 'The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('error', 'ended', 'message', 'Time is up - the event has ended.');
  end if;
  select day, is_dynamic into v_day, v_is_dynamic
    from public.challenges where id = p_challenge_id;
  if v_day is null then
    return jsonb_build_object('error', 'no_challenge', 'message', 'Unknown challenge.');
  end if;
  if not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error', 'locked', 'message', 'This challenge is locked right now.');
  end if;
  select count(*) into v_recent from public.submission_attempts
   where player_id = p_player_id and created_at > now() - interval '8 seconds';
  if v_recent >= 6 then
    return jsonb_build_object('error', 'rate_limited', 'message', 'Too fast! Wait a moment and try again.');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_challenge_id));

  if v_is_dynamic then
    select secret into v_secret
      from public.challenge_answer_keys where challenge_id = p_challenge_id;
    if v_secret is null then
      return jsonb_build_object('error', 'no_challenge', 'message', 'Unknown challenge.');
    end if;
    v_flag := 'KGSP{' || substr(
      encode(extensions.hmac(p_player_id::text, v_secret, 'sha256'), 'hex'),
      1, 12
    ) || '}';
  else
    select flag into v_flag
      from public.challenge_flags where challenge_id = p_challenge_id;
    if v_flag is null then
      return jsonb_build_object('error', 'no_challenge', 'message', 'Unknown challenge.');
    end if;
  end if;

  v_correct := lower(btrim(p_flag)) = lower(btrim(v_flag));
  insert into public.submission_attempts (player_id, challenge_id, correct)
  values (p_player_id, p_challenge_id, v_correct);

  if coalesce(v_excluded, false) then
    return jsonb_build_object(
      'correct', v_correct,
      'test_mode', true,
      'message', case when v_correct then 'Correct - test mode (not scored).'
                      else 'Not quite - check your work and try again.' end
    );
  end if;
  if not v_correct then
    return jsonb_build_object('correct', false, 'message', 'Not quite - check your work and try again.');
  end if;

  select points_awarded into v_existing from public.solves
   where player_id = p_player_id and challenge_id = p_challenge_id;
  if v_existing is not null then
    return jsonb_build_object(
      'correct', true,
      'already_solved', true,
      'points_awarded', v_existing,
      'message', 'You already solved this one'
    );
  end if;

  select points, first_blood_bonus, score_decay_step, score_minimum
    into v_points, v_bonus, v_decay, v_minimum
    from public.challenges where id = p_challenge_id;

  select count(*) + 1 into v_rank
    from public.solves where challenge_id = p_challenge_id;
  v_first := v_rank = 1;

  if coalesce(v_decay, 0) > 0 then
    v_base := greatest(
      coalesce(v_minimum, 0),
      v_points - v_decay * greatest(v_rank - 2, 0)
    );
  else
    v_base := v_points;
  end if;

  select coalesce(sum(penalty), 0) into v_penalty
    from public.hint_unlocks
   where player_id = p_player_id and challenge_id = p_challenge_id;
  v_awarded := greatest(v_base - v_penalty, 0)
    + case when v_first then v_bonus else 0 end;

  insert into public.solves (player_id, challenge_id, points_awarded, is_first_blood)
  values (p_player_id, p_challenge_id, v_awarded, v_first)
  on conflict (player_id, challenge_id) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    select points_awarded into v_existing from public.solves
     where player_id = p_player_id and challenge_id = p_challenge_id;
    return jsonb_build_object(
      'correct', true,
      'already_solved', true,
      'points_awarded', coalesce(v_existing, 0)
    );
  end if;

  select coalesce(sum(points_awarded), 0) into v_total
    from public.solves where player_id = p_player_id;
  return jsonb_build_object(
    'correct', true,
    'first_blood', v_first,
    'solve_position', v_rank,
    'points_awarded', v_awarded,
    'total_points', v_total,
    'message', case when v_first then 'FIRST BLOOD! +' || v_awarded || ' points'
                    else 'Correct! +' || v_awarded || ' points' end
  );
end;
$$;

