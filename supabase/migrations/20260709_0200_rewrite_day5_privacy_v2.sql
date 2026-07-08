-- Day 5 (Privacy) v2 — full rewrite: 3 easy / 4 medium / 2 hard / 1 danger
-- Removes AI-trivial v1 challenges (plaintext in URLs/logs/JSON/HTML source).

delete from public.submission_attempts where challenge_id like 'p5_%';
delete from public.hint_unlocks where challenge_id like 'p5_%';
delete from public.solves where challenge_id like 'p5_%';
delete from public.challenge_answer_keys where challenge_id like 'p5_%';
delete from public.challenge_hints where challenge_id like 'p5_%';
delete from public.challenges where id like 'p5_%';

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order, prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
  ('p5_cache_phantom','Cache Phantom','Web Privacy','easy',160,50,501,
   'A marketing page scattered tracking residue across three browser stores after consent. Open the live page, accept tracking, then recover every shard from your own session and rebuild the archive label.',
   null,'/challenge/cache-phantom',1,5,false,true),
  ('p5_bookmark_vault','Bookmark Vault','Browser Forensics','easy',170,50,502,
   'Analysts seized a real browser places database from a privacy investigation. Find the sensitive bookmark the operator tried to hide among routine intranet links and recover the route slug from its destination.',
   '/challenges/day5/places.sqlite','/challenge/verify/p5_bookmark_vault',1,5,false,true),
  ('p5_consent_labyrinth','Consent Labyrinth','Web Privacy','easy',180,50,503,
   'This consent wizard hides a recovery value behind an exact privacy posture. Walk every step, deny what should stay off, keep only what is truly required, then read what the page stored for your session.',
   null,'/challenge/consent-labyrinth',1,5,false,true),
  ('p5_profile_archive','Profile Archive','Browser Forensics','medium',250,50,504,
   'A triage ZIP bundles cookies, downloads, and visit history from the same workstation. Correlate which archive the operator actually retrieved — submit the pack label, lowercase with underscores.',
   '/challenges/day5/browser-profile.zip','/challenge/verify/p5_profile_archive',1,5,false,true),
  ('p5_dns_whisper','DNS Whisper','Network Privacy','medium',270,50,505,
   'A packet capture was taken while a user believed DNS was private. Most queries are routine CDN noise — identify the sensitive internal name that kept leaking and submit it with dots replaced by underscores.',
   '/challenges/day5/dns-whisper.pcap','/challenge/verify/p5_dns_whisper',1,5,false,true),
  ('p5_tracker_ghost','Tracker Ghost','Web Tracking','medium',285,50,506,
   'A HAR export mixes first-party page loads with cross-site trackers. Isolate third-party calls in time order, recover the three trace shards from their response headers, and rebuild the label they spell.',
   '/challenges/day5/tracker-ghost.har','/challenge/verify/p5_tracker_ghost',1,5,false,true),
  ('p5_briefing_carve','Hidden Briefing','File Carving','medium',300,50,507,
   'A sanitized briefing image still renders normally, but analysts reported trailing payload bytes. Recover the inner note and transform it with the session key shown on this page.',
   '/challenges/day5/briefing-snapshot.png','/challenge/verify/p5_briefing_carve',1,5,false,true),
  ('p5_mask_match','Mask Match','Fingerprinting','hard',430,75,508,
   'A surveillance export lists several observed browser masks. Align your live browser with the session brief on the challenge page, identify the matching row in the download, decode its token, and submit it.',
   '/challenges/day5/mask-capture.json','/challenge/mask-match',1,5,false,true),
  ('p5_exit_witness','Exit Witness','Tor / Traffic Analysis','hard',460,75,509,
   'A capture mixes high-volume anonymity traffic with one cleartext proxy report. Find the accepted POST body, then transform it with the session key on this page.',
   '/challenges/day5/exit-witness.pcap','/challenge/verify/p5_exit_witness',1,5,false,true),
  ('p5_reidentified','Re-Identified','De-anonymization','danger',580,100,510,
   'An anonymous export and a public roll share quasi-identifiers. Cross-match to the unique subject, recover their analyst note payload, and transform it with the session key on this page.',
   '/challenges/day5/reident-kit.zip','/challenge/verify/p5_reidentified',1,5,false,true);

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
  ('p5_cache_phantom','crumbs_trail',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_bookmark_vault','route_17',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_consent_labyrinth','narrow_path',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_profile_archive','midnight_export',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_dns_whisper','internal_clinic_net',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_tracker_ghost','shadow_pixel',encode(extensions.gen_random_bytes(16),'hex'),null),
  ('p5_briefing_carve','leaked_briefing_pack',encode(extensions.gen_random_bytes(16),'hex'),
    '{"xor_key_hex":"3a"}'::jsonb),
  ('p5_mask_match','profile_aligned',encode(extensions.gen_random_bytes(16),'hex'),
    '{"timezone":"Asia/Riyadh","language":"ar-SA","screen":"1366x768"}'::jsonb),
  ('p5_exit_witness','witness_confirmed',encode(extensions.gen_random_bytes(16),'hex'),
    '{"xor_key_hex":"21"}'::jsonb),
  ('p5_reidentified','subject_unmasked',encode(extensions.gen_random_bytes(16),'hex'),
    '{"xor_key_hex":"7c"}'::jsonb);

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
  ('p5_cache_phantom',1,'Shards land in three different persistence layers for this origin — none are visible on the page itself.',25),
  ('p5_bookmark_vault',1,'Query the bookmark titles against their destinations. One title is operational, not routine policy reading.',25),
  ('p5_consent_labyrinth',1,'Optional sharing and analytics should be off; fraud monitoring and strictly necessary storage stay on.',25),
  ('p5_profile_archive',1,'The cookie domain, the completed download filename, and the last sensitive visit all describe the same archive.',40),
  ('p5_dns_whisper',1,'Filter for names that are not public CDNs. The leakiest internal hostname repeats across the capture.',40),
  ('p5_tracker_ghost',1,'Ignore first-party hosts. Third-party responses carry one shard each — order matters.',40),
  ('p5_briefing_carve',1,'The image renders fine because the payload sits after the image end marker. The inner file is masked with one byte.',50),
  ('p5_mask_match',1,'Live alignment must hit 100% before the capture row makes sense. That row''s token is compressed and masked.',60),
  ('p5_exit_witness',1,'Most flows are encrypted noise toward anonymity relays. One plain HTTP POST to an internal proxy stands out.',60),
  ('p5_reidentified',1,'Only one anonymous row matches exactly one public record on age, postal code, and gender. Their note bytes are on the analyst sheet.',75);

insert into public.day_codes (day, code)
values (5, 'PRIVACY-2026')
on conflict (day) do update set code = excluded.code;

update public.days set requires_code = true where day = 5;
