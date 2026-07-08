-- Remove all 6 Day 5 (Privacy) challenges entirely. All had 0 solves, so no
-- player score is affected. Day 5 itself (the `days` row, its access code, and
-- `day_entries` — who legitimately entered the day) is left untouched; the
-- instructor may re-author new Day 5 content later using the same day slot.
-- Applied 2026-07-08.

delete from public.submission_attempts where challenge_id in
  ('p_cookies','p_metadata','p_tor_exit','p_zerowidth','p_onion','p_deanon');
delete from public.hint_unlocks where challenge_id in
  ('p_cookies','p_metadata','p_tor_exit','p_zerowidth','p_onion','p_deanon');
delete from public.solves where challenge_id in
  ('p_cookies','p_metadata','p_tor_exit','p_zerowidth','p_onion','p_deanon');
delete from public.challenge_answer_keys where challenge_id in
  ('p_cookies','p_metadata','p_tor_exit','p_zerowidth','p_onion','p_deanon');
delete from public.challenge_hints where challenge_id in
  ('p_cookies','p_metadata','p_tor_exit','p_zerowidth','p_onion','p_deanon');
delete from public.challenges where id in
  ('p_cookies','p_metadata','p_tor_exit','p_zerowidth','p_onion','p_deanon');
