-- "Completed" flag for days: a completed day stays open for practice and is
-- never fairness-blurred in the arena, so students can revisit past days (e.g.
-- Day 3, Day 4) even while the clock is idle. Only the live/active, non-completed
-- day is hidden before its round starts.
alter table public.days add column if not exists is_completed boolean not null default false;

-- Seed the days that are already done as completed.
update public.days set is_completed = true where day in (3, 4);

-- Admin toggle.
create or replace function public.admin_set_day_completed(p_secret text, p_day integer, p_completed boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id=1 and secret = p_secret) into v_ok;
  if not v_ok then return jsonb_build_object('error','auth','message','Wrong admin secret.'); end if;
  update public.days set is_completed = p_completed where day = p_day;
  return jsonb_build_object('ok', true, 'day', p_day, 'is_completed', p_completed);
end; $$;
grant execute on function public.admin_set_day_completed(text,integer,boolean) to anon, authenticated;

-- Surface is_completed in the admin overview so the dashboard reflects it.
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
               dd.is_rest, dd.requires_code, dd.is_completed, dc.code
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
