# Migration rules

## Never delete a challenge that has been solved

`solves.challenge_id` and `hint_unlocks.challenge_id` are **`ON DELETE RESTRICT`**
(see `20260712_1400_protect_scores.sql`). Deleting a challenge row that anyone has
solved now raises a foreign-key error instead of silently deleting their points.

That guard exists because the older migrations in this folder all follow this shape:

```sql
delete from public.challenges where id in ('d6_...', ...);   -- ⚠️ used to cascade into solves
insert into public.challenges ...
```

Under the old `ON DELETE CASCADE` that quietly wiped every solve for those
challenges. The Day-6 v2 migration ran this exact pattern against the live database
mid-round and only escaped destroying the leaderboard because it happened to land
71 seconds before the first solve.

## Write content migrations as upserts

To change a challenge, update it in place. Never delete-and-recreate:

```sql
insert into public.challenges (id, title, points, prompt, ...)
values ('d6_jwt_read', 'Token Inspector', 200, '...', ...)
on conflict (id) do update set
  title  = excluded.title,
  points = excluded.points,
  prompt = excluded.prompt;
```

`challenge_answer_keys` and `challenge_hints` already use `on conflict … do update`;
follow the same pattern for `challenges` itself.

## Retiring a challenge that has solves

This is now a deliberate, two-step act — which is the point:

```sql
-- You are about to destroy player scores. Check first:
select count(*) from public.solves where challenge_id = 'x';

-- Only if that is acceptable (e.g. zero, or the event is over and you mean it):
delete from public.solves       where challenge_id = 'x';
delete from public.hint_unlocks where challenge_id = 'x';
delete from public.challenges   where id = 'x';
```

If a challenge is merely being replaced, prefer hiding it (`is_extra`, or move it to
an unused `day`) over deleting it. Points already earned stay earned.

## Before applying anything to the live database

1. Is a round running right now? `select starts_at, ends_at, now() from public.event_config;`
   Don't swap challenges out from under players mid-round.
2. Will it touch `solves`? If yes, say so out loud and get a yes.
