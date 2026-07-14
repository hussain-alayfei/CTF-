-- Day 8: add Hidden Ledger (SQLi auth bypass, Hard) from TA draft — cleaned.
-- Smart twist: trailing AND closed=0 means classic OR 1=1 without a comment fails.
-- Bump danger sort_orders so this sits with the other Hards.

update public.challenges
   set sort_order = 812
 where id = 'd8_filter_crawl';

update public.challenges
   set sort_order = 813
 where id = 'd8_template_vault';

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
('d8_hidden_ledger', 'Hidden Ledger', 'Web', 'hard', 370, 90, 811,
 'A campus ledger login asks only for an account number. Wrong numbers say the account was not found.

Some inputs make the desk complain about broken wording near a quote mark.

Goal: reach the primary ledger screen and recover the word shown there.',
 null, '/challenge/hidden-ledger', 1, 8, false, true)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  difficulty = excluded.difficulty,
  points = excluded.points,
  first_blood_bonus = excluded.first_blood_bonus,
  sort_order = excluded.sort_order,
  prompt = excluded.prompt,
  asset_url = excluded.asset_url,
  action_url = excluded.action_url,
  num_hints = excluded.num_hints,
  day = excluded.day,
  is_extra = excluded.is_extra,
  is_dynamic = excluded.is_dynamic;

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
('d8_hidden_ledger', 'ledger_bypass_ok', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '9e14c545da306fa5bb67d5b8f93997df'))
on conflict (challenge_id) do update set
  answer = excluded.answer,
  live_material = excluded.live_material;

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d8_hidden_ledger', 1,
 'When the desk argues about wording, the sentence it is building may still have a tail you need to silence.',
 75)
on conflict (challenge_id, hint_number) do update set
  body = excluded.body,
  penalty = excluded.penalty;
