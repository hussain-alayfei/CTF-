-- Day 8 — Web Application Hacking (12 live labs).
-- Upsert only. Zero prior Day 8 challenges (empty day was showing "No challenges").
-- Friend TA ideas folded in (cleaned): Hashed Dossier, Cookie Lounge, Twin Param,
-- Graph Attic, Template Vault. Day code WEBHACK-2026.

update public.days
   set title = '💥 Day 8 — Web Application Hacking',
       subtitle = 'Walk the app · HTTP · proxy skills · broken access control. Live labs only.',
       is_open = true,
       requires_code = true
 where day = 8;

insert into public.day_codes (day, code)
values (8, 'WEBHACK-2026')
on conflict (day) do update set code = excluded.code;

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
('d8_door_map', 'Door Map', 'Web', 'easy', 100, 25, 801,
 'A small campus desk app has a public lobby. Staff doors are not linked from the menu.

Walk the application the way a careful visitor would: look for maps and notices that robots are asked to ignore. One of those doors still answers if you visit it yourself.

Goal: open the staff door and recover the short label written on it.',
 null, '/challenge/door-map', 1, 8, false, true),

('d8_header_mirror', 'Header Mirror', 'Web', 'easy', 100, 25, 802,
 'The lobby page looks empty. The interesting part never appears in the visible layout.

Ask the desk for a fresh ping and read how the server describes its own reply. One response field carries a short desk ticket that unlocks the code.

Goal: recover the desk code and submit it.',
 null, '/challenge/header-mirror', 1, 8, false, true),

('d8_method_gate', 'Method Gate', 'Web', 'easy', 120, 30, 803,
 'A sealed note endpoint refuses ordinary page loads. The request button is wired the wrong way on purpose.

Discover which request style the gate actually accepts. When you call it the right way, the note body appears.

Goal: retrieve the sealed note recovery word.',
 null, '/challenge/method-gate', 1, 8, false, true),

('d8_cookie_lounge', 'Cookie Lounge', 'Web', 'medium', 200, 50, 804,
 'You are signed in as a guest on a tiny lounge site. Theme settings are stored in a cookie the server trusts too much.

Adjust that cookie so the lounge treats you as VIP. The VIP plaque appears only after the preference is accepted.

Goal: open the VIP plaque and recover the word printed on it.',
 null, '/challenge/cookie-lounge', 1, 8, false, true),

('d8_proxy_price', 'Proxy Price', 'Web', 'medium', 220, 55, 805,
 'The campus shop shows a sealed item priced too high to buy with your balance.

Complete checkout anyway by changing what the browser sends when you press Buy — not by editing the visible shelf price alone (the page redraws it).

Goal: complete a purchase of the sealed item and recover the packing slip word.',
 null, '/challenge/proxy-price', 1, 8, false, true),

('d8_hashed_dossier', 'Hashed Dossier', 'Web', 'medium', 240, 60, 806,
 'Your academic dossier opens with a long opaque id in the address bar. The portal only checks that you are logged in — not that the dossier is yours.

Your own id is visible after you open My dossier. The live page also leaks how staff seat numbers are encoded.

Goal: open the counselor dossier (not your own) and recover the sealed note inside.',
 null, '/challenge/hashed-dossier', 1, 8, false, true),

('d8_step_skip', 'Step Skip', 'Web', 'medium', 240, 60, 807,
 'Transfers require two steps: Confirm, then Execute. The Confirm button is slow on purpose.

Reach the success screen without finishing Confirm if the execute door forgets to wait.

Goal: execute the draft transfer and recover the receipt word.',
 null, '/challenge/step-skip', 1, 8, false, true),

('d8_verb_smuggle', 'Verb Smuggle', 'Web', 'hard', 350, 80, 808,
 'A lockbox page shows a disabled Clear lock control. Normal browsing cannot clear it.

The API behind the page accepts a different request style than the button uses. Clear the lock anyway.

Goal: clear the lock and recover the word that appears when it opens.',
 null, '/challenge/verb-smuggle', 1, 8, false, true),

