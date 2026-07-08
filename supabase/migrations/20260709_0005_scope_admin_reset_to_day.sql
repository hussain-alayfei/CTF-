-- Fix a serious bug: admin_reset() deleted submission_attempts/hint_unlocks/
-- solves for ALL days with an unconditional `where true`, even though the
-- dashboard button is labeled/used as "reset the current round" while a
-- specific day is active. This silently wiped every other day's history too
-- (confirmed: it erased Day 3 AND Day 4 solves when only Day 4 was being
-- reset). Applied 2026-07-09 after restoring lost Day 3/4 solves from backup.
--
-- admin_reset now takes p_day and only clears that day's challenges' data.
-- The event clock (starts_at/ends_at) is still cleared globally — it's a
-- single shared timer for the whole event, not per-day — but scores for
-- every OTHER day are now always safe from a reset of the current one.
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

grant execute on function public.admin_reset(text,integer) to anon, authenticated;

-- Drop the old single-argument overload so nothing can accidentally call the
-- unscoped "wipe everything" version anymore.
drop function if exists public.admin_reset(text);
