-- Migration: give every future day (6-10) an initial access code so the whole
-- roadmap is code-gated out of the box. Days 3-5 already have codes
-- (SECURING-DATA / Securing-Networks / PRIVACY-2026) and are preserved by the
-- `on conflict (day) do nothing` guard. Instructors can change any code later
-- from the Days tab in /admin. Applied 2026-07-08.

insert into public.day_codes (day, code) values
  (6,  'PENTESTING-2026'),
  (7,  'WEB-2026'),
  (8,  'WEBHACK-2026'),      -- distinct from Day 7 (was a WEB-2026 collision)
  (9,  'BLOCKCHAIN-2026'),
  (10, 'SMART-2026')
on conflict (day) do nothing;

update public.days
   set requires_code = true
 where day in (6, 7, 8, 9, 10);
