# KGSP CTF — Database performance & retrieval (agent reference)

> **For agents.** Live project: Supabase `xehzdlfrzlokwvtcfvjx` (`meras-ctf`).  
> Last audited / fixed: **2026-07-14** (re-checked scale + Day 7 RPCs/answers against live DB). Re-run advisors + the SQL below after schema changes; update this file.  
> Companion: `.cursor/context.md` (architecture + backend digest) · skill: `manage-ctf-challenges`.

---

## Executive verdict

| Area | Status | Notes |
|------|--------|--------|
| Current speed | **Good** | Tiny dataset; hot paths stay fast |
| Index coverage | **Fixed** | Duplicate `day_entries` uniqueness removed; FK + query indexes added |
| Retrieval design | **Improved** | Realtime solve INSERT merges locally; full `fetchSolves` on reset/catch-up only |
| Security posture (RLS) | **Intentional** | Secrets tables: RLS on, **no SELECT** policies (deny-by-default) |
| Score safety | **Hardened** | `solves` / `hint_unlocks` → challenge FK **ON DELETE RESTRICT** |
| Urgency | **None** | Hygiene applied; unused-index INFO on brand-new indexes is expected |

**Scale (live 2026-07-14):** players **13** · challenges **54** · solves **143** · Day7 solves **~19** · days 8 (3–10). Day7 = 15 challenges; Day5 = 10; Day4 ≈ 9; Day6 ≈ 13.

---

## How data is retrieved (frontend → DB)

| Client call | Mechanism | Server object | Typical use |
|-------------|-----------|---------------|-------------|
| `fetchChallenges` | PostgREST `SELECT *` + `ORDER BY sort_order` | `challenges` (+ RLS) | Arena load / day refresh |
| `fetchDays` | PostgREST `SELECT *` + `ORDER BY sort_order` | `days` | Arena / admin |
| `fetchSolves` | PostgREST `SELECT *` + `ORDER BY solved_at` | `solves` | Boot, reset, catch-up |
| `fetchLeaderboard` | PostgREST view | `leaderboard` | All-time board |
| `fetchDayLeaderboard` | RPC | `day_leaderboard(p_day)` | Live day board |
| `fetchEventConfig` | PostgREST `id = 1` | `event_config` | Timer / active day |
| submit / hints / login / day code / live material / Day7 labs | RPC `SECURITY DEFINER` | various | Mutations + gated reads |
| Live updates | Realtime `postgres_changes` | solves, players, days, event_config, day_entries | Instant board |

**Client techniques:**

1. **Parallel fetch** — `Promise.allSettled` on arena boot (`useGame`).  
2. **Realtime first, poll second** — websocket + visibility / 30s revalidate.  
3. **Debounced board refresh** on mass solve deletes (admin reset).  
4. **Session cache** for challenges / days / solves / leaderboard / event.  
5. **Incremental solve merge** — on Realtime solve `INSERT`, append to local `solves` and only refetch leaderboard (`refreshBoardAfterSolve`). Full `fetchSolves()` still runs on DELETE bursts, day change, subscribe catch-up, and initial load.  
6. **Secrets never via PostgREST SELECT** — answers/flags/hints/codes only through DEFINER RPCs.

---

## Schema map (public)

| Table | PK | RLS | Client SELECT? | Role |
|-------|----|-----|----------------|------|
| `players` | `id` | yes | yes (`true`) | Identity; token auth |
| `challenges` | `id` | yes | yes (day open / past active) | Catalog |
| `challenge_flags` | `challenge_id` | yes | **no policy** | Static flags (Day 3) |
| `challenge_answer_keys` | `challenge_id` | yes | **no policy** | Dynamic answers + `live_material` |
| `challenge_hints` | `(challenge_id, hint_number)` | yes | **no policy** | Hint bodies |
| `solves` | `id` | yes | yes | Score events |
| `hint_unlocks` | `id` | yes | yes | Paid hints |
| `submission_attempts` | `id` | yes | **no policy** | Rate / audit |
| `days` | `day` | yes | yes | Day metadata |
| `day_codes` | `day` | yes | **no policy** | Access codes |
| `day_entries` | `(player_id, day)` | yes | yes | Who entered a day |
| `event_config` | `id=1` | yes | yes | Round clock |
| `admin_config` | `id=1` | yes | **no policy** | Admin secret store |
| `leaderboard` | **view** | n/a | yes | All-time aggregates |

---

## Indexes (live — post-fix)

