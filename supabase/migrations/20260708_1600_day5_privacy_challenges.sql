-- Migration: Day 5 (Privacy) — 6 per-player dynamic challenges.
-- Applied 2026-07-08. Day 5 stays locked (is_open=false) and code-gated until
-- go-live. Answers live only in challenge_answer_keys; the downloadable
-- artifacts (public/challenges/day5/, built by scripts/gen-day5-artifacts.py)
-- contain NO plaintext answer and nothing flag-shaped. The two hardest need a
-- key delivered live via challenge_live_material (never in the file).

insert into public.challenges (id,title,category,difficulty,points,first_blood_bonus,sort_order,prompt,asset_url,action_url,num_hints,day,is_extra,is_dynamic) values
('p_cookies','Cookie Crumbs','Web Privacy','easy',150,50,501,
 'Websites rarely rely on a single cookie to follow you around. This page plants one tracking ID, but it splits the ID across three different places in your own browser and lightly disguises each piece. Open the tracking page, accept tracking, then use your browser developer tools to recover all three fragments, decode each one, and join them in order to rebuild the tracking code. Submit the rebuilt code here to claim your flag.',
 null,'/challenge/cookie-crumbs',1,5,false,true),
('p_metadata','Metadata Betrayal','OSINT / Metadata','medium',250,50,502,
 'A foundation published this press release as a PDF and carefully removed the sensitive wording from the visible page. They forgot that a file also carries its own hidden properties. Recover who really wrote the document and the location it was prepared for. The answer is the venue common name, then an underscore, then the author codename, all lowercase with underscores instead of spaces. Example format: golden_gate_bridge_falcon.',
 '/challenges/day5/press-release.pdf','/challenge/verify/p_metadata',1,5,false,true),
('p_tor_exit','Exit Node Eyes','Tor / Anonymity','medium',300,50,503,
 'A volunteer ran a Tor exit relay and recorded the traffic leaving it. Almost everything is encrypted and unreadable. But one person logged in to a website over plain, unencrypted HTTP, trusting that Tor by itself kept them private. Remember: Tor hides who you are, not what you send to an unencrypted site. Recover the password that leaked through the exit node.',
 '/challenges/day5/tor-exit.pcap','/challenge/verify/p_tor_exit',1,5,false,true),
('p_zerowidth','Zero-Width Whisper','Covert Channels','hard',400,50,504,
 'This internal memo looks like ordinary text, but privacy and data-loss teams know that plain text can smuggle a hidden message that is invisible on screen. Something is written between the visible characters. Extract the hidden message.',
 '/challenges/day5/memo.txt','/challenge/verify/p_zerowidth',1,5,false,true),
('p_onion','Peeling the Onion Router','Tor / Crypto','hard',400,50,505,
 'A single Tor cell was captured in the middle of its circuit. Just like onion routing, its contents are wrapped in several layers, one on top of another. Peel every layer to read the message inside. The session key needed for the final layer is shown on this challenge page and is deliberately not included in the downloaded file.',
 '/challenges/day5/onion.txt','/challenge/verify/p_onion',1,5,false,true),
('p_deanon','The De-Anonymizer','De-anonymization','danger',600,75,506,
 'A company released a dataset it advertised as anonymous, with names stripped out and replaced by ID codes. Prove why removing names is not enough. Cross-reference the anonymized export with the public voter roll to re-identify the person named Rania Alharbi, then recover the private note attached to her record. The note is obscured with a key that this challenge page issues to you.',
 '/challenges/day5/deanon.zip','/challenge/verify/p_deanon',1,5,false,true)
on conflict (id) do update set title=excluded.title, category=excluded.category, difficulty=excluded.difficulty, points=excluded.points, first_blood_bonus=excluded.first_blood_bonus, sort_order=excluded.sort_order, prompt=excluded.prompt, asset_url=excluded.asset_url, action_url=excluded.action_url, num_hints=excluded.num_hints, day=excluded.day, is_extra=excluded.is_extra, is_dynamic=excluded.is_dynamic;

-- Answer keys. secret is generated in-DB; on re-run the secret is preserved.
insert into public.challenge_answer_keys (challenge_id,answer,secret,live_material) values
('p_cookies','st0p_tr4ck1ng_m3', encode(extensions.gen_random_bytes(16),'hex'), null),
('p_metadata','eiffel_tower_magpie', encode(extensions.gen_random_bytes(16),'hex'), null),
('p_tor_exit','exit_nodes_see_http', encode(extensions.gen_random_bytes(16),'hex'), null),
('p_zerowidth','1nv1s1bl3_1nk', encode(extensions.gen_random_bytes(16),'hex'), null),
('p_onion','thr33_h0ps', encode(extensions.gen_random_bytes(16),'hex'), '{"key_hex":"a1b2c3d4"}'::jsonb),
('p_deanon','anon_is_not_private', encode(extensions.gen_random_bytes(16),'hex'), '{"key_hex":"7e11"}'::jsonb)
on conflict (challenge_id) do update set answer=excluded.answer, live_material=excluded.live_material;

insert into public.challenge_hints (challenge_id,hint_number,body,penalty) values
('p_cookies',1,'Three stores, three disguises: one fragment is a standard web-safe encoding that ends with padding, one is plain hexadecimal, and one simply shifts each letter by a fixed amount.',25),
('p_metadata',1,'Do not read the page text. Inspect the file properties / metadata: the author field and the coordinates are both in there, and the coordinates land on a world-famous monument.',40),
('p_tor_exit',1,'The encrypted sessions are just noise. Find the one cleartext HTTP request and read its authorization header; the value looks random only because it is encoded, not encrypted.',40),
('p_zerowidth',1,'Open the raw bytes, not the rendered text. Some characters have zero width; treat two of them as binary 0 and 1, group the bits into bytes, and read them as text.',60),
('p_onion',1,'Work from the outside in: undo two common text encodings first, then combine each remaining byte with your session key.',60),
('p_deanon',1,'Only a few people are unique on the combination of zip code, birth date, and gender. Find Rania on both lists, match that combination, then use your key to reveal her note.',80)
on conflict (challenge_id,hint_number) do update set body=excluded.body, penalty=excluded.penalty;

-- Gate Day 5 behind an access code (instructor can change it in the panel). Day stays locked until go-live.
insert into public.day_codes(day,code) values (5,'PRIVACY-2026') on conflict (day) do update set code=excluded.code;
update public.days set requires_code = true where day = 5;
