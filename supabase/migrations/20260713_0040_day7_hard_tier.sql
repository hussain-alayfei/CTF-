-- Day 7 Hard tier (3): blind boolean oracle, strict XSS companion rows, claim ticket rows.
-- Blind evaluation is server-side so the secret never ships in the SPA bundle.

create or replace function public.d7_blind_lookup(
  p_player_id uuid,
  p_token uuid,
  p_query text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_day int;
  v_secret text;
  v_q text;
  v_pos int;
  v_ch text;
  v_num int;
  v_op text;
  v_ascii int;
  v_ok boolean := false;
  v_m text[];
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error', 'auth', 'message', 'Session invalid.');
  end if;
  select day into v_day from public.challenges where id = 'd7_blind_lookup';
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error', 'locked', 'message', 'This challenge is locked right now.');
  end if;

  select answer into v_secret from public.challenge_answer_keys where challenge_id = 'd7_blind_lookup';
  if v_secret is null then
    return jsonb_build_object('error', 'missing', 'message', 'Challenge not configured.');
  end if;

  v_q := coalesce(p_query, '');

  -- Plain username checks (no injection): a few seats exist.
  if v_q ~* '^(admin|custodian|guest)\s*$' then
    return jsonb_build_object('ok', true, 'exists', true);
  end if;

  -- Blind char equality: SUBSTRING/SUBSTR/MID (flag|secret|password, POS, 1) = 'C'
  v_m := regexp_match(
    v_q,
    '(?i)(?:substring|substr|mid)\s*\(\s*(?:flag|secret|password)\s*,\s*(\d+)\s*,\s*1\s*\)\s*=\s*''([^'']+)'''
  );
  if v_m is null then
    v_m := regexp_match(
      v_q,
      '(?i)(?:substring|substr|mid)\s*\(\s*(?:flag|secret|password)\s*,\s*(\d+)\s*,\s*1\s*\)\s*=\s*"([^"]+)"'
    );
  end if;
  if v_m is not null then
    v_pos := v_m[1]::int;
    v_ch := v_m[2];
    if v_pos >= 1 and v_pos <= length(v_secret) and length(v_ch) = 1 then
      v_ok := substr(v_secret, v_pos, 1) = v_ch;
    else
      v_ok := false;
    end if;
    return jsonb_build_object('ok', true, 'exists', v_ok);
  end if;

  -- ASCII comparisons for binary search: ASCII(SUBSTRING(flag,N,1)) OP NUM
  v_m := regexp_match(
    v_q,
    '(?i)ascii\s*\(\s*(?:substring|substr|mid)\s*\(\s*(?:flag|secret|password)\s*,\s*(\d+)\s*,\s*1\s*\)\s*\)\s*(=|<>|!=|<=|>=|<|>)\s*(\d+)'
  );
  if v_m is not null then
    v_pos := v_m[1]::int;
    v_op := v_m[2];
    v_num := v_m[3]::int;
    if v_pos < 1 or v_pos > length(v_secret) then
      v_ok := false;
    else
      v_ascii := ascii(substr(v_secret, v_pos, 1));
      v_ok := case v_op
        when '=' then v_ascii = v_num
        when '<>' then v_ascii <> v_num
        when '!=' then v_ascii <> v_num
        when '<' then v_ascii < v_num
        when '>' then v_ascii > v_num
        when '<=' then v_ascii <= v_num
        when '>=' then v_ascii >= v_num
        else false
      end;
    end if;
    return jsonb_build_object('ok', true, 'exists', v_ok);
  end if;

  -- Length probes: LENGTH(flag)=N / LEN(flag)=N
  v_m := regexp_match(v_q, '(?i)(?:length|len|char_length)\s*\(\s*(?:flag|secret|password)\s*\)\s*=\s*(\d+)');
  if v_m is not null then
    v_ok := length(v_secret) = v_m[1]::int;
    return jsonb_build_object('ok', true, 'exists', v_ok);
  end if;

  -- LIKE prefix: flag LIKE 'ab%'
  v_m := regexp_match(v_q, '(?i)(?:flag|secret|password)\s+like\s+''([^'']*)''');
  if v_m is not null then
    v_ok := v_secret like v_m[1];
    return jsonb_build_object('ok', true, 'exists', v_ok);
  end if;

  -- Default: treat as unknown username (no injection matched)
  if position('''' in v_q) > 0 then
    -- injection-looking but unsupported → false (not a SQL error leak)
    return jsonb_build_object('ok', true, 'exists', false);
  end if;

  return jsonb_build_object('ok', true, 'exists', false);
end;
$$;

revoke all on function public.d7_blind_lookup(uuid, uuid, text) from public;
grant execute on function public.d7_blind_lookup(uuid, uuid, text) to anon, authenticated;

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
('d7_blind_lookup', 'Quiet Directory', 'Web', 'hard', 400, 80, 7071,
 'A desk directory will only tell you whether a name is present — never why, never a row dump. The custodian filed a short recovery word in that same directory. Ask questions that have only yes-or-no answers until you can rebuild it.',
 null, '/challenge/quiet-directory', 1, 7, false, true),

('d7_strict_book', 'Strict Guestbook', 'Web', 'hard', 425, 85, 7073,
 'This guestbook prints visitor notes back onto the page, but the scrubber is stricter than the last one the floor used. Something valuable sits in page memory — make the guestbook read it without using the obvious hooks the scrubber already knows.',
 null, '/challenge/strict-guestbook', 1, 7, false, true),

('d7_claim_ticket', 'Claim Ticket', 'Web', 'hard', 450, 90, 7075,
 'The desk issues signed claim tickets. Guests get a valid ticket for free. The vault only opens for a ticket that claims the admin seat — and the verifier has one lazy shortcut when it trusts a ticket too much.',
 null, '/challenge/claim-ticket', 1, 7, false, true)
on conflict (id) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  points = excluded.points,
  difficulty = excluded.difficulty,
  sort_order = excluded.sort_order,
  action_url = excluded.action_url,
  num_hints = excluded.num_hints,
  is_dynamic = true,
  asset_url = null;

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
('d7_blind_lookup', 'w7blindx', encode(extensions.gen_random_bytes(16), 'hex'), null),
('d7_strict_book', 'strict_spill', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', 'f1acfd917ec743437b491f08')),
('d7_claim_ticket', 'forged_pass', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', 'ea060482d0255b65dc9a7b'))
on conflict (challenge_id) do update set
  answer = excluded.answer,
  live_material = excluded.live_material;

-- Keep blind/strict secrets stable on re-apply if answers already set
update public.challenge_answer_keys
   set answer = 'w7blindx', live_material = null
 where challenge_id = 'd7_blind_lookup';
update public.challenge_answer_keys
   set answer = 'strict_spill',
       live_material = jsonb_build_object('reveal_hex', 'f1acfd917ec743437b491f08')
 where challenge_id = 'd7_strict_book';
update public.challenge_answer_keys
   set answer = 'forged_pass',
       live_material = jsonb_build_object('reveal_hex', 'ea060482d0255b65dc9a7b')
 where challenge_id = 'd7_claim_ticket';

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d7_blind_lookup', 1, 'The directory only answers yes or no. Ask about one character at a time — or compare how large its alphabet code is.', 80),
('d7_strict_book', 1, 'The scrubber hunts for the usual hooks by name. Other timing hooks on ordinary tags still fire.', 85),
('d7_claim_ticket', 1, 'Issue a guest ticket and read its three parts. One algorithm name makes the desk skip the ink check entirely.', 90)
on conflict (challenge_id, hint_number) do update set body = excluded.body, penalty = excluded.penalty;
