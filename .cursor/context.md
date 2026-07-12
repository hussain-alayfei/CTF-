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

## Current state (2026-07-12)

| Day | Title | Status | Flag model |
|-----|-------|--------|------------|
| 3 | Securing Data | Authored, often closed | **Static** (`challenge_flags`) |
| 4 | Securing Networks | Authored | **Dynamic** (7 core + 2 extras) |
| 5 | Privacy | Authored **v4** | **Dynamic** (10: 3E / 4M / 2H / 1D) |
| 6 | (prior pack) | Authored | **Dynamic** |
| 7 | Web Applications | Authored **v2.3 live** | **Dynamic** (15: 3E / 6M / 3H / 3D, **no files**) |
| 8–10 | Placeholders | Locked, empty | — |

Days 1–2 were deleted. Day numbers are plain ints (3–10).

**Day 7 IDs (v2.3):** easy `d7_markup_trail`, `d7_side_door`, `d7_desk_wizard` · medium `d7_role_chip`, `d7_twin_check`, `d7_leaky_desk`, `d7_frame_whisper`, `d7_safe_shelf`, `d7_stash_order` · hard `d7_blind_lookup` (boolean blind), `d7_strict_book` (strict XSS), `d7_claim_ticket` (alg:none ticket) · danger `d7_inherited_trust`, `d7_cross_talk`, `d7_flash_seat`.

**Day 7 model (v2.3):** live labs under `src/pages/day7/`. Blind/IDOR/LFI use server RPCs. Manual: `ADMIN_MANUAL_DAY7.md`. Code: `WEB-2026`.

**Day 5 IDs (v4):** `p5_cache_phantom`, `p5_bookmark_vault`, `p5_consent_labyrinth` (easy, unchanged) · `p5_ghost_profile`, `p5_referer_burn`, `p5_metadata_mirage`, `p5_cookie_jar` (medium) · `p5_entropy_portal`, `p5_supercookie` (hard) · `p5_reidentified` (danger).

**Day 5 model (v4):** medium/hard/danger are **live hands-on browser tasks** (fingerprint spoof, network inspect, cookie/storage tamper, entropy-reduce, k-anon linkage), NOT the old uniform file-XOR. Only **2 files**: `places.sqlite` (bookmark vault) + `metadata-mirage.jpg` (image). Fingerprint answers = ciphertext XOR SHA-256(real-env); decrypt only in a matching browser. Danger = server-gated `verify_reident` RPC. Live challenge crypto in `src/lib/dayfive.ts`; re-id data in `src/lib/reidentData.ts`.

**Day 5 code:** `PRIVACY-2026` · Migration: `supabase/migrations/20260709_1233_rewrite_day5_privacy_v4.sql` · Generator: `scripts/gen-day5-privacy.py` (image + crypto material + migration; image key random per run — re-apply migration if regenerated). Day 5 routes: `/challenge/ghost-profile|referer-burn|cookie-jar|entropy-portal|supercookie|re-identified` + `/challenge/verify/p5_metadata_mirage`. (Old v3 `MaskMatchChallenge.tsx` + mask-match route removed.)

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
7. Full workflow: `.cursor/skills/manage-ctf-challenges/SKILL.md` · Design history: `ADMIN_MANUAL_DAY4.md` · Day 5 answers: `ADMIN_MANUAL_DAY5.md` · Day 7 answers: `ADMIN_MANUAL_DAY7.md`.

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
- **Admin panel has NO route** (2026-07-10). It renders as an in-page overlay from
  `Play.tsx` (`showAdmin` state; `AdminPanel embedded onClose`) so the arena's
  `useGame`/realtime never remounts. Don't re-add a `/admin` route. Header 🛠 Admin
  button + footer "instructor panel" (admins only) open it; Esc closes.
- **"3-2-1 GO!" intro is keyed on `event.starts_at`** (sessionStorage `GO_ROUND_KEY`).
  Only `admin_start_event` changes `starts_at` (→ intro replays = a new round, correct).
  To extend/shorten a running round use `admin_add_time` (moves `ends_at` only) — never
  restart to add time (that was the "looping GO" bug). Frontend: "Adjust the running
  clock" panel in Event Control.
- **Timer colour escalation** (`ArenaTimerBanner` + board `BoardTimer`): green → cyan
  during freeze window → red ≤3 min → `terminal-redlight` ≤1 min. Haptic buzz on the
  last 3 s + at time-up (`navigator.vibrate`, best-effort).
- **Freeze anonymises identities, keeps the feed flowing:** board live feed + arena
  first-blood/solve toasts show 🕵️ "Anonymous" (points hidden) while `isFrozen`, so a
  toast can't leak who's climbing during the blackout. Board ranking stays fully hidden.

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

**Tables:** `players`, `challenges` (`is_dynamic`, `is_extra`, `day`, `difficulty` easy|medium|hard|danger), `challenge_flags` (static only), `challenge_answer_keys` (answer, secret, live_material), `challenge_hints`, `solves`, `hint_unlocks`, `submission_attempts`, `days` (`is_open`, `is_rest`, `requires_code`, **`is_completed`** = done→always practiceable, never blurred), `day_codes`, `day_entries`, `event_config` (active_day, freeze_minutes), `admin_config`.

**Fairness blur:** only the **active, non-completed** day is hidden pre-start (`effectiveStatus !== 'running'`). Completed days (`is_completed`, admin toggle in Days tab → `admin_set_day_completed`) and past/closed days are always readable for practice. `ChallengeModal` takes a `hidden` prop (per-challenge decision from Play), not raw event status.

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
src/pages/CachePhantomChallenge.tsx   Day 5 easy live
src/pages/ConsentLabyrinthChallenge.tsx  Day 5 easy live
src/pages/GhostProfileChallenge.tsx   Day 5 M — fingerprint match gate
src/pages/RefererBurnChallenge.tsx    Day 5 M — network leak inspect
src/pages/CookieJarChallenge.tsx      Day 5 M — cookie tamper
src/pages/EntropyPortalChallenge.tsx  Day 5 H — fingerprint entropy reduce
src/pages/SupercookieChallenge.tsx    Day 5 H — multi-vector evercookie
src/pages/ReidentifiedChallenge.tsx   Day 5 D — k-anon linkage (verify_reident RPC)
src/lib/dayfive.ts                    Day 5 live-challenge crypto helpers
src/lib/reidentData.ts                Day 5 re-identification datasets
public/challenges/day4|day5/          artifacts (day5: places.sqlite + metadata-mirage.jpg only)
scripts/gen-day4-artifacts.py
scripts/gen-day5-privacy.py            Day 5 v4: image + crypto material + migration
supabase/migrations/                  history; live DB is source of truth
ADMIN_MANUAL.md | _DAY4.md | _DAY5.md instructor keys
.cursor/skills/manage-ctf-challenges/SKILL.md
```

**Routes:** `/` Play · `/challenge/admin-panel` · `/challenge/router-console` · `/challenge/cache-phantom` · `/challenge/consent-labyrinth` · `/challenge/ghost-profile` · `/challenge/referer-burn` · `/challenge/cookie-jar` · `/challenge/entropy-portal` · `/challenge/supercookie` · `/challenge/re-identified` · `/challenge/verify/:challengeId`  (Admin dashboard **and** projector Board are in-page overlays in Play, not routes)

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
