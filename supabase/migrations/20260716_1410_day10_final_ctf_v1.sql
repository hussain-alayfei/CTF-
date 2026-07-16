-- Day 10 Final CTF Challenges v1 — 20 dynamic challenges (5E/8M/4H/3D).
-- Upsert only. Day stays locked. Access code FINAL-2026.
-- Secrets/material from scripts/gen-day10-final.py (re-apply if regenerated).

update public.days
set
  title = '🏁 Day 10 — Final CTF Challenges',
  subtitle = 'NovaTech final incident — forensics, web desks, crypto, and a four-gate closeout.',
  is_open = false,
  requires_code = true,
  is_completed = false
where day = 10;

insert into public.day_codes (day, code)
values (10, 'FINAL-2026')
on conflict (day) do update set code = excluded.code;

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus,
   score_decay_step, score_minimum, sort_order, prompt, asset_url,
   action_url, num_hints, day, is_extra, is_dynamic)
values
('d10_deep_static', 'Deep Static', 'Forensics', 'easy', 100, 25, 5, 50, 1001,
 'NovaTech''s deep-space desk archived a short radio clip that sounds like pure noise. Investigators believe a short recovery word was painted into the sound''s frequency picture.

Download the clip, recover that word, and submit it here.',
 '/challenges/day10/deep-static.wav', '/challenge/verify/d10_deep_static', 1, 10, false, true),

('d10_hidden_home', 'Curious Intern', 'Forensics', 'easy', 100, 25, 5, 50, 1002,
 'An intern left their laptop unlocked. SOC copied the home folder before return. Something sensitive may sit beside the usual documents — not every name shows up in a casual listing.

Download the home archive, recover the hidden mark, and submit it here.',
 '/challenges/day10/Intern_Home.zip', '/challenge/verify/d10_hidden_home', 1, 10, false, true),

('d10_forgot_path', 'Forgot-Me-Not', 'Web', 'easy', 100, 25, 5, 50, 1003,
 'A programmer left a raw server layout note in the open. The tree still points at a temporary backup folder nobody locked down.

Open the live desk, follow that leftover folder, read the developer note, and recover the mark.',
 null, '/challenge/forgot-path', 1, 10, false, true),

('d10_loose_equals', 'Soft Gate', 'Web', 'easy', 100, 25, 5, 50, 1004,
 'The admin desk login compares your password with a stored mark using a loose rule. You do not need the real password — only a value the gate treats as the same.

Open the live gate, earn the plaque, and submit the recovery word.',
 null, '/challenge/soft-gate', 1, 10, false, true),

('d10_clear_stream', 'Overnight Desk', 'Network', 'easy', 100, 25, 5, 50, 1005,
 'A short overnight capture from the office desk includes one clear web transfer that should not have been clear.

Download the capture, recover the desk slip text, and submit it here.',
 '/challenges/day10/overnight-desk.pcap', '/challenge/verify/d10_clear_stream', 1, 10, false, true),

('d10_ghost_canvas', 'Ghost Canvas', 'Forensics', 'medium', 250, 25, 15, 125, 1010,
 'The curator uploaded “The Silence of the Woods” before lockout. Standard viewing shows a forest. One colour plane still carries a partial mark; this logged-in desk holds the seal that finishes the recovery word.

Download the painting, recover what the plane shows, combine it with the live desk seal, and submit the full word.',
 '/challenges/day10/silence_of_the_woods.png', '/challenge/verify/d10_ghost_canvas', 1, 10, false, true),

('d10_usb_polyglot', 'Parking Lot USB', 'Forensics', 'medium', 250, 25, 15, 125, 1011,
 'Security found an abandoned USB. The visible logo file looks harmless, yet investigators suspect a second container rides along with it. The live desk holds the seed that opens the inner cipher.

Download the logo, recover the inner cipher, combine it with the live seed, and submit the pass.',
 '/challenges/day10/company_logo.png', '/challenge/verify/d10_usb_polyglot', 1, 10, false, true),

('d10_secret_album', 'Admin Album', 'Web', 'medium', 250, 25, 15, 125, 1012,
 'Albums are served with sequential ids. Your album is 105. Walk the id window until the administrator''s private album opens, then recover the seal from the plaque.',
 null, '/challenge/secret-album', 1, 10, false, true),

('d10_poisoned_prefs', 'Poisoned Prefs', 'Web', 'medium', 250, 25, 15, 125, 1013,
 'Theme preferences live in a cookie as a small structured object the desk trusts too much. Reshape that object so the desk believes you hold an admin role, then read the plaque.',
 null, '/challenge/poisoned-prefs', 1, 10, false, true),

('d10_office_leak', 'Curious Admin', 'Network', 'medium', 250, 25, 15, 125, 1014,
 'A richer overnight capture shows a suspicious transfer id that looks incomplete. The live desk holds the missing fragment.

Download the capture, recover the partial tag, finish it with the live fragment, and submit the full tag.',
 '/challenges/day10/office-capture.pcap', '/challenge/verify/d10_office_leak', 1, 10, false, true),

