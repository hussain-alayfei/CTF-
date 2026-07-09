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

## Owner style (how Hussain wants work done)

- **Quality bar = Day 4 / Day 5 v3:** real tools, mixed formats (live pages + binary artifacts), not 10 similar “download a text file” tasks.
- **Difficulty mix when authoring a full day:** usually 3 easy (not trivial) · ~4 medium · 2 hard · 1 danger — students should *feel* the level, not steamroll via chatbot.
- **Easy ≠ spoon-fed:** still require thinking / DevTools / a real app; just shorter paths.
- **Medium+ must need the live page key** (or equivalent off-file material) — file-alone AI solve = failed design.
- **Hints:** name-level nudge only; never a recipe. Soft UI feedback > scary browser warning popups for challenge UX.
- **Ship when asked:** commit/push when he says so (often “I’m sleeping / refresh everything”); otherwise ask. Don’t leave half-deployed DB vs frontend.
- **Prefer Arabic-friendly clarity** when explaining status to him; keep agent docs in English.
- **Don’t invent answers** — manuals / live DB only. Don’t regenerate `challenge_answer_keys.secret` if players may already hold personal flags.
- **After challenge rewrites:** expect old solves for deleted IDs to be wiped; tell him clearly.

---

## Lessons learned — never repeat these bugs

These already burned us. Treat as hard bans.

### Challenge / anti-AI failures

| What went wrong | Symptom | Never again |
|-----------------|---------|-------------|
| Recipe in prompt/file/hint | AI follows our own CyberChef/AES steps | No tool/algorithm/step text in player-facing content |
| Key next to ciphertext | Upload zip → instant decrypt | Key only in `live_material` |
| 1-byte XOR / tiny key | AI brute-forces in seconds | Key ≥ plaintext length, high entropy (~48 bytes) |
| Answer in URL / log / JSON / HTML source | AI reads source or sorts JSON | No plaintext answer in downloads; opaque binary/noise |
| Flag-shaped `KGSP{…}` in artifact | `strings` / shareable static flag | Recovery **answer** only; mint flag server-side |
| All challenges = same download-text pattern | Day feels cheap; AI batch-solves | Mix live UI + sqlite/pcap/har/png/zip |
| Hard/danger still file-complete | Claude solved Mask Match / Re-Identified from upload | Gate hard ones on live alignment / off-file key |
| Hint spells the method | Hint = free solve | One vague nudge |
| Warning-style challenge UI | Feels like a broken site | Neutral in-app panels |

### Platform / ops failures

| What went wrong | Never again |
|-----------------|-------------|
| `admin_reset` wiped **all** days’ scores | Scope resets to **active day** only; verify SQL before apply |
| `.gitignore` `*.log` hid challenge logs → 404 | Don’t ignore challenge artifact extensions; check downloads after deploy |
| Windows `autocrlf` corrupted pcap/png/zip | Keep `.gitattributes` binary pins |
| MCP SQL with `nmap -p-` / backticks → Cloudflare WAF HTML | Keep shell syntax out of DB strings |
| `UPDATE`/`DELETE` without `WHERE` → pg-safeupdate reject | Always `WHERE` / `where true` |
| Ship DB before frontend (or reverse mismatch) | Frontend first when both change |
| Trust “Sound on” without gesture | `/board` needs click; use `isAudioRunning()` |
| Full-viewport `mix-blend-mode` | Leaderboard shimmer — banned |
| Per-second arena re-render | Boundary timers only |
| Hardcoded flag in JS (`cookie` old) | Always `verify_challenge_answer` |
| Target-box extras needing instructor IP | No challenges that require sharing a live IP |
| Regenerate Day 5 artifacts without re-applying migration | Keys won’t match live `live_material` |
| Edit answers without checking `solves` | Ask user if solves > 0 |
| Leave stale `ADMIN_MANUAL_DAY*.md` after rewrite | Update or delete manuals with content |

### Pre-ship checklist (challenges)

1. Query live DB for IDs + solve counts.
2. Grep prompts/hints/artifacts for tool names, encodings, answer strings, `KGSP{`.
3. Confirm medium+ needs page key / live material; file alone useless.
4. `npm run build`; grep `dist/` for answers.
5. Apply migration + save under `supabase/migrations/`; update `.cursor/context.md` + admin manual.
6. Hit download URLs once after deploy (catch 404 / gitignore).

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
