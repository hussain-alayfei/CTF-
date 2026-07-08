-- Day 5 (Privacy) rebuilt as 10 exploratory challenges:
-- 3 easy, 5 medium, 2 hard.
-- Every challenge is dynamic (per-player flag minted server-side).
-- Prompts/hints intentionally avoid tool-by-tool recipes.

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order, prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
  ('p5_cookie_trail','Cookie Flag Trail','Web Privacy','easy',150,50,501,
   'A consent page stores one tracking token across three browser stores after you accept tracking. Recover every fragment from your own browser state, normalize each fragment, then combine them in the right order to rebuild the recovery value.',
   '/challenges/day5/cookie-trail.html','/challenge/verify/p5_cookie_trail',1,5,false,true),
  ('p5_firefox_profile_hunt','Firefox Profile Hunt','Browser Forensics','easy',170,50,502,
   'You received a triage export from a Firefox profile. It includes cookies, history, and downloads from the same workstation. Correlate those sections to recover the archive label used by the operator.',
   '/challenges/day5/firefox-profile-dump.txt','/challenge/verify/p5_firefox_profile_hunt',1,5,false,true),
  ('p5_consent_trap','Consent Trap','Web Privacy','easy',180,50,503,
   'This consent banner pretends to respect privacy, but one exact combination of choices unlocks the value you need. Interact with the page, inspect what state is written, and recover the resulting token.',
   '/challenges/day5/consent-trap.html','/challenge/verify/p5_consent_trap',1,5,false,true),
  ('p5_gpc_unlock','DNT/GPC Unlock','Headers / Privacy Signals','medium',240,50,504,
   'A request gateway captured multiple attempts against the same endpoint. Only one request was treated as privacy-preserving and returned the unlock token. Identify that request and recover its token.',
   '/challenges/day5/request-gateway.log','/challenge/verify/p5_gpc_unlock',1,5,false,true),
  ('p5_history_reconstruction','History Reconstruction','Browser Forensics','medium',260,50,505,
   'A browsing timeline was exported in messy order from a shared workstation. Reconstruct the true chronology and identify the final high-sensitivity destination to recover its evidence code.',
   '/challenges/day5/history-reconstruction.json','/challenge/verify/p5_history_reconstruction',1,5,false,true),
  ('p5_tracker_hunter','Tracker Hunter','Web Tracking Analysis','medium',280,50,506,
   'A traffic archive includes first-party and third-party requests. Isolate the cross-site tracker activity, recover the three hidden fragments from those tracker records, and combine them to form the answer.',
   '/challenges/day5/tracker-hunter.har','/challenge/verify/p5_tracker_hunter',1,5,false,true),
  ('p5_storage_split','Local Storage Split Flag','Storage Forensics','medium',290,50,507,
   'A browser snapshot split one recovery string across cookie, local storage, and cache records with light obfuscation. Rebuild the original value from those three stores.',
   '/challenges/day5/storage-split.txt','/challenge/verify/p5_storage_split',1,5,false,true),
  ('p5_metadata_leak','Metadata Leak','OSINT / Metadata','medium',310,50,508,
   'A sanitized media export removed visible references, but file metadata still leaks both the internal briefing name and the operator codename. Recover both fields and submit in lowercase with underscores.',
   '/challenges/day5/metadata-leak-exif.txt','/challenge/verify/p5_metadata_leak',1,5,false,true),
  ('p5_fingerprint_spoof','Fingerprint Spoof Lite','Fingerprinting','hard',420,75,509,
   'A fingerprint gate logged several browser profiles and issued one encoded token per profile. Match the captured profile that aligns with the target session material shown on the live challenge page, then decode its token.',
   '/challenges/day5/fingerprint-gate.json','/challenge/verify/p5_fingerprint_spoof',1,5,false,true),
  ('p5_tor_access_gate','Tor Access Gate','Tor / Access Control','hard',450,75,510,
   'A gateway log records multiple access attempts. Only one path met all anonymity checks and returned an encoded payload. Recover that payload and transform it using the session key shown on this challenge page.',
   '/challenges/day5/tor-access-gate.log','/challenge/verify/p5_tor_access_gate',1,5,false,true)
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
  ('p5_cookie_trail','trail_of_crumbs',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_firefox_profile_hunt','silentfox_archive',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_consent_trap','reject_all_trackers',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_gpc_unlock','privacy_signal_seen',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_history_reconstruction','clinic_portal_last',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_tracker_hunter','pixel_shadow_found',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_storage_split','shards_reunited',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_metadata_leak','midnight_lab_sparrow',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_fingerprint_spoof','mask_matches_profile',encode(extensions.gen_random_bytes(16),'hex'),
    '{"timezone":"UTC+03","language":"ar-SA","screen":"1280x720"}'::jsonb),
  ('p5_tor_access_gate','onion_gate_passed',encode(extensions.gen_random_bytes(16),'hex'),
    '{"xor_key_hex":"21"}'::jsonb)
on conflict (challenge_id) do update set
  answer = excluded.answer,
  live_material = excluded.live_material;

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
  ('p5_cookie_trail',1,'All three fragments are written only after consent is accepted, and each browser store uses a different lightweight disguise.',25),
  ('p5_firefox_profile_hunt',1,'One section gives a label and another gives where it was archived. Normalize casing and separators before combining.',25),
  ('p5_consent_trap',1,'Only optional trackers need to be denied; the token appears in client-side state when the correct combination is applied.',25),
  ('p5_gpc_unlock',1,'Compare the request headers across attempts. The accepted request includes an extra privacy signal and returns an encoded token.',40),
  ('p5_history_reconstruction',1,'Sort by timestamp first, then focus only on high-sensitivity destinations. The latest one carries the code.',40),
  ('p5_tracker_hunter',1,'Ignore first-party traffic. Each third-party tracker contributes exactly one fragment, each in a different common encoding.',40),
  ('p5_storage_split',1,'The cookie fragment is ready after decoding, the local-storage fragment is reversed, and the cache fragment is shifted by one letter.',40),
  ('p5_metadata_leak',1,'Ignore the technical fields. Two human-written fields matter: the internal briefing name and the author codename. Submit them together, lowercase, joined by an underscore.',50),
  ('p5_fingerprint_spoof',1,'Use the live session profile values to select the correct row in the file, then decode only that row''s token.',60),
  ('p5_tor_access_gate',1,'Only one log entry passes every gate and returns a hex payload. Apply the single-byte key shown on the challenge page.',60)
on conflict (challenge_id, hint_number) do update set
  body = excluded.body,
  penalty = excluded.penalty;

-- Keep Day 5 code-gated by default (instructor may change this in /admin).
insert into public.day_codes (day, code)
values (5, 'PRIVACY-2026')
on conflict (day) do update set code = excluded.code;

update public.days
   set requires_code = true
 where day = 5;
