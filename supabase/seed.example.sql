-- ============================================================
--  KGSP CTF — seed TEMPLATE (challenge content)
--
--  This is a template. Copy it to seed.sql, fill in your own
--  flags/hints (the REPLACE_ME_* placeholders), and run it once
--  against your Supabase project after schema.sql.
--
--  Keep your real seed.sql OUT of git so students can't read the
--  flags — the live database is the only place they should exist.
-- ============================================================

-- 1) Set your admin secret (used by the /admin panel):
insert into public.admin_config (id, secret)
values (1, 'REPLACE_ME_ADMIN_SECRET')
on conflict (id) do update set secret = excluded.secret;

-- 1b) Day roadmap (Day 1 open today; add/lock more days as you like):
insert into public.days (day,title,subtitle,is_open,event_label,sort_order) values
  (1,'Day 1 — Foundations','Encoding, ciphers, steganography, hashing & web basics', true,  'Today · live', 1),
  (2,'Day 2','New challenges — unlock from the instructor dashboard', false, 'Locked', 2),
  (3,'Day 3','New challenges — unlock from the instructor dashboard', false, 'Locked', 3)
on conflict (day) do nothing;

-- 2) Challenges (metadata is not secret).
insert into public.challenges (id,title,category,difficulty,points,first_blood_bonus,sort_order,num_hints,asset_url,action_url,prompt) values
('base64','Not Encryption','Crypto','easy',100,50,1,2,null,null,
 'Decode the intercepted string. It is encoded, not encrypted. (Put the Base64 of your flag here.)'),
('caesar','Caesar''s Secret','Crypto','easy',100,50,2,2,null,null,
 'Shift the letters back. (Put the ROT13/Caesar text of your flag here.)'),
('stego','Hidden in Plain Sight','Stego','easy',150,50,3,2,'/challenges/hidden.png',null,
 'A flag is hidden inside the downloadable image, not in the visible pixels.'),
('hash','Crack Me','Hashing','medium',250,50,4,2,null,null,
 'Crack this weak password hash. (Put your MD5 here.) Flag is KGSP{the_password}.'),
('cookie','Trust No Cookie','Web','medium',300,50,5,2,null,'/challenge/admin-panel',
 'Promote yourself to admin by editing a cookie in your own browser.'),
('chain','The Deep Web','Recon','hard',500,100,6,3,null,null,
 'Start at /robots.txt and follow the trail: decode, find the hidden page, extract the flag from its image.')
on conflict (id) do update set
  title=excluded.title, category=excluded.category, difficulty=excluded.difficulty,
  points=excluded.points, first_blood_bonus=excluded.first_blood_bonus, sort_order=excluded.sort_order,
  num_hints=excluded.num_hints, asset_url=excluded.asset_url, action_url=excluded.action_url, prompt=excluded.prompt;

-- 3) Flags (SECRET — fill these in).
insert into public.challenge_flags (challenge_id,flag) values
('base64','KGSP{REPLACE_ME}'),
('caesar','KGSP{REPLACE_ME}'),
('stego','KGSP{REPLACE_ME}'),
('hash','KGSP{REPLACE_ME}'),
('cookie','KGSP{REPLACE_ME}'),
('chain','KGSP{REPLACE_ME}')
on conflict (challenge_id) do update set flag=excluded.flag;

-- 4) Hints (SECRET — one row per hint; penalty is points off that challenge).
--    Add rows like:
-- insert into public.challenge_hints (challenge_id,hint_number,body,penalty) values
--   ('base64',1,'Those = signs hint at a common encoding with a number in its name.',15),
--   ('base64',2,'Search "Base64 decode" and paste the string.',25);
