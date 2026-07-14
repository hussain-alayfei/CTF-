# KGSP CTF — working rules

A live classroom CTF. A round is played by real students, in one room, once. There is
no staging environment and no second take: a bug here doesn't fail a test, it ruins an
event that is happening right now, in front of people.

Every rule below is written because that rule was already broken once. Read them before
changing anything.

---

## 1. Never destroy player scores

Scores are students' real earned points in a live competition. Deleting them is not a
bug to fix later — it is unrecoverable.

- **Content migrations upsert. They never delete.**
  `insert … on conflict (id) do update set …` — never `delete from challenges` +
  re-insert. That pattern (used by ~7 migrations in this repo) silently cascaded into
  `solves` and wiped every point earned on those challenges.
- `solves.challenge_id` and `hint_unlocks.challenge_id` are **`ON DELETE RESTRICT`**.
  A destructive delete now raises a foreign-key error. **Do not "fix" that error by
  deleting solves.** Stop and ask.
- Before touching the live database, check whether a round is running
  (`select starts_at, ends_at, now() from event_config`) and whether the change touches
  `solves`. If it does: say so plainly and get an explicit yes.
- A zero-solve count is not permission. The Day-6 migration was "safe" only because it
  happened to run 71 seconds before the first solve.

See `supabase/migrations/README.md`.

## 2. A setting the user can edit must be saved

If there is an input, there is a row it writes to. "Round length" was local component
state that only Start happened to read — typing a value and refreshing threw it away, so
the field was read-only in practice and looked broken, because it *was* broken.

And **one action must not silently rewrite another's setting**: `admin_add_time` used to
overwrite `duration_minutes` with the running round's elapsed span, so every "+15 min"
permanently redefined the round length. That is how it became 188.

## 3. Nothing changes state on a timer

There was an auto-lock that closed the active day 30 minutes after a round ended. It
locked the day out from under a class that was still practising, and the arena then
nagged about a lock nobody asked for.

Locking, resetting, deleting, closing — these are **decisions**. A human makes them, by
pressing a button, on purpose. Timers may show things. They may not decide things.

## 4. Every screen must survive a refresh

Assume any screen can be reloaded, at any moment, mid-event. It usually will be.

- **A "moment" is edge-triggered, never mount-triggered.** Countdowns, reveals, fanfares,
  the GO! intro, the winner takeover — these fire on a *transition* (state A → state B)
  observed live. They must never fire because a component mounted into state B. The
  finale used to drop a refreshing screen straight into the champion takeover with no
  exit; the GO! overlay had the same bug before it.
- **Persisted UI state must be scoped to its lifetime.** `finale_stage` sits in the
  database until the next round starts, so last round's `3` was still there days later,
  reopening the results over the arena on every single visit. If state outlives the
  thing it describes, gate it (`!staleEnded`) or clear it.
- Refreshing must always be able to reach a normal screen. If a layer can appear on
  mount, it needs an obvious way out.

## 5. Animations terminate

Every `requestAnimationFrame` loop, interval and sound sequence must end on its own and
be cancelled on unmount. The fireworks launched new shells *forever* and boomed on half
of them — refreshing on the winner's screen left an infinite, un-leavable barrage
pegging the CPU. A show is a moment, not a screensaver.

## 6. Realtime is the fast path, not the only path

A dropped websocket (closed lid, campus wifi, a Realtime hiccup) misses every event while
it is down and **never replays them**. A screen then looks live while being frozen on
whatever it knew before the drop.

So: refetch on every `SUBSCRIBED`, on focus/online/visibility, and on a slow poll while
visible. The room must converge within ~30s even if Realtime is silently dead.

## 7. Cache rules

`src/lib/cache.ts` is stale-while-revalidate over `sessionStorage`.

- **Version it.** Bump `VERSION` on any cached-shape change, or an entry written by an
  older deploy gets handed to code that no longer understands it.
- **TTL it.** The cache exists to avoid a blank screen for 200ms — not to serve
  yesterday's leaderboard into today's round.
- **Never cache secrets.** Flags and answer keys must be stripped before writing; this
  is often a shared or projector machine and `sessionStorage` is readable from DevTools.

## 8. Layout rules that have bitten us

- **Never `justify-center` a fixed overlay that can overflow.** It pushes the top of the
  content above the viewport, where it *cannot be scrolled to*. This is what hid the
  winner on the old podium: 1st place had the tallest column, so the champion's name was
  the one thing you couldn't see. Use a `min-h-full` inner wrapper + `overflow-y-auto`.
- **No fixed-height boxes around content that can grow.** Size by content.
- **Declare subcomponents at module scope**, never inside the parent. A subcomponent
  defined inline gets a new identity every render and remounts — restarting its
  animations on every tick.
- Check the projector sizes: **1366×768** and **1280×720**. That is what the room sees.

## 9. Filters must be total

Every day must land in exactly one section. A day that was completed *and* closed *and*
active matched neither the live filter nor the finished filter — and vanished from the
arena entirely. When you write `filter(...)` over a set the user expects to see in full,
prove every element still has a home.

## 10. Verify in a browser, not in the type-checker

`npm run build` passing means nothing about whether the thing works. Every bug in this
file type-checked cleanly. Drive the actual screen — Playwright against `npm run dev`,
screenshot it, click the buttons, refresh it — before saying it's done.

Report honestly: if it wasn't checked, say it wasn't checked.

---

## Layout of the thing

`src/` is organised by domain. `@/` is an import alias for `src/`. Full map:
`src/AGENT_MAP.md`.

- `src/arena/Play.tsx` — the arena. Owns the live `game` object and mounts Board, Admin,
 Finale, and the challenge modal as **in-page overlays** (not routes — a route change
 remounts the realtime subscription).
- `src/lib/useGame.ts` — the single realtime subscription. Everything else reuses it.
- `src/lib/time.ts` + `useCountdown.ts` — one countdown model shared by arena, board and
 admin, so all three screens agree: red at 5:00, strobe through the final minute.
- `src/admin/AdminPanel.tsx` — instructor panel. Reads the event off the arena's live
 feed, so a clock change lands everywhere from the same update.
- `src/arena/Board.tsx` — projector. `src/arena/components/Finale.tsx` — the reveal.
- `src/challenges/dayN/` — per-day live labs; `src/challenges/shared/` — reusable lab chrome.
- `supabase/migrations/` — read the README there first.

Flags are always `KGSP{...}`.
