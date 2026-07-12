-- "Round length" was not a saved setting at all.
--
-- Two separate bugs made the field in the instructor panel unusable:
--
--   1. Nothing ever persisted it. The number in the box was local component state,
--      passed to admin_start_event(p_minutes) and otherwise thrown away. Typing a
--      new value and refreshing simply re-read the server's value and put it back —
--      the field looked broken because it *was* read-only in practice.
--
--   2. admin_add_time OVERWROTE it. It recomputed duration_minutes as the whole
--      span from starts_at to the new ends_at, so every "+15 min" during a live
--      round permanently rewrote the configured round length. That is how the
--      setting ended up at 188: the Day-6 round was extended repeatedly, and the
--      round length inherited the total elapsed time of that round.
--
-- duration_minutes is the round length you *configure for the next start*. Adding
-- time to a running round moves ends_at only; it is not a new setting.
begin;

create or replace function public.admin_set_duration(p_secret text, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 600 then
    return jsonb_build_object('error','range','message','Round length must be between 1 and 600 minutes.');
  end if;
  update public.event_config set duration_minutes = p_minutes, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'duration_minutes', p_minutes);
end; $$;

grant execute on function public.admin_set_duration(text,integer) to anon, authenticated;

-- Same as before, minus the `duration_minutes = v_dur` write. Adding time extends
-- the clock; it no longer silently redefines the round length for the next round.
create or replace function public.admin_add_time(p_secret text, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_s timestamptz; v_e timestamptz; v_new_end timestamptz;
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

  v_new_end := greatest(coalesce(v_e, now()), now()) + make_interval(mins => p_minutes);
  if v_new_end < now() then v_new_end := now(); end if;
  if v_new_end < v_s then v_new_end := v_s; end if;

  update public.event_config set ends_at = v_new_end, updated_at = now() where id = 1;

  return jsonb_build_object(
    'ok', true,
    'ends_at', v_new_end,
    'message', case when p_minutes > 0
      then '+' || p_minutes || ' min — clock extended (round kept running, intro not replayed).'
      else p_minutes || ' min — clock shortened.' end
  );
end; $$;

commit;
