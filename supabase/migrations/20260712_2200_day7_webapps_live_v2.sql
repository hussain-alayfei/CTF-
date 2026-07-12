-- Day 7 (Web Applications) v2 — live browser labs only.
-- Replaces the v1 text-file pack (GPT-pasteable). Zero asset_url downloads.
--
-- WARNING: retires all prior Day 7 challenge ids. One test solve on d7_vm
-- (TEST_USER) is deleted deliberately as part of this rewrite.
--
-- Day code stays WEB-2026 (live value). Day row title refreshed.

-- ── Retire v1 ──────────────────────────────────────────────────────────────
delete from public.solves
 where challenge_id in (
   select id from public.challenges where day = 7
 );

delete from public.hint_unlocks
 where challenge_id in (
   select id from public.challenges where day = 7
 );

delete from public.submission_attempts
 where challenge_id in (
   select id from public.challenges where day = 7
 );

delete from public.challenge_hints
 where challenge_id in (
   select id from public.challenges where day = 7
 );

delete from public.challenge_answer_keys
 where challenge_id in (
   select id from public.challenges where day = 7
 );

delete from public.challenge_flags
 where challenge_id in (
   select id from public.challenges where day = 7
 );

delete from public.challenges where day = 7;

update public.days
   set title = '🌐 Day 7 — Web Applications',
       subtitle = 'Live browser labs — cookies, storage, network, sinks. No file drops.',
       is_open = false,
       requires_code = true
 where day = 7;

insert into public.day_codes (day, code)
values (7, 'WEB-2026')
on conflict (day) do update set code = excluded.code;

-- ── Challenges ───────────────────────────────────────────────────────────
insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
('d7_markup_trail', 'Markup Trail', 'Web', 'easy', 150, 40, 701,
 'This help desk page looks empty on purpose. The recovery is already on the page — just not in the text you can read with your eyes. Dig through the structure of what the browser actually built.',
 null, '/challenge/markup-trail', 1, 7, false, true),

('d7_side_door', 'Side Door', 'Web', 'easy', 160, 40, 702,
 'Every public lobby has a door the directory does not list. Pass through the lobby in this browser first, then try the path the map forgot. The hatch only opens for a browser that already visited the desk.',
 null, '/challenge/side-door', 1, 7, false, true),

('d7_desk_wizard', 'Desk Wizard', 'Web', 'easy', 175, 45, 703,
 'A three-screen intake form decides whether you get a quiet path through the building. Pick carefully — the wrong combination leaves nothing to recover. When the path is right, the desk stores the recovery out of sight of this form.',
 null, '/challenge/desk-wizard', 1, 7, false, true),

('d7_role_chip', 'Role Chip', 'Web', 'medium', 250, 55, 704,
 'This portal trusts a small chip it left in your browser. Guests see a locked cabinet. Analysts who have stepped away from the front desk may open it — and the portal never re-checks with a server. Fix the chip on your side.',
 null, '/challenge/role-chip', 1, 7, false, true),

('d7_twin_check', 'Twin Check', 'Web', 'medium', 275, 60, 705,
 'This form only accepts a request when two copies of the same desk token agree — one the browser already holds, and one you place in the form. They must match exactly. Find the one that was planted, mirror it, then unlock.',
 null, '/challenge/twin-check', 1, 7, false, true),

('d7_frame_whisper', 'Frame Whisper', 'Web', 'medium', 275, 60, 706,
 'A tiny widget loads beside the desk. It never prints its note on this page — it only speaks once to whoever is listening. Catch what it says, then submit that note.',
 null, '/challenge/frame-whisper', 1, 7, false, true),

('d7_stash_order', 'Stash Order', 'Web', 'medium', 300, 65, 707,
 'The vault expects three named drawers in this browser''s lasting storage — in a fixed order. The building quietly broadcasts the drawer labels when you ask for the plan. Rebuild the stash yourself, then open the vault.',
 null, '/challenge/stash-order', 1, 7, false, true),