### Core

| Index | Helps |
|-------|--------|
| `players_pkey (id)` | `_verify_player`, FKs |
| `players_username_key` | login / register |
| `challenges_pkey (id)` | joins / RPC by id |
| `solves_player_id_challenge_id_key` | unique solve + player lookup |
| `hint_unlocks (player_id, challenge_id, hint_number)` | unique unlock |
| `idx_attempts_player_time (player_id, created_at DESC)` | rate limiting / history |
| `idx_day_entries_day (day)` | day board entrants |
| `day_entries_pkey (player_id, day)` | entry uniqueness |

### Applied 2026-07-13 (`20260713_1200_db_performance_indexes.sql`)

| Change | Purpose |
|--------|---------|
| Dropped constraint/index `day_entries_player_day_uniq` | Duplicate of PK |
| `idx_solves_challenge_id` | FK / join / challenge delete |
| `idx_hint_unlocks_challenge_id` | FK / join / challenge delete |
| `idx_challenges_day_sort (day, sort_order)` | Arena filter + order |
| `idx_solves_solved_at` | `ORDER BY solved_at` on full fetch |

Advisor may report **unused_index** INFO on brand-new indexes until traffic hits them — keep them.

---

## Hot query patterns

### `_verify_player(id, token)`
Uses PK on `id` then filters token — **good**. Every mutation RPC starts here.

### `day_leaderboard(p_day)`
Entrants = `day_entries` ∪ solvers of that day’s challenges; aggregates with challenge day filter. OK at current N.

### `leaderboard` view
All-time `players ⟕ solves` group-by — fine for dozens of players.

### `challenges` RLS (`sel_challenges`)
Day `is_open` **or** past active `sort_order`. Cheap while `days` is small.

---

## RPC surface (DEFINER)

Player-facing: `register_player`, `login_player`, `submit_flag`, `unlock_hint`, `check_day_code`, `day_leaderboard`, `verify_challenge_answer`, `challenge_live_material`, `verify_reident`, `d7_blind_lookup`, `d7_leaky_user`, `d7_safe_file`.

Admin (live): `admin_add_time`, `admin_set_duration`, `admin_set_freeze`, `admin_set_finale_stage`, `admin_start_event`, `admin_stop_event` (nulls clocks + finale → STAND BY), `admin_reset`, `admin_overview`, `admin_set_day`, `admin_set_day_code`, `admin_set_day_completed`, `admin_set_active_day`, `admin_list_players`, `admin_delete_player`, `admin_delete_all_players`, `admin_set_player_excluded`, `admin_login`.

**`admin_add_time` vs `admin_set_duration`:** add/remove minutes moves `ends_at` only. Round length for the *next* start is `duration_minutes` via `admin_set_duration` (or start’s `p_minutes`). Never let add-time rewrite duration (fixed in `round_length_setting`).

Security advisor **WARN**: DEFINER RPCs executable by `anon` — **by design** (SPA anon key + `p_secret` / player token). Do not revoke execute without redesigning auth.

INFO: RLS + no policies on secrets tables — **correct**.

---

## Performance good practices

### Do

1. Mutations in DEFINER RPCs with `_verify_player` / admin secret.  
2. Merge Realtime solve INSERTs; full refetch on DELETE / catch-up.  
3. Index FK child columns before bulk-deleting parent challenges.  
4. Always `WHERE` on `UPDATE`/`DELETE` (`pg-safeupdate`).  
5. Scope resets to **active day** only.  
6. After DDL, run advisors and update this file.

### Don’t

1. Drop “unused” FK indexes right after creating them.  
2. Expose `challenge_answer_keys` / flags / day_codes via PostgREST SELECT.  
3. Replace Realtime with polling-only.  
4. Use MCP SQL with shell-like strings (WAF).

---

## Re-audit checklist (agents)

```sql
SELECT relname, n_live_tup, seq_scan, idx_scan
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY 1, 2;
```

Then MCP: `get_advisors` `performance` + `security`. Skim `src/lib/api.ts` + `src/lib/useGame.ts`.

**When to worry:** `solves` ≫ 5k or arena feels laggy → consider day-scoped solve fetch next.

---

## Change log

| Date | What |
|------|------|
| 2026-07-13 | Initial audit. |
| 2026-07-13 | Applied index hygiene migration; incremental solve merge in `useGame`; duplicate `day_entries` constraint dropped. Performance advisor clean of unindexed-FK / duplicate-index. |
