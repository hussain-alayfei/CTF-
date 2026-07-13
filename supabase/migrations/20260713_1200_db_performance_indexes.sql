-- DB performance hygiene (2026-07-13 audit): drop duplicate uniqueness + add FK/query indexes.
-- Safe / no behavior change. PK on day_entries already enforces (player_id, day).

ALTER TABLE public.day_entries DROP CONSTRAINT IF EXISTS day_entries_player_day_uniq;
DROP INDEX IF EXISTS public.day_entries_player_day_uniq;

CREATE INDEX IF NOT EXISTS idx_solves_challenge_id
  ON public.solves (challenge_id);

CREATE INDEX IF NOT EXISTS idx_hint_unlocks_challenge_id
  ON public.hint_unlocks (challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenges_day_sort
  ON public.challenges (day, sort_order);

CREATE INDEX IF NOT EXISTS idx_solves_solved_at
  ON public.solves (solved_at);
