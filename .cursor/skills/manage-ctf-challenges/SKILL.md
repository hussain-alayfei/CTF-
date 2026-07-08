---
name: manage-ctf-challenges
description: >-
  Add, edit, or delete challenges in the KGSP CTF platform (this repo) —
  inserting new challenges/answers/hints, editing existing prompts or answers,
  or fully removing a challenge/day. Use when the user asks to add a
  challenge, change a challenge's prompt/answer/points, remove or delete a
  challenge or a whole day's content, or author a new day.
---

# Manage CTF Challenges (KGSP CTF)

All challenge content lives in Supabase (project id `xehzdlfrzlokwvtcfvjx`),
not in the frontend. Every change is a SQL migration applied via the Supabase
MCP (`apply_migration` / `execute_sql`), then committed to
`supabase/migrations/` for the repo's history. See `.cursor/context.md` for
the full schema/architecture; this skill only covers the challenge-content
workflow.

## Before any change: check live state

Always query first — don't trust `.cursor/context.md` or old migration files
for *current* content, since the live DB is the source of truth and gets
hand-edited:

```sql
select id, title, day, is_dynamic, is_extra
from public.challenges where day = <N> order by sort_order;

select challenge_id, count(*) from public.solves
where challenge_id in (<ids>) group by challenge_id; -- check for real solves
```

**If any challenge has solves > 0, ask the user before deleting or changing
its answer** — that would invalidate a player's already-recorded score or
break their ability to re-derive the flag.

## Two challenge patterns — pick correctly

**Static** (Day 3 style — simple, low-stakes): flag lives in `challenge_flags`
as plain text, checked directly by `submit_flag`.

**Dynamic** (default for anything artifact-based — Day 4/5 style, current
default for new content): the player recovers an **answer** (never
flag-shaped), submits it to `verify_challenge_answer`, which mints a
**personal flag** `KGSP{hmac(player_id, secret)[:12]}` — never a static string
anywhere. Use `challenge_answer_keys` instead of `challenge_flags`. Any
decode key that must stay out of the downloadable file goes in
`live_material` (jsonb), served only via `challenge_live_material` on the
logged-in challenge page.

Default to **dynamic** unless the user explicitly asks for a simple static
flag.

## Critical content rule — no recipes, ever

This has caused real incidents (see `ADMIN_MANUAL_DAY4.md`). Every prompt and
hint **must**:
- Never name a tool ("Wireshark", "CyberChef", "DevTools", "exiftool", "openssl").
- Never name an algorithm/encoding ("base64", "XOR", "AES", "Caesar cipher",
  "hexadecimal").
- Never spell out the step order ("first do X, then Y, then Z").
- Only nudge **what to look at** (e.g. "the file's hidden properties", "three
  different, very common disguises"), never **how** to do it.

Before shipping, grep the new prompt/hint text for tool/algorithm names and
for the plaintext answer itself. If in doubt, make the hint vaguer, not more
specific.

## Adding a challenge

1. Pick `id` (short snake_case, e.g. `net_pcap_creds`), `day`, `difficulty`
   (`easy|medium|hard|danger`), `points`, `sort_order` (unique within the day).
2. Write the SQL (dynamic pattern shown; drop `challenge_answer_keys` and add
   a `challenge_flags` row instead for static):

```sql
insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order,
   prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)
values
  ('my_new_chal', 'My Challenge', 'Category', 'medium', 200, 50, 20, 1, 4,
   false, true)
on conflict (id) do nothing;

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values ('my_new_chal', 'the_answer', encode(extensions.gen_random_bytes(16),'hex'), null)
on conflict (challenge_id) do nothing;

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values ('my_new_chal', 1, 'A nudge, not a recipe.', 40)
on conflict (challenge_id, hint_number) do nothing;
```

3. If it needs a downloadable file, add it under `public/challenges/<dayN>/`
   and set `asset_url` to that path; if it needs a bespoke page, add a route
   in `src/App.tsx` and point `action_url` there — otherwise point
   `action_url` at `/challenge/verify/<id>` (the generic
   `AnswerVerifyChallenge.tsx` page handles it).
4. Apply via `apply_migration`, save the same SQL as
   `supabase/migrations/<timestamp>_<description>.sql`, then commit.
5. Never open/unlock the day until content is verified.

## Editing a challenge

Prompt/hint/points/answer changes are a plain `update`. Preserve the
`secret` column in `challenge_answer_keys` (never regenerate it) if any
player may have already seen `verify_challenge_answer` succeed — regenerating
it invalidates every previously-issued personal flag for that challenge.

```sql
update public.challenges set prompt = '...' where id = 'my_new_chal';
update public.challenge_hints set body = '...' where challenge_id = 'my_new_chal' and hint_number = 1;
```

Apply via MCP, save the migration file, commit.

## Deleting a challenge (or a whole day's challenges)

Check solve counts first (see "Before any change" above) and tell the user if
any are non-zero. Delete in FK-safe order — children before the parent row:

```sql
delete from public.submission_attempts where challenge_id in (<ids>);
delete from public.hint_unlocks        where challenge_id in (<ids>);
delete from public.solves              where challenge_id in (<ids>);
delete from public.challenge_answer_keys where challenge_id in (<ids>); -- if dynamic
delete from public.challenge_flags       where challenge_id in (<ids>); -- if static
delete from public.challenge_hints     where challenge_id in (<ids>);
delete from public.challenges          where id in (<ids>);
```

When deleting **all** challenges for a day: leave the `days` row, its
`day_codes` entry, and `day_entries` alone unless the user explicitly asks to
wipe the day itself — those track legitimate history/roster, and the day slot
can be re-authored later.

Then remove any now-orphaned frontend pieces:
- A bespoke challenge page (e.g. `src/pages/XChallenge.tsx`) and its route in
  `src/App.tsx`, if nothing else uses it.
- Downloadable artifacts under `public/challenges/<dayN>/` for the deleted ids.
- A generator script under `scripts/` if it only built that day's artifacts.
- Any instructor answer-key doc (`ADMIN_MANUAL_DAY<N>.md`) that's now fully
  stale — delete it rather than leaving wrong answers on file.

Apply the delete SQL via `apply_migration`, save it under
`supabase/migrations/`, update `.cursor/context.md`'s "Current state" section
to reflect the new reality, `npm run build` to confirm the frontend still
compiles, then commit and push to `master` to deploy.

## Verification checklist

- [ ] Grepped prompt/hints for tool names, algorithm names, and the plaintext
      answer — none leaked.
- [ ] `npm run build` passes with no type errors.
- [ ] `grep -r` the repo for the deleted challenge id(s) — no leftover
      references in `src/`.
- [ ] Migration file saved under `supabase/migrations/` with a clear name.
- [ ] `.cursor/context.md` updated if the day's overall content changed.
