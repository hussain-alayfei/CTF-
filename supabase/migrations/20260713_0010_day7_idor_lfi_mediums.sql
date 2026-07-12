-- Day 7 — two Medium labs (Banan briefs, hardened):
--   d7_leaky_desk  = IDOR via RPC (answer only on desk 2701)
--   d7_safe_shelf  = path traversal over a virtual shelf
-- Anti-AI: answers are server-only; Network-tab replay required.

create or replace function public.d7_leaky_user(
  p_player_id uuid,
  p_token uuid,
  p_desk_id integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_day int;
  v_self int := 4188;
  v_target int := 2701;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error', 'auth', 'message', 'Session invalid.');
  end if;
  select day into v_day from public.challenges where id = 'd7_leaky_desk';
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error', 'locked', 'message', 'This challenge is locked right now.');
  end if;
  if p_desk_id is null or p_desk_id < 1 or p_desk_id > 9999 then
    return jsonb_build_object('error', 'range', 'message', 'desk id out of range');
  end if;

  if p_desk_id = v_self then
    return jsonb_build_object(
      'ok', true,
      'user', jsonb_build_object(
        'desk_id', v_self,
        'display_name', 'Arena Visitor',
        'role', 'guest',
        'created_at', '2026-03-14',
        'welcome', 'Welcome back to the desk portal.',
        'badge_issuer', v_target
      )
    );
  end if;

  if p_desk_id = v_target then
    return jsonb_build_object(
      'ok', true,
      'user', jsonb_build_object(
        'desk_id', v_target,
        'display_name', 'Desk Custodian',
        'role', 'custodian',
        'created_at', '2025-01-02',
        'welcome', 'Custodian console - restricted fields follow.',
        'internal_memo', 'desk_owner_note'
      )
    );
  end if;

  if p_desk_id in (7, 42, 100, 1000, 1001, 2000, 4187, 4189) then
    return jsonb_build_object(
      'ok', true,
      'user', jsonb_build_object(
        'desk_id', p_desk_id,
        'display_name', 'Archived Seat ' || p_desk_id::text,
        'role', 'archived',
        'created_at', '2024-11-01',
        'welcome', 'This seat is archived. No further fields.'
      )
    );
  end if;

  return jsonb_build_object('error', 'missing', 'message', 'No desk with that id.');
end;
$$;

revoke all on function public.d7_leaky_user(uuid, uuid, integer) from public;
grant execute on function public.d7_leaky_user(uuid, uuid, integer) to anon, authenticated;

create or replace function public.d7_safe_file(
  p_player_id uuid,
  p_token uuid,
  p_file text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_day int;
  v_raw text;
  v_parts text[];
  v_seg text;
  v_stack text[] := array[]::text[];
  v_resolved text;
  v_body text;
  v_len int;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error', 'auth', 'message', 'Session invalid.');
  end if;
  select day into v_day from public.challenges where id = 'd7_safe_shelf';
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error', 'locked', 'message', 'This challenge is locked right now.');
  end if;

  v_raw := coalesce(p_file, '');
  if v_raw ~* '^[a-z]:' or position('/' in ltrim(v_raw)) = 1 then
    return jsonb_build_object('error', 'denied', 'message', 'Absolute paths are not allowed.');
  end if;

  v_parts := string_to_array('var/desk/guides/' || replace(v_raw, chr(92), '/'), '/');
  foreach v_seg in array v_parts loop
    if v_seg is null or v_seg = '' or v_seg = '.' then
      continue;
    elsif v_seg = '..' then
      v_len := coalesce(array_length(v_stack, 1), 0);
      if v_len > 0 then
        v_stack := v_stack[1:v_len - 1];
      end if;
    else
      v_stack := v_stack || v_seg;
    end if;
  end loop;

  v_resolved := '/' || array_to_string(v_stack, '/');

  if v_resolved = '/var/desk/guides/tos.txt' then
    v_body := 'Terms of Service' || chr(10) || chr(10)
      || 'Use of the desk portal is subject to staff review.' || chr(10)
      || 'Internal notes are kept one shelf above the public guides cabinet.' || chr(10);
  elsif v_resolved = '/var/desk/guides/privacy.txt' then
    v_body := 'Privacy Policy' || chr(10) || chr(10)
      || 'We store desk identifiers for routing only.' || chr(10);
  elsif v_resolved = '/var/desk/guides/welcome.txt' then
    v_body := 'Welcome Guide' || chr(10) || chr(10)
      || 'Pick a document from the list to begin.' || chr(10);
  elsif v_resolved = '/var/desk/secrets/desk_note.txt' then
    v_body := 'CUSTODIAN SHELF - do not publish' || chr(10)
      || 'recovery: shelf_escape_ok' || chr(10);
  else
    return jsonb_build_object(
      'error', 'missing',
      'message', 'No document at that path.',
      'resolved', v_resolved
    );
  end if;

  return jsonb_build_object('ok', true, 'path', v_resolved, 'body', v_body);
end;
$$;

revoke all on function public.d7_safe_file(uuid, uuid, text) from public;
grant execute on function public.d7_safe_file(uuid, uuid, text) to anon, authenticated;

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
('d7_leaky_desk', 'Leaky Desk', 'Web', 'medium', 280, 60, 7055,
 'Your desk portal shows a welcome card and will fetch your profile when you ask. The portal talks to a background desk directory to do that. See whose records that directory will hand over — then recover what the custodian filed.',
 null, '/challenge/leaky-desk', 1, 7, false, true),
('d7_safe_shelf', 'Safe Shelf', 'Web', 'medium', 290, 60, 7065,
 'A documentation shelf loads public guides by name. The shelf claims it only opens files inside the guides cabinet. Prove otherwise and read what the custodian left on the shelf above.',
 null, '/challenge/safe-shelf', 1, 7, false, true)
on conflict (id) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  points = excluded.points,
  first_blood_bonus = excluded.first_blood_bonus,
  sort_order = excluded.sort_order,
  action_url = excluded.action_url,
  difficulty = excluded.difficulty,
  is_dynamic = excluded.is_dynamic,
  asset_url = excluded.asset_url,
  num_hints = excluded.num_hints;

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
('d7_leaky_desk', 'desk_owner_note', encode(extensions.gen_random_bytes(16), 'hex'), null),
('d7_safe_shelf', 'shelf_escape_ok', encode(extensions.gen_random_bytes(16), 'hex'), null)
on conflict (challenge_id) do update set answer = excluded.answer;

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d7_leaky_desk', 1, 'Your own record is not the only interesting field in the JSON. Something on it points at another desk.', 55),
('d7_safe_shelf', 1, 'Read the public guides carefully — one of them mentions where internal notes live relative to the cabinet you are in.', 55)
on conflict (challenge_id, hint_number) do update set body = excluded.body, penalty = excluded.penalty;
