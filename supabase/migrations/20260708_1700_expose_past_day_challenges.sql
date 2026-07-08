-- Expose challenges from days that are behind the active day in sort_order, so
-- players can see (and practice) completed challenges even after the day is locked.
-- Future days (higher sort_order than active) remain hidden.
drop policy if exists sel_challenges on public.challenges;
create policy sel_challenges on public.challenges for select to anon, authenticated
using (
  exists (select 1 from public.days d where d.day = challenges.day and d.is_open)
  or (
    challenges.day in (
      select dd.day from public.days dd
      where dd.sort_order < (
        select coalesce(
          (select sort_order from public.days where day = ec.active_day),
          0
        )
        from public.event_config ec where ec.id = 1
      )
    )
  )
);