('d10_process_residue', 'Memory Residue', 'Forensics', 'medium', 250, 25, 15, 125, 1015,
 'SOC kept a tiny process residue dump (not a full machine image). A short shard still sits in the noise. The live desk holds the suffix that completes the recovery word.

Download the dump, recover the shard, finish it with the live suffix, and submit.',
 '/challenges/day10/process-residue.bin', '/challenge/verify/d10_process_residue', 1, 10, false, true),

('d10_gallery_lock', 'Gallery Lock', 'Web', 'medium', 250, 25, 15, 125, 1016,
 'The public gallery locked after the curator upload. A quieter vault path still exists under the live desk. Open it, make your role chip read curator, and recover the note.',
 null, '/challenge/gallery-lock', 1, 10, false, true),

('d10_relay_note', 'Relay Note', 'Crypto', 'medium', 250, 25, 15, 125, 1017,
 'A short desk note was wrapped before storage. The download holds only the wrapped form; the live desk holds the high-entropy key.

Download the note, unwrap it with the live key, and submit the plain recovery word.',
 '/challenges/day10/relay-note.txt', '/challenge/verify/d10_relay_note', 1, 10, false, true),

('d10_license_vm', 'License Lattice', 'Reverse', 'hard', 400, 25, 20, 200, 1020,
 'The activation desk does not compare your key as plain text. A tiny instruction lattice transforms each character before checking. Recover a key the lattice accepts, then read the plaque.',
 null, '/challenge/license-lattice', 1, 10, false, true),

('d10_rsa_broadcast', 'Triple Broadcast', 'Crypto', 'hard', 400, 25, 20, 200, 1021,
 'The same short desk message was wrapped three ways for three recipients. Public exponents match. The live desk confirms the shared exponent.

Download the triple wrap, open the original message, and submit it here.',
 '/challenges/day10/triple-broadcast.txt', '/challenge/verify/d10_rsa_broadcast', 1, 10, false, true),

('d10_false_debug', 'False Debugger', 'Reverse', 'hard', 400, 25, 20, 200, 1022,
 'The core vault shows a convincing fake plaque while analysis mode is still armed. Clear the analysis trap, raise the core bypass mark in this browser, then open the real core.',
 null, '/challenge/false-debugger', 1, 10, false, true),

('d10_layered_breach', 'Layered Breach', 'Forensics', 'hard', 400, 25, 20, 200, 1023,
 'Three evidence marks were split across a pack. Two stage labels sit in the download; the live desk holds the suffix that finishes the full recovery word.

Download the pack, join the stage labels in order, finish with the live suffix, and submit.',
 '/challenges/day10/layered-breach.zip', '/challenge/verify/d10_layered_breach', 1, 10, false, true),

('d10_inherited_trust', 'Inherited Trust', 'Web', 'danger', 500, 25, 25, 250, 1030,
 'Final-desk settings merge untrusted JSON into the live object graph. Inherit a chief seat, then inherit the desk seal shown on the page, in one merge — then recover the plaque.',
 null, '/challenge/inherited-trust-final', 1, 10, false, true),

('d10_race_window', 'Race Window', 'Web', 'danger', 500, 25, 25, 250, 1031,
 'Arm the final desk, reserve a guest ticket, then flip your lasting role to admin and confirm while the ticket is still fresh. The confirm window is short.',
 null, '/challenge/race-window', 1, 10, false, true),

('d10_capstone_chain', 'Final Desk', 'Finale', 'danger', 500, 25, 25, 250, 1032,
 'Close the NovaTech incident in four gated steps. Early marks come from today''s other desks and the map inside this lab. The last gate mark is only on the live page.

Complete every gate, recover the final plaque, and submit it here.',
 null, '/challenge/final-desk', 1, 10, false, true)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  difficulty = excluded.difficulty,
  points = excluded.points,
  first_blood_bonus = excluded.first_blood_bonus,
  score_decay_step = excluded.score_decay_step,
  score_minimum = excluded.score_minimum,
  sort_order = excluded.sort_order,
  prompt = excluded.prompt,
  asset_url = excluded.asset_url,
  action_url = excluded.action_url,
  num_hints = excluded.num_hints,
  day = excluded.day,
  is_extra = excluded.is_extra,
  is_dynamic = excluded.is_dynamic;

