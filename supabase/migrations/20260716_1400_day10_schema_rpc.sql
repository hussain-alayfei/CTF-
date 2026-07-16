-- Day 10 Final CTF — progress table + multi-stage lab RPC (capstone).
-- Upsert-safe. Does not touch solves.

create table if not exists public.day10_progress (
  player_id uuid not null references public.players(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  stage integer not null default 0 check (stage >= 0),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, challenge_id)
);

alter table public.day10_progress enable row level security;

create index if not exists idx_day10_progress_challenge
  on public.day10_progress (challenge_id);

create or replace function public.d10_lab_step(
  p_player_id uuid,
  p_token uuid,
  p_challenge_id text,
  p_action text,
  p_input text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_stage integer;
  v_expected text;
  v_gate text;
  v_material jsonb;
  v_starts timestamptz;
  v_ends timestamptz;
  v_completed boolean;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'auth', 'message', 'Session invalid — log in again.');
  end if;

  if p_challenge_id is distinct from 'd10_capstone_chain' then
    return jsonb_build_object('ok', false, 'error', 'unknown', 'message', 'Unknown lab.');
  end if;

  if not exists (
    select 1 from public.challenges c
    join public.days d on d.day = c.day
    where c.id = p_challenge_id and c.day = 10 and d.is_open
  ) then
    return jsonb_build_object('ok', false, 'error', 'locked', 'message', 'This lab is locked.');
  end if;

  select starts_at, ends_at into v_starts, v_ends
    from public.event_config where id = 1;
  select is_completed into v_completed from public.days where day = 10;
  if coalesce(v_completed, false) is not true then
    if v_starts is null or now() < v_starts or (v_ends is not null and now() > v_ends) then
      return jsonb_build_object('ok', false, 'error', 'clock', 'message', 'The live round is not running.');
    end if;
  end if;

  select live_material into v_material
    from public.challenge_answer_keys where challenge_id = p_challenge_id;
  if v_material is null then
    return jsonb_build_object('ok', false, 'error', 'unknown', 'message', 'Unknown lab.');
  end if;
  v_gate := coalesce(v_material->>'gate', '');

  if lower(coalesce(p_action, '')) = 'reset' then
    delete from public.day10_progress
     where player_id = p_player_id and challenge_id = p_challenge_id;
  end if;

  insert into public.day10_progress (player_id, challenge_id)
  values (p_player_id, p_challenge_id)
  on conflict (player_id, challenge_id) do nothing;

  select stage into v_stage
    from public.day10_progress
   where player_id = p_player_id and challenge_id = p_challenge_id
   for update;

  if lower(coalesce(p_action, '')) = 'begin' then
    return jsonb_build_object('ok', true, 'stage', v_stage, 'done', v_stage >= 4);
  end if;

  if lower(coalesce(p_action, '')) = 'submit' then
    if v_stage >= 4 then
      return jsonb_build_object('ok', true, 'stage', v_stage, 'done', true, 'message', 'Already complete.',
        'material', v_material);
    end if;

    v_expected := case v_stage
      when 0 then 'backup_temp_note'
      when 1 then 'album_104_seal'
      when 2 then 'c2_payload_tag'
      when 3 then v_gate
      else ''
    end;

    if lower(trim(coalesce(p_input, ''))) is distinct from lower(trim(v_expected)) then
      return jsonb_build_object('ok', false, 'stage', v_stage, 'message', 'That mark does not clear this gate.');
    end if;

    v_stage := v_stage + 1;
    update public.day10_progress
       set stage = v_stage, updated_at = now()
     where player_id = p_player_id and challenge_id = p_challenge_id;

    if v_stage >= 4 then
      return jsonb_build_object(
        'ok', true, 'stage', v_stage, 'done', true,
        'message', 'All four gates cleared.',
        'material', v_material
      );
    end if;

    return jsonb_build_object('ok', true, 'stage', v_stage, 'done', false, 'message', 'Gate cleared. Continue.');
  end if;

  return jsonb_build_object('ok', false, 'error', 'action', 'message', 'Unknown action.');
end;
$$;

revoke all on function public.d10_lab_step(uuid, uuid, text, text, text) from public;
grant execute on function public.d10_lab_step(uuid, uuid, text, text, text) to anon, authenticated;
