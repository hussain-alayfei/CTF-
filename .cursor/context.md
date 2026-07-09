# KGSP CTF — Agent Context

Read this first. Prefer this file + the skill over re-exploring the whole repo.
Update this file when architecture, days, or challenge conventions change.

---

## Stack & IDs

| Piece | Value |
|-------|--------|
| Frontend | Vite + React 18 + TS + Tailwind SPA |
| Backend | Supabase Postgres + RLS + Realtime (**no** Supabase Auth) |
| Host | Vercel — auto-deploys on push to `master` |
| Supabase project | `xehzdlfrzlokwvtcfvjx` (`meras-ctf`) |
| Live site | `https://ctf-two-alpha.vercel.app` |

---

## Current state (2026-07-09)

| Day | Title | Status | Flag model |
|-----|-------|--------|------------|
| 3 | Securing Data | Authored, often closed | **Static** (`challenge_flags`) |
| 4 | Securing Networks | Authored | **Dynamic** (7 core + 2 extras) |
| 5 | Privacy | Authored **v3** | **Dynamic** (10: 3E / 4M / 2H / 1D) |
| 6–10 | Placeholders | Locked, empty | — |

Days 1–2 were deleted. Day numbers are plain ints (3–10).

**Day 5 IDs (v3):** `p5_cache_phantom`, `p5_bookmark_vault`, `p5_consent_labyrinth`, `p5_profile_archive`, `p5_dns_whisper`, `p5_tracker_ghost`, `p5_briefing_carve`, `p5_mask_match`, `p5_exit_witness`, `p5_reidentified`.

**Day 5 code:** `PRIVACY-2026` · Migration: `supabase/migrations/20260709_0300_rewrite_day5_privacy_v3.sql` · Artifacts: `scripts/gen-day5-artifacts.py` (also emits matching migration; keys are random per run).

**Day 4 core IDs:** `net_pcap_creds`, `net_carve_png`, `net_exif_geo`, `net_router_live`, `net_cyberchef`, `net_pcap_hunt`, `net_chain_danger` · Extras: `cookie`, `chain`.

**Admin login (player account):** `kasut_kgsp_ctf` / `kasut_kgsp_ctf` (`is_admin=true`). No separate admin password screen.

---

## Hard rules (do not violate)

### Challenge authoring (anti-AI) — default for Day 4+

1. **Dynamic flags** for anything artifact/forensics/crypto: `is_dynamic=true` → `challenge_answer_keys` (not `challenge_flags`). Personal flag = `HMAC(player_id, secret)` via `verify_challenge_answer`.
2. **Download must be incomplete for medium+.** Ciphertext in file; **high-entropy key (≥ plaintext length)** only in `live_material` / `challenge_live_material`. Never co-locate key + ciphertext in the download.
3. **Never** put tool names, algorithm names, or step recipes in prompt / hint / artifact text (no Wireshark, CyberChef, base64, XOR, AES, “first do X…”).
4. **Hints:** at most one; short nudge only (what to look at), not how.
5. **No `KGSP{…}` or plaintext answer** in artifacts or client bundle. Grep before ship.
6. **Before delete/change answers:** check `solves` counts; warn user if > 0.
7. Full workflow: `.cursor/skills/manage-ctf-challenges/SKILL.md` · Design history: `ADMIN_MANUAL_DAY4.md` · Day 5 answers: `ADMIN_MANUAL_DAY5.md`.

### Deploy / DB

- Live DB = production. Frontend ships on `master` push.
- Cross-cutting changes: **frontend first, then DB migration**.
- Apply schema/content via Supabase MCP (`apply_migration` / `execute_sql`); save SQL under `supabase/migrations/`.
- `pg-safeupdate` is on → every `UPDATE`/`DELETE` needs a `WHERE` (use `where true` for full-table).
- pgcrypto: call `extensions.crypt` / `extensions.hmac` / `extensions.gen_random_bytes`.
- MCP WAF: avoid shell-like syntax in SQL text (`nmap -p-`, backticks, `@ip`). Put commands in manuals only.
- `.gitattributes` marks `pcap|png|jpg|zip|…` binary — **never remove** (Windows CRLF corruption).

### Frontend do-not-regress

- No `mix-blend-mode` / full-viewport `backdrop-blur` over live UI (causes leaderboard shimmer).
- Arena clock: boundary `setTimeout` only — not per-second full-tree re-renders.
- `/board` first-blood sound needs a real user gesture; use `isAudioRunning()` (don’t trust mute UI alone).

