-- Stop event returns the arena to true STAND BY (idle): clear the round clock.
-- Leaving starts_at set made status stay "ended" and UI fight itself
-- (TIME'S UP / Hidden until start vs STAND BY).

create or replace function public.admin_stop_event(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id = 1 and secret = p_secret) into v_ok;
  if not v_ok then
    return jsonb_build_object('error', 'auth', 'message', 'Wrong admin secret.');
  end if;

  update public.event_config
     set starts_at = null,
         ends_at = null,
         finale_stage = -1,
         updated_at = now()
   where id = 1;

  return jsonb_build_object('ok', true, 'message', 'Event stopped — arena on stand by.');
end;
$$;

-- Clear the stuck round that was still "ended" in production.
update public.event_config
   set starts_at = null,
       ends_at = null,
       finale_stage = -1,
       updated_at = now()
 where id = 1;