('d8_twin_param', 'Twin Param', 'Web', 'hard', 360, 85, 809,
 'Profile updates refuse elevated roles when they appear alone in the role field. A loud front gate blocks that request.

The desk behind the gate reads parameters in a different order than the gate does. Deliver a request that looks safe to the gate but elevates you on the desk.

Goal: become staff on your profile and recover the staff ribbon word.',
 null, '/challenge/twin-param', 1, 8, false, true),

('d8_graph_attic', 'Graph Attic', 'Web', 'hard', 380, 90, 810,
 'Profiles load through a modern API. The visible card only shows public fields.

The same endpoint answers questions about its own shape. Use that to find a way to raise your account, then read the attic note that appears only for elevated accounts.

Goal: elevate your account and recover the attic note.',
 null, '/challenge/graph-attic', 1, 8, false, true),

('d8_filter_crawl', 'Filter Crawl', 'Web', 'danger', 500, 120, 811,
 'A brochure viewer loads files from a folder. Simple traversal is blocked. Absolute paths are blocked. One layer strips parent markers only once. Another layer cares about the file ending.

Make the viewer return a sealed note that lives outside the brochure folder.

Goal: read the sealed note and submit its recovery word.',
 null, '/challenge/filter-crawl', 1, 8, false, true),

('d8_template_vault', 'Template Vault', 'Web', 'danger', 520, 130, 812,
 'A profile bio claims it supports friendly placeholders. Some expressions are rejected. Blind shell ideas are rejected.

Make the bio renderer print a single vault line that already exists on the server context — without running system commands.

Goal: force the vault line into the rendered profile and submit that word.',
 null, '/challenge/template-vault', 1, 8, false, true)
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
('d8_door_map', 'staff_closet_ok', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '661641032585152d4cb17ea17b0824')),
('d8_header_mirror', 'desk_echo', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '00f4c34b90af331054')),
('d8_method_gate', 'post_only_note', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', 'ea81186f929979b49ac4df9dc241')),
('d8_cookie_lounge', 'vip_plaque', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '8f392a2ceae3d99924f1')),
('d8_proxy_price', 'cheap_slip', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', 'b35cc63e79cb2b704a69')),
('d8_hashed_dossier', 'counselor_file', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '79e3681924f8e0026025ca638c13')),
('d8_step_skip', 'skipped_confirm', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', 'cd00b6986ea1c009c658ca20666d28')),
('d8_verb_smuggle', 'lock_cleared', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '09b5885cd4bdaf38f15026ed')),
('d8_twin_param', 'hpp_staff', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '2366fdd7aff34b1135')),
('d8_graph_attic', 'attic_note', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '7416540c2085182e57a7')),
('d8_filter_crawl', 'sealed_outside', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '896d28f271b44e54d30d354a95df')),
('d8_template_vault', 'vault_line', encode(extensions.gen_random_bytes(16), 'hex'),
 jsonb_build_object('reveal_hex', '9091d497c063e57003aa'))
on conflict (challenge_id) do update set
  answer = excluded.answer,
  live_material = excluded.live_material;
  -- secret preserved on conflict via not updating secret column

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d8_door_map', 1, 'Start with the notices meant for crawlers, not for people.', 20),
('d8_header_mirror', 1, 'Look at what arrives about the page, not only the page body.', 20),
('d8_method_gate', 1, 'The gate cares how you ask, not only where you ask.', 25),
('d8_cookie_lounge', 1, 'Preferences live in the browser. Privileges should not.', 40),
('d8_proxy_price', 1, 'The shelf price and the payment request are not the same thing.', 45),
('d8_hashed_dossier', 1, 'Opaque is not the same as authorized.', 50),
('d8_step_skip', 1, 'The second door does not always wait for the first.', 50),
('d8_verb_smuggle', 1, 'Buttons are suggestions. APIs decide.', 70),
('d8_twin_param', 1, 'One name, more than one value.', 70),
('d8_graph_attic', 1, 'Ask the API what it can do, not only what the card shows.', 75),
('d8_filter_crawl', 1, 'Each gate only removes one kind of lie.', 100),
('d8_template_vault', 1, 'Math works. Shells do not. Look for what the engine already knows.', 100)
on conflict (challenge_id, hint_number) do update set
  body = excluded.body,
  penalty = excluded.penalty;
