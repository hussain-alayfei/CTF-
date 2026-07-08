-- Day 5 follow-up: remove recipe/tool-chain leaks found in prompts/hints that
-- violated the platform's own "no algorithm, no tool chain, only nudge what to
-- look at" design rule (see ADMIN_MANUAL_DAY4.md / ADMIN_MANUAL_DAY5.md).
-- Applied 2026-07-08.
--
-- p_cookies prompt: named "developer tools" explicitly and spelled out the
-- decode-then-join procedure. Softened to state the goal only.
-- p_cookies hint: named all three encodings outright (base64 "web-safe
-- encoding ends with padding", "plain hexadecimal", Caesar "shifts each
-- letter by a fixed amount") — this was a bigger leak than the page copy we
-- already removed. Replaced with a nudge that doesn't name any algorithm.
-- p_zerowidth hint: spelled out the entire decode procedure (treat two
-- characters as binary 0/1, group into bytes, decode as text). Replaced with
-- a nudge toward looking at raw/invisible characters only.
-- p_onion hint: stated the exact step count ("two common text encodings")
-- and named the final operation ("combine each byte with your key", i.e. XOR).
-- Softened to a directional nudge without naming the operations.

update public.challenges set prompt =
  'Websites rarely rely on a single cookie to follow you around. This page plants one tracking ID, but it splits the ID across three different places in your own browser and lightly disguises each piece. Accept tracking, then recover all three fragments from where your browser is keeping them, decode each one, and rebuild the tracking code to submit here.'
where id = 'p_cookies';

update public.challenge_hints set body =
  'Each of the three stores hides its piece with a different, very common disguise — none need any special software, just a general-purpose decoder and a careful eye.'
where challenge_id = 'p_cookies' and hint_number = 1;

update public.challenge_hints set body =
  'The hidden message never gets rendered by the browser at all — it lives between the visible letters, right after the word "clean". Look at the raw characters, not the text you see on screen.'
where challenge_id = 'p_zerowidth' and hint_number = 1;

update public.challenge_hints set body =
  'Peel from the outside in. Two of the wrappers are things any general-purpose decoder recognizes at a glance; the last one only comes off with the session key shown on this page.'
where challenge_id = 'p_onion' and hint_number = 1;
