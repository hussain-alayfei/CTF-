# src/ map — where is X?

One-page guide for agents. `src/` is organised by **domain**, not by file type.
Read this before searching, then open the specific file you need.

## Import alias

`@/` resolves to `src/` (set in `vite.config.ts` and `tsconfig.app.json`).
Import across folders with `@/…`; keep same-folder imports relative (`./x`).

```ts
import { useGame } from '@/lib/useGame';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
```

This means files can move between domain folders without rewriting deep `../../`
paths — only the moved file's own same-folder imports ever need a look.

## The tree

```
src/
  app/            bootstrap: main.tsx (entry), App.tsx (routes only), index.css
  lib/            platform primitives — NO day/challenge-specific code
  arena/          the live student surface (Play) + projector (Board) + its components/
  admin/          instructor panel (AdminPanel) + ConfirmDialog
  challenges/
    shared/       reusable lab chrome + the generic verify page
    day4/ day5/   per-day challenge pages (+ that day's helper .ts)
    day7/ day8/   browser-first live labs
    day9/         15 server-tracked blockchain labs + daynine.ts catalog
```

## Where is X?

| I want to change… | Go to |
|-------------------|-------|
| Routes / top-level wiring | `app/App.tsx` |
| App entry / providers / audio unlock / theme | `app/App.tsx`, `app/main.tsx` |
| Any Supabase RPC or table call | `lib/api.ts` |
| Realtime feed, solves/board merge, catch-up | `lib/useGame.ts` |
| Countdown / freeze / phase colours | `lib/time.ts` + `lib/useCountdown.ts` |
| Types (Challenge, Day, EventConfig, Player…) | `lib/types.ts` |
| Session cache (stale-while-revalidate) | `lib/cache.ts` |
| Sounds / audio gesture unlock | `lib/sounds.ts` |
| The arena (day sections, code gate, finale wiring, GO! intro) | `arena/Play.tsx` |
| The projector board | `arena/Board.tsx` |
| Challenge modal (opens before every live lab) | `arena/components/ChallengeModal.tsx` |
| Timer banner / board clock | `arena/components/Timer.tsx` |
| Leaderboard / toasts / header / profile / register / GO! / finale | `arena/components/` |
| Instructor Event Control, Days, Players | `admin/AdminPanel.tsx` |
| In-app confirm dialog (admin + hint unlock) | `admin/ConfirmDialog.tsx` |
| Reusable lab shell / answer submit box / prompt renderer | `challenges/shared/` |
| Generic dynamic verify page (`/challenge/verify/:id`) | `challenges/shared/AnswerVerifyChallenge.tsx` |
| A Day 4 lab | `challenges/day4/` |
| A Day 5 lab or its crypto/data helpers | `challenges/day5/` (`dayfive.ts`, `reidentData.ts`) |
| A Day 7 lab or its helpers | `challenges/day7/` (`dayseven.ts`) |
| A Day 8 web-hacking lab | `challenges/day8/` (`dayeight.ts`) |
| A Day 9 blockchain lab | `challenges/day9/` (`BlockchainChallenge.tsx`, `daynine.ts`) |
| A Day 10 final CTF lab | `challenges/day10/` (`dayten.ts` + live lab pages) |

## Rules that still apply

- Routes live only in `app/App.tsx`; Admin and Board are **in-page overlays** from
  `arena/Play.tsx`, never routes (a route change remounts the realtime sub).
- Challenge **content** (prompts/answers/hints) lives in Supabase, not here — see
  `.cursor/skills/manage-ctf-challenges/SKILL.md`.
- Never put a plaintext answer or `KGSP{` in any file under `src/`.
- Architecture + backend digest: `.cursor/context.md`. DB/indexes: `.cursor/db-performance.md`.