('d7_blind_counter', 'Blind Counter', 'Web', 'hard', 400, 80, 708,
 'The desk will not show the code. It will only answer yes or no for one character at one position. Work the counter yourself — eight seats, one glyph each — then submit what you rebuilt.',
 null, '/challenge/blind-counter', 1, 7, false, true),

('d7_friendly_sink', 'Friendly Sink', 'Web', 'hard', 425, 85, 709,
 'This guestbook prints whatever you type back onto the page. The desk tried to scrub dangerous words and failed in the usual ways. Something valuable sits in the page''s memory — make the guestbook read it for you.',
 null, '/challenge/friendly-sink', 1, 7, false, true),

('d7_triple_lock', 'Triple Lock', 'Web', 'danger', 550, 100, 710,
 'Three locks, three different places this browser keeps secrets. Arm each lock, recover the piece that never appears on screen, then open the vault. The vault only yields when all three agree.',
 null, '/challenge/triple-lock', 1, 7, false, true);

-- ── Answer keys + live material ──────────────────────────────────────────
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
('d7_markup_trail', 'ink_below', encode(extensions.gen_random_bytes(16), 'hex'), null),
('d7_side_door', 'service_hatch', encode(extensions.gen_random_bytes(16), 'hex'), null),
('d7_desk_wizard', 'quiet_path', encode(extensions.gen_random_bytes(16), 'hex'), null),
('d7_role_chip', 'analyst_seat', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', '95228a6a5746abb1d5881ef1')),
('d7_twin_check', 'both_match', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', '8b556182ebd4ddd689bd')),
('d7_frame_whisper', 'posted_secret', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('frag', 'posted_secret')),
('d7_stash_order', 'abc_order', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object(
    'reveal_hex', '4683caed6fdc755a3d',
    'a', 'alpha', 'b', 'beta', 'c', 'gamma'
  )),
('d7_blind_counter', 'gate_7k2', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('pos_hashes', jsonb_build_array(
    'a048849969cd1d36','df4504ce92500fe8','2a3b4eda6f358028','c0b59b41d7f4dd3d',
    '810da308a26c6f9f','32cdd803bad59afd','2270ac8670d2c85b','61bc29ecfce8757b'
  ))),
('d7_friendly_sink', 'vault_spill', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('vault', 'vault_spill')),
('d7_triple_lock', 'all_three_open', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object(
    'reveal_hex', '614b2f27c743dcd16d8289b322cd',
    'net_frag', 'ping'
  ));

-- ── Hints (nudge only — never the recipe) ────────────────────────────────
insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d7_markup_trail', 1, 'Not every mark on a page is meant for eyes. Some sit on the nodes themselves; one is even quieter than that.', 30),
('d7_side_door', 1, 'Read the address of the lobby. Doors often live one step further down the same hall.', 30),
('d7_desk_wizard', 1, 'The form is finished — the slip is not on the form. Check the short-lived drawers this tab keeps.', 35),
('d7_role_chip', 1, 'The chip is not plain text. Open it, change who you are, put it back.', 50),
('d7_twin_check', 1, 'One twin was planted before you arrived. Look where this site already wrote small notes about you.', 55),
('d7_frame_whisper', 1, 'The note is spoken across the frame boundary once. You have to be listening when it happens.', 55),
('d7_stash_order', 1, 'Ask for the plan, then watch what leaves. Rebuild those labels into lasting storage under the names the vault already printed.', 60),
('d7_blind_counter', 1, 'Eight seats. Brute force one seat at a time — letters, digits, underscore.', 80),
('d7_friendly_sink', 1, 'The scrub only knows a few words. Other ways of running code still paint the page — and can read what the page remembers.', 85),
('d7_triple_lock', 1, 'One lock is a small note, one left in a request you must watch, one in lasting storage. All three must agree.', 100);
