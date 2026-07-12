-- Synced finale: the instructor drives the winner reveal and every screen in the
-- room follows in lockstep.
--
-- `event_config` is already in the realtime publication (see schema.sql), and the
-- arena already refetches the event on any event_config UPDATE — so putting the
-- reveal stage in this table means every connected screen gets the change for free,
-- with no new channel plumbing. A screen that joins late (or refreshes) also lands
-- on the correct stage automatically, which a broadcast-only approach would not do.
--
-- Stages:
--   -1  finale closed (normal arena)
--    0  finale open — three cards face down
--    1  3rd place revealed
--    2  2nd place revealed
--    3  1st place revealed (the winner)
begin;

alter table public.event_config
  add column if not exists finale_stage smallint not null default -1;

create or replace function public.admin_set_finale_stage(p_secret text, p_stage integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_stage is null or p_stage < -1 or p_stage > 3 then
    return jsonb_build_object('error','range','message','Finale stage must be between -1 and 3.');
  end if;
  update public.event_config set finale_stage = p_stage, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'finale_stage', p_stage);
end; $$;

grant execute on function public.admin_set_finale_stage(text,integer) to anon, authenticated;

-- Starting a round clears any finale left over from the previous one, so a new
-- event never opens onto a stale podium.
create or replace function public.admin_start_event(p_secret text, p_minutes integer default 60)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean; v_s timestamptz; v_e timestamptz;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  if p_minutes < 1 or p_minutes > 600 then p_minutes := 60; end if;
  update public.event_config
     set starts_at = now(), ends_at = now() + (p_minutes || ' minutes')::interval,
         duration_minutes = p_minutes, finale_stage = -1, updated_at = now()
   where id = 1
  returning starts_at, ends_at into v_s, v_e;
  return jsonb_build_object('starts_at', v_s, 'ends_at', v_e, 'duration_minutes', p_minutes);
end; $$;

commit;