---

## Identity (no Supabase Auth)

- Players: username + password + emoji; `token` uuid; mutations via `SECURITY DEFINER` RPCs that check token.
- Admin = normal player with `is_admin`; `login_player` returns `admin_token` → passed as `p_secret` to `admin_*` RPCs.
- `exclude_from_board`: test accounts hidden from boards/feed; `submit_flag` verifies but does not record.
- Secrets tables (`challenge_flags`, `challenge_answer_keys`, `challenge_hints`, `day_codes`): RLS on, **no SELECT** for clients.

---

## Schema cheat sheet

**Tables:** `players`, `challenges` (`is_dynamic`, `is_extra`, `day`, `difficulty` easy|medium|hard|danger), `challenge_flags` (static only), `challenge_answer_keys` (answer, secret, live_material), `challenge_hints`, `solves`, `hint_unlocks`, `submission_attempts`, `days`, `day_codes`, `day_entries`, `event_config` (active_day, freeze_minutes), `admin_config`.

**Player RPCs:** `register_player`, `login_player`, `submit_flag`, `unlock_hint`, `check_day_code` (also writes `day_entries`), `day_leaderboard`, `verify_challenge_answer`, `challenge_live_material`.

**Admin RPCs:** `admin_overview`, `admin_start_event`, `admin_stop_event`, `admin_reset`, `admin_set_day`, `admin_set_freeze`, `admin_set_day_code`, `admin_set_active_day`, `admin_list_players`, `admin_delete_player`, `admin_delete_all_players`.

**Board model:** live board = entrants of `active_day` via `day_entries` + `day_leaderboard`. Profile score = all-time. Finished open days = practice (don’t move live standings). Projector `/board` freezes points in last `freeze_minutes`.

---

## Where code lives

```
src/App.tsx                 routes
src/lib/api.ts              all RPCs/table calls
src/lib/useGame.ts          challenges/days/solves/board + realtime
src/pages/Play.tsx          arena
src/pages/AdminPanel.tsx    3 tabs: Event Control | Days & Challenges | Players · Day N
src/pages/Board.tsx         projector
src/pages/AnswerVerifyChallenge.tsx   /challenge/verify/:id (generic dynamic)
src/pages/RouterConsoleChallenge.tsx  Day 4 SNMP
src/pages/CookieChallenge.tsx         Day 4 extra
src/pages/CachePhantomChallenge.tsx   Day 5 live
src/pages/ConsentLabyrinthChallenge.tsx
src/pages/MaskMatchChallenge.tsx      key unlocks only at 100% live alignment
public/challenges/day4|day5/          artifacts
scripts/gen-day4-artifacts.py
scripts/gen-day5-artifacts.py          regenerates artifacts + v3 migration
supabase/migrations/                  history; live DB is source of truth
ADMIN_MANUAL.md | _DAY4.md | _DAY5.md instructor keys
.cursor/skills/manage-ctf-challenges/SKILL.md
```

**Routes:** `/` Play · `/admin` · `/board` · `/challenge/admin-panel` · `/challenge/router-console` · `/challenge/cache-phantom` · `/challenge/consent-labyrinth` · `/challenge/mask-match` · `/challenge/verify/:challengeId`

---

## Task routing (save tokens)

| User wants… | Do this |
|-------------|---------|
| Add/edit/delete challenges | Follow **manage-ctf-challenges** skill; query live DB first |
| Day 4/5 answers / how to solve | Read `ADMIN_MANUAL_DAY4.md` or `ADMIN_MANUAL_DAY5.md` — don’t invent |
| New day (6+) | Dynamic + anti-AI rules above; mix formats (live pages + binary artifacts); not all download-only text |
| Regenerate Day 5 artifacts | `python scripts/gen-day5-artifacts.py` then **re-apply** emitted migration (keys changed) |
| UI/admin/board bugs | Touch `src/pages/*` + `src/lib/*`; keep perf/sound rules |
| Commit/push | Only when user asks; push `master` deploys |

---

## Quick verify after challenge changes

```bash
npm run build
# grep dist + public/challenges for answer strings and KGSP{
```

```sql
select id, title, difficulty, is_dynamic from challenges where day = N order by sort_order;
select challenge_id, count(*) from solves where challenge_id like 'p5_%' group by 1;
```
