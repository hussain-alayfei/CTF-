-- Day 7 v2.1 — replace Easy-tier "danger/hard" with three real Danger labs.
-- Retires: d7_blind_counter, d7_friendly_sink, d7_triple_lock (0 solves).
-- Adds: d7_inherited_trust, d7_cross_talk, d7_flash_seat.

delete from public.solves
 where challenge_id in ('d7_blind_counter', 'd7_friendly_sink', 'd7_triple_lock');
delete from public.hint_unlocks
 where challenge_id in ('d7_blind_counter', 'd7_friendly_sink', 'd7_triple_lock');
delete from public.submission_attempts
 where challenge_id in ('d7_blind_counter', 'd7_friendly_sink', 'd7_triple_lock');
delete from public.challenge_hints
 where challenge_id in ('d7_blind_counter', 'd7_friendly_sink', 'd7_triple_lock');
delete from public.challenge_answer_keys
 where challenge_id in ('d7_blind_counter', 'd7_friendly_sink', 'd7_triple_lock');
delete from public.challenges
 where id in ('d7_blind_counter', 'd7_friendly_sink', 'd7_triple_lock');

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
('d7_inherited_trust', 'Inherited Trust', 'Web', 'danger', 500, 100, 708,
 'This desk merges visitor settings into its own config. It swears it blocked the one dangerous key everyone knows about. Prove the swear was too narrow — then take the chief seat.',
 null, '/challenge/inherited-trust', 1, 7, false, true),

('d7_cross_talk', 'Cross Talk', 'Web', 'danger', 525, 105, 709,
 'The desk ignores elevates from its own origin — too many forged widgets. It only listens to a speaker that has no origin at all. Build that speaker, load it below, and make it ask for elevation.',
 null, '/challenge/cross-talk', 1, 7, false, true),

('d7_flash_seat', 'Flash Seat', 'Web', 'danger', 550, 110, 710,
 'The desk lets a guest reserve a seat, then confirm it — but the confirm step is picky about who you are now versus who you were when you reserved. The window is short. Win the seat.',
 null, '/challenge/flash-seat', 1, 7, false, true);

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
('d7_inherited_trust', 'chief_clearance', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', 'f1edeb1ee66ec2b782b0a22fd6c3e9')),
('d7_cross_talk', 'null_origin_ok', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', '0f8862827f7ded2aaec38b81e5b0')),
('d7_flash_seat', 'race_won', encode(extensions.gen_random_bytes(16), 'hex'),
  jsonb_build_object('reveal_hex', '43e6c18698c461d2'));

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d7_inherited_trust', 1, 'Blocking one famous key is not the same as blocking every path that reaches the same place.', 100),
('d7_cross_talk', 1, 'Same-origin chatter is ignored on purpose. Who speaks with no origin?', 105),
('d7_flash_seat', 1, 'Reserve while ordinary. Confirm only after the lasting mark has changed — and do both before the desk forgets the reservation.', 110);