-- Answer keys (from gen-day10-final.py)
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_deep_static', 'spectrum_glyph', '7c987bef8a67a6a54922adc63cfa881a', '{}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_hidden_home', 'always_check_dots', '72628c5cbe912e9128629243afc96550', '{}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_forgot_path', 'backup_temp_note', 'bf1bd9dc18555d47e5f418e6de268bd7', '{}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_loose_equals', 'zero_match_ok', '77bb8dc22b5999f4d929c5ee518f4a34', '{"reveal_hex": "4e62e0c8fb428e8ed8b59e2b95"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_clear_stream', 'http_desk_slip', '65ebfa47200b6a6401053a035e656876', '{}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_ghost_canvas', 'blue_branch_whisper', '22e4bcfc114307f3f9d2f89750bfc650', '{"suffix": "_whisper"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_usb_polyglot', 'usb_inner_pass', '5eac5b4b5dc97399bea26789794f40eb', '{"key_seed": "lot"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_secret_album', 'album_104_seal', 'bd2c3bf6801d74fbf573c1953a4db915', '{"reveal_hex": "3f9a9f86484c9b4ce54001dbad9d"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_poisoned_prefs', 'prefs_exec_token', '7e041e99a141f54ed8e7d8e7c85b4857', '{"reveal_hex": "fc1b1383c61e616dd88a57c9228570b1"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_office_leak', 'c2_payload_tag', 'f515d96dbc63e2ebe7d2f358dc753e71', '{"frag": "_tag"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_process_residue', 'ram_key_shard', '439684455b71edb12590d141f14d472c', '{"suffix": "_shard"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_gallery_lock', 'curator_bypass', '85fa7fb99314c4f96f26402e07b48eb3', '{"reveal_hex": "464c04e42b67634361f53a1403aa"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_relay_note', 'relay_plain_ok', 'c2803b38acf01ecaa0105d1716ce1e14', '{"key_hex": "31fd4cae277e7f8570e07b7670f775cfb64df0fa33cc50b94a2c274bec9ed1a6"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_license_vm', 'vm_license_ok', '983d66780244b14769783ef59652cceb', '{"reveal_hex": "3ad3563512151c252c0eda2377"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_rsa_broadcast', 'crt_message', '2b7dfef840467e42c8d12617c2e983fd', '{"e": "3"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_false_debug', 'true_core_flag', '763dece72149080937f19795366db0fe', '{"reveal_hex": "793780981948e302daa4766e7ba6"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_layered_breach', 'breach_full_chain', 'cedb3ee94fea8c09753af1eab2469927', '{"suffix": "_chain"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_inherited_trust', 'chief_final_clear', 'dedf40ce2517024226c18566e4c9be07', '{"reveal_hex": "f1edeb1ee66ec7b289b0bc11dbcce9e9e3", "seal": "D10-SEAL"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_race_window', 'race_final_ok', '73e9d704b5c13318218035d8074cfef3', '{"reveal_hex": "60fd8668866d9b2ae4eb3cbc9a"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;
insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('d10_capstone_chain', 'novatech_closed', '7c183d8102593217d84f052eb63a06e0', '{"reveal_hex": "ad818d39a3a14728f6b7c78322b34d", "gate": "n10-final"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer, secret = excluded.secret, live_material = excluded.live_material;

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d10_deep_static', 1, 'Look at the picture of the sound, not only the waveform.', 15),
('d10_hidden_home', 1, 'Names that start with a dot often stay out of casual listings.', 15),
('d10_forgot_path', 1, 'The layout note already spells the leftover folder path.', 15),
('d10_loose_equals', 1, 'The stored mark and your guess can both look like numeric zero to a soft compare.', 15),
('d10_clear_stream', 1, 'Follow the clear web conversation in the short capture.', 15),
('d10_ghost_canvas', 1, 'Isolate one colour plane, then finish with the live desk seal.', 40),
('d10_usb_polyglot', 1, 'The logo file may carry a second container after the image ends.', 40),
('d10_secret_album', 1, 'Your id is one step after the administrator''s private album.', 40),
('d10_poisoned_prefs', 1, 'The cookie is a small structured object — roles live beside the theme.', 40),
('d10_office_leak', 1, 'The transfer id in the capture is missing its ending; the desk holds it.', 40),
('d10_process_residue', 1, 'Search the dump for a short readable shard near a process marker.', 40),
('d10_gallery_lock', 1, 'The vault annex is under this challenge path; the role chip lives in browser storage.', 40),
('d10_relay_note', 1, 'The download is only the wrapped form; the key never left the live page.', 40),
('d10_license_vm', 1, 'Each character is transformed the same way before the compare — reverse that step.', 60),
('d10_rsa_broadcast', 1, 'Three wraps, one message, matching public exponents — combine then open.', 60),
('d10_false_debug', 1, 'The red plaque is bait while the analysis trap is still armed.', 60),
('d10_layered_breach', 1, 'Two stage labels are in the pack; the live seal finishes the word.', 60),
('d10_inherited_trust', 1, 'A nested constructor path can still reach the shared prototype the merge walks.', 80),
('d10_race_window', 1, 'Arm, reserve as guest, flip the lasting role, confirm before the ticket ages out.', 80),
('d10_capstone_chain', 1, 'Reuse marks you already earned today; the last gate is only on this desk.', 80)
on conflict (challenge_id, hint_number) do update set
  body = excluded.body,
  penalty = excluded.penalty;
