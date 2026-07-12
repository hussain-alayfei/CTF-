-- Make score loss structurally impossible.
--
-- `solves.challenge_id` and `hint_unlocks.challenge_id` were ON DELETE CASCADE, so
-- the repo's standard content-migration pattern —
--     delete from public.challenges where id in (...);  insert into public.challenges ...
-- — silently deleted every solve for those challenges. The Day-6 v2 migration used
-- exactly this pattern; it only escaped destroying the round's scores because it
-- happened to run 71 seconds before the first solve landed.
--
-- Flipping these two FKs to RESTRICT turns that silent data loss into a loud error.
-- To legitimately retire a challenge that has been solved you must now delete its
-- solves first — a conscious, visible act rather than an invisible side effect.
--
-- NOT changed (these stay CASCADE on purpose): challenge_flags, challenge_hints,
-- challenge_answer_keys. Those are challenge-owned *content*, not player data, and
-- they should follow the challenge when it is dropped.
--
-- Safe for the existing admin flows: admin_reset(p_day) and admin_delete_all_players
-- both delete from solves / hint_unlocks DIRECTLY before touching anything else, so
-- they never rely on the challenge cascade.
begin;

alter table public.solves
  drop constraint solves_challenge_id_fkey,
  add  constraint solves_challenge_id_fkey
       foreign key (challenge_id) references public.challenges(id) on delete restrict;

alter table public.hint_unlocks
  drop constraint hint_unlocks_challenge_id_fkey,
  add  constraint hint_unlocks_challenge_id_fkey
       foreign key (challenge_id) references public.challenges(id) on delete restrict;

commit;
