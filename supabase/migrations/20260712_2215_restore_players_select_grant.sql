-- Restore public read of safe player display columns.
-- Without this grant, leaderboard / day_leaderboard / solve toasts fail with
-- "permission denied for table players", and the arena's initial Promise.all
-- aborted before setChallenges — challenge cards looked dead.
revoke select on public.players from anon, authenticated;
grant select (id, username, avatar, created_at, is_admin) on public.players to anon, authenticated;

drop policy if exists sel_players on public.players;
create policy sel_players on public.players
  for select to anon, authenticated
  using (true);
