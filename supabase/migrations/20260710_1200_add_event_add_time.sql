-- Migration: give instructors a clean way to CHANGE the running clock without
-- restarting the round.
--
-- The bug this fixes: the only way to "give players 15 more minutes" was the
-- Start/Restart button, which calls admin_start_event and resets
-- starts_at = now(). The arena keys its one-time "3-2-1 GO!" intro on starts_at
-- (sessionStorage), so every extend-via-restart replayed the whole GO overlay
-- AND reset the clock to a full fresh duration (throwing away elapsed time).
--
-- admin_add_time moves ONLY ends_at (and keeps duration_minutes in sync). Since
-- starts_at is untouched, the GO intro never replays and elapsed time is kept.
-- Positive minutes extend the round, negative minutes shorten it. Adding time to
-- a round that already ended brings it back to live for the added minutes.
--
-- Applied 2026-07-10.

create or replace function public.admin_add_time(p_secret text, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_s timestamptz; v_e timestamptz; v_new_end timestamptz; v_dur integer;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;

  if p_minutes is null or p_minutes = 0 then
    return jsonb_build_object('error','no_change','message','No time change specified.');
  end if;
  if p_minutes < -600 or p_minutes > 600 then
    return jsonb_build_object('error','range','message','Time change must be within ±600 minutes.');
  end if;

  select starts_at, ends_at into v_s, v_e from public.event_config where id = 1;
  if v_s is null then
    return jsonb_build_object('error','not_started','message','No round has started — start the event first.');
  end if;

  -- Extend from whichever is later: the current end, or now. That way adding
  -- time to an already-ended round revives it for exactly the added minutes,
  -- instead of counting the extension from a stale end in the past.
  v_new_end := greatest(coalesce(v_e, now()), now()) + make_interval(mins => p_minutes);

  -- Never let a shrink push the end before start (or before now) — clamp so the
  -- round just ends now rather than going negative.
  if v_new_end < now() then v_new_end := now(); end if;
  if v_new_end < v_s then v_new_end := v_s; end if;

  v_dur := greatest(1, round(extract(epoch from (v_new_end - v_s)) / 60.0)::integer);

  update public.event_config
     set ends_at = v_new_end, duration_minutes = v_dur, updated_at = now()
   where id = 1;

  return jsonb_build_object(
    'ok', true,
    'ends_at', v_new_end,
    'duration_minutes', v_dur,
    'message', case when p_minutes > 0
      then '+' || p_minutes || ' min — clock extended (round kept running, intro not replayed).'
      else p_minutes || ' min — clock shortened.' end
  );
end; $$;

grant execute on function public.admin_add_time(text, integer) to anon, authenticated;
