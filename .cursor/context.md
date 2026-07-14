# KGSP CTF — Agent Context

Read this first. Prefer this file + the skill over re-exploring the whole repo.
Update this file when architecture, days, or challenge conventions change.

**DB performance / indexes / retrieval:** `.cursor/db-performance.md` (re-audit after DDL).

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

## Current state (2026-07-14)

| Day | Title | Status | Flag model |
|-----|-------|--------|------------|
| 3 | Securing Data | Authored, often closed | **Static** (`challenge_flags`) |
| 4 | Securing Networks | Authored | **Dynamic** (7 core + 2 extras) |
| 5 | Privacy | Authored **v4** | **Dynamic** (10: 3E / 4M / 2H / 1D) |
| 6 | (prior pack) | Authored | **Dynamic** |
| 7 | Web Applications | Authored **v2.4 live** | **Dynamic** (15: 3E / 6M / 3H / 3D multi-step, **no files**) |
| 8 | Web Application Hacking | Authored **v1 live** | **Dynamic** (13: 3E / 4M / 4H / 2D, **no files**) |
| 9–10 | Placeholders | Locked, empty | — |

Days 1–2 were deleted. Day numbers are plain ints (3–10).

**Day 7 IDs (v2.4):** easy `d7_markup_trail`, `d7_side_door`, `d7_desk_wizard` · medium `d7_role_chip`, `d7_twin_check`, `d7_leaky_desk`, `d7_frame_whisper`, `d7_safe_shelf`, `d7_stash_order` · hard `d7_blind_lookup` (boolean blind `w7blindx`), `d7_strict_book` (strict XSS / `strict_spill`), `d7_claim_ticket` (`forged_pass` / alg:none) · danger multi-step `d7_inherited_trust` (pollution×2 → seal `R7-SEAL`), `d7_cross_talk` (elevate → gate `n0rigin` → confirm), `d7_flash_seat` (Arm → Reserve guest → admin flip ≤450ms).

**Day 7 model (v2.4):** live browser labs only under `src/challenges/day7/` — **no download artifacts**, all dynamic. Blind/IDOR/LFI use server RPCs. Manual: `docs/ADMIN_MANUAL_DAY7.md`. Access code: **`WEB-2026`**.

**Arena open path:** challenge card → **ChallengeModal first** (prompt / hint / submit / “Open challenge”) → live lab route. Never jump straight from card → lab.

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
7. Full workflow: `.cursor/skills/manage-ctf-challenges/SKILL.md` · Design history: `docs/ADMIN_MANUAL_DAY4.md` · Day 5 answers: `docs/ADMIN_MANUAL_DAY5.md` · Day 7 answers: `docs/ADMIN_MANUAL_DAY7.md` · Day 8 answers: `docs/ADMIN_MANUAL_DAY8.md`.

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
- **Admin panel has NO route** (2026-07-10). It renders as in-page content from
  `Play.tsx` (`showAdmin`; `AdminPanel embedded`) so arena `useGame`/realtime never
  remounts. Don't re-add `/admin`. Header Admin tab + footer link open it.
- **Admin Event Control** reads as numbered steps (choose live day → share code →
  round length / freeze → start/stop → adjust clock → finale). A one-line “Next”
  hint tracks day + clock state. Stats are a **compact title-line strip** (not three
  tall tiles). Players: click name → **right drawer** (not inline expand). Confirms
  use in-app `ConfirmDialog` (not `window.confirm`).
- **Admin editable fields seed from `game.event`** (arena realtime), not hardcoded
  defaults + slow `adminOverview` poll. Sync duration / freeze / active-day only when
  the **server** value changes (refs) so a poll never flashes ghosts or stomps mid-edit.
- **STAND BY / stop round:** stopping clears clocks so arena banner and admin blur
  agree on idle — don’t leave a stale ended clock looking “live.”
- **"3-2-1 GO!" intro is keyed on `event.starts_at`** (sessionStorage `GO_ROUND_KEY`).
  Only `admin_start_event` changes `starts_at` (→ intro replays = a new round, correct).
  To extend/shorten a running round use `admin_add_time` (moves `ends_at` only) — never
  restart to add time (that was the "looping GO" bug). Frontend: "Adjust the running
  clock" panel in Event Control. `admin_add_time` must **not** overwrite
  `duration_minutes` (that permanently redefined round length — once became 188).
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
| Day 7 v1 = downloadable text / GPT-pasteable | Live browser labs only; dangers = multi-step |
| Card click → lab route skips ChallengeModal | Always modal first (prompt / hint / Open challenge) |
| Admin fields default `35`/`15`/empty until poll | Seed + sync from `game.event`; guard mid-edit |
| Three tall Admin stats tiles under title | Compact title-line strip only |
| `window.confirm` for hide/delete/reset | In-app `ConfirmDialog` (destructive → Cancel focus) |
| Players row expand pushes list | Right-side detail drawer |
| Stop round left stale timer / blur disagree | STAND BY clears clocks; banner ↔ admin agree |
| `admin_add_time` wrote into `duration_minutes` | Add/remove time moves `ends_at` only |

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

**Tables:** `players`, `challenges` (`is_dynamic`, `is_extra`, `day`, `difficulty` easy|medium|hard|danger), `challenge_flags` (static only), `challenge_answer_keys` (answer, secret, live_material jsonb), `challenge_hints`, `solves`, `hint_unlocks`, `submission_attempts`, `days` (`is_open`, `is_rest`, `requires_code`, **`is_completed`**), `day_codes`, `day_entries`, `event_config`, `admin_config`.

**`event_config` (id=1) columns:** `name`, `starts_at`, `ends_at`, `duration_minutes` (saved round length for next start), `freeze_minutes`, `active_day`, `finale_stage` (−1 = none; 0+ = reveal step), `updated_at`.

**Score protect:** `solves.challenge_id` + `hint_unlocks.challenge_id` = **`ON DELETE RESTRICT`**. Content migrations **upsert**; never `delete from challenges` + re-insert. Retire only after deliberate solve wipe. See `supabase/migrations/README.md` + `20260712_1400_protect_scores.sql`.

**Fairness blur:** only the **active, non-completed** day is hidden pre-start (`effectiveStatus !== 'running'`). Completed days (`is_completed` via `admin_set_day_completed`) and past/closed days stay readable. `ChallengeModal` gets `hidden` from Play, not raw event status.

**Player RPCs:** `register_player`, `login_player`, `submit_flag`, `unlock_hint`, `check_day_code` (also writes `day_entries`), `day_leaderboard`, `verify_challenge_answer`, `challenge_live_material`, `verify_reident` (Day 5 danger).

**Day 7 lab RPCs (DEFINER):** `d7_blind_lookup` (Quiet Directory / boolean blind), `d7_leaky_user` (Leaky Desk IDOR), `d7_safe_file` (Safe Shelf LFI). Other Day 7 labs are client-side + `verify_challenge_answer` / `challenge_live_material`.

**Admin RPCs:** `admin_overview`, `admin_start_event`, `admin_stop_event` (**clears** `starts_at`/`ends_at`/`finale_stage` → true STAND BY), `admin_add_time` (**`ends_at` only** — never rewrite `duration_minutes`), `admin_set_duration`, `admin_set_freeze`, `admin_set_finale_stage`, `admin_reset` (scoped to day), `admin_set_day`, `admin_set_day_code`, `admin_set_day_completed`, `admin_set_active_day`, `admin_list_players`, `admin_delete_player`, `admin_delete_all_players`, `admin_set_player_excluded`, `admin_login`.

**Board model:** live board = entrants of `active_day` via `day_entries` + `day_leaderboard`. Profile score = all-time. Projector freezes points in last `freeze_minutes`.

**Day codes (live `day_codes`):** 3 `SECURING-DATA` · 4 `Securing-Networks` · 5 `PRIVACY-2026` · 6 `PENTESTING-2026` · 7 **`WEB-2026`** · 8 `WEBHACK-2026` · 9 `BLOCKCHAIN-2026` · 10 `SMART-2026`.

---

## Backend — live Supabase (`meras-ctf` / `xehzdlfrzlokwvtcfvjx`)

Verified via MCP **2026-07-14**. Prefer live queries over guessing; file migrations under `supabase/migrations/` must match what MCP applied (version names often differ from filenames).

### Live curriculum snapshot

| Day | Title | open | completed | #challenges (approx) |
|-----|-------|------|-----------|----------------------|
| 3–6 | Data → Pentesting | open | **completed** | Day4≈9, Day5=10, Day6≈13 |
| **7** | Web Applications | open | **completed** | **15** all dynamic |
| **8** | Web Application Hacking | **open** | not completed | **12** all dynamic |
| 9–10 | placeholders | locked | — | empty |

Scale ≈ **13 players · 54 challenges · 143 solves** (Day 7 solves ≈ 19). Re-query before destructive ops.

**`event_config` at audit:** `active_day=7`, `duration_minutes=45`, `freeze_minutes=20`. If `starts_at`/`ends_at` remain set while arena should be idle, call **Stop** (`admin_stop_event`) — FINALE leftover `finale_stage` can also linger until stop/start.

### Day 7 answer markers (canonical in `challenge_answer_keys` — full writeups in `docs/ADMIN_MANUAL_DAY7.md`)

| id | answer | live_material keys (if any) |
|----|--------|------------------------------|
| `d7_markup_trail` | `ink_below` | — |
| `d7_side_door` | `service_hatch` | — |
| `d7_desk_wizard` | `quiet_path` | — |
| `d7_role_chip` | `analyst_seat` | `reveal_hex` |
| `d7_twin_check` | `both_match` | `reveal_hex` |
| `d7_leaky_desk` | `desk_owner_note` | (via `d7_leaky_user` RPC) |
| `d7_frame_whisper` | `posted_secret` | `frag` |
| `d7_safe_shelf` | `shelf_escape_ok` | (via `d7_safe_file` RPC) |
| `d7_stash_order` | `abc_order` | `a`,`b`,`c`,`reveal_hex` |
| `d7_blind_lookup` | `w7blindx` | (via `d7_blind_lookup` RPC) |
| `d7_strict_book` | `strict_spill` | `reveal_hex` |
| `d7_claim_ticket` | `forged_pass` | `reveal_hex` |
| `d7_inherited_trust` | `chief_clearance` | `reveal_hex`, **`seal`=`R7-SEAL`** |
| `d7_cross_talk` | `null_origin_ok` | `reveal_hex`, **`gate`=`n0rigin`** |
| `d7_flash_seat` | `race_won` | `reveal_hex` |

### Important migrations applied (Jul 12–13) — backend story

| Live version / file | What it did |
|---------------------|-------------|
| `protect_scores_restrict_challenge_delete` | solves/hints FK → **RESTRICT** |
| `finale_stage_synced_reveal` | `event_config.finale_stage` + `admin_set_finale_stage` |
| `round_length_setting` | `admin_set_duration`; **fix** `admin_add_time` (no duration overwrite) |
| `day7_webapps_live_v2` + dangers/hard/idor | Day 7 catalog + lab RPCs |
| `day7_danger_multistep` | danger prompts/hints + seal/gate in `live_material` |
| `db_performance_indexes` | challenge/solves/hint indexes; drop dup day_entries uniq |
| `fix_event_standby_sync` | `admin_stop_event` nulls clocks + `finale_stage=-1` |

Repo mirror files: `supabase/migrations/20260712_*.sql`, `20260713_*.sql`. Always **`apply_migration` via MCP** then keep a matching file. Content changes = **upsert**, not delete+insert.

Indexes / retrieval detail: **`.cursor/db-performance.md`**.

## Where code lives

`src/` is organised by **domain** so agents find code by purpose. `@/` is an
import alias for `src/` (configured in `vite.config.ts` + `tsconfig.app.json`),
so imports don't break when files move. Full map: **`src/AGENT_MAP.md`**.

```
src/app/App.tsx             routes (only) + AppContext provider
src/app/main.tsx            React entry (index.html → /src/app/main.tsx)
src/app/index.css           global styles

src/lib/                    platform-only, no day-specific code
  api.ts                    all RPCs / table calls
  useGame.ts                challenges/days/solves/board + single realtime sub
  time.ts + useCountdown.ts one countdown model (arena/board/admin agree)
  supabase.ts types.ts cache.ts session.ts sounds.ts theme.ts
  constants.ts app-context.tsx useLockBodyScroll.ts

src/arena/Play.tsx          the arena; mounts Board/Admin/Finale/modal as overlays
src/arena/Board.tsx         projector
src/arena/components/       ChallengeModal (always open before a live lab),
                            ChallengeCard, Leaderboard, Timer, Toasts, HeaderBar,
                            GoOverlay, Finale, Fireworks, ProfileModal, Register

src/admin/AdminPanel.tsx    3 tabs: Event Control (stepped) | Days & Challenges | Players · Day N
src/admin/ConfirmDialog.tsx in-app confirms (admin + hint unlock)

src/challenges/shared/      ChallengeFrame, AnswerBox, Prompt,
                            AnswerVerifyChallenge (/challenge/verify/:id generic)
src/challenges/day4/        RouterConsoleChallenge (SNMP), CookieChallenge (extra)
src/challenges/day5/        CachePhantom, ConsentLabyrinth (easy live) · GhostProfile,
                            RefererBurn, CookieJar (M) · EntropyPortal, Supercookie (H) ·
                            Reidentified (D, verify_reident) · dayfive.ts (crypto),
                            reidentData.ts (datasets)
src/challenges/day7/*.tsx   Day 7 live labs (15) + dayseven.ts helpers
src/challenges/day8/*.tsx   Day 8 live labs (12) + dayeight.ts helpers

public/challenges/day4|day5|day8/     artifacts (day5: places.sqlite + metadata-mirage.jpg; day8: robots/ping)
scripts/gen-day4-artifacts.py
scripts/gen-day5-privacy.py            Day 5 v4: image + crypto material + migration
supabase/migrations/                  history; live DB is source of truth
docs/ADMIN_MANUAL.md | _DAY4.md | _DAY5.md | _DAY7.md | _DAY8.md instructor keys
.cursor/skills/manage-ctf-challenges/SKILL.md
.cursor/db-performance.md             indexes / RPC performance notes
```

**Routes:** `/` Play · Day 4/5 challenge paths · `/challenge/markup-trail|side-door|desk-wizard|role-chip|twin-check|frame-whisper|stash-order|leaky-desk|safe-shelf|quiet-directory|strict-guestbook|claim-ticket|inherited-trust|cross-talk|flash-seat` (Day 7) · `/challenge/verify/:challengeId` — Admin + Board are **in-page** from Play, not routes.

---

## Task routing (save tokens)

| User wants… | Do this |
|-------------|---------|
| Add/edit/delete challenges | Follow **manage-ctf-challenges** skill; query live DB first |
| Day 4/5/7/8 answers / how to solve | Read `docs/ADMIN_MANUAL_DAY4.md` / `_DAY5.md` / `_DAY7.md` / `_DAY8.md` — don’t invent |
| New day (6+) | Dynamic + anti-AI rules; Day 7 bar = live browser labs (no file dumps for GPT) |
| Regenerate Day 5 artifacts | `python scripts/gen-day5-privacy.py` then **re-apply** emitted migration (keys changed) |
| UI/admin/board bugs | Touch `src/pages/*` + `src/lib/*`; keep perf/sound + Admin seed-from-`game.event` rules |
| Schema / RPC / index work | Query live DB via Supabase MCP first; update `.cursor/context.md` **Backend** + `.cursor/db-performance.md` |
| Commit/push | Only when user asks; push `master` deploys |

---

## Session digest — Admin + Day 7 polish (2026-07-12 → 07-14)

What landed in this stretch (already on `master` / live). Use when continuing Admin or Day 7 work.

**Day 7 pack (v2.4):** 15 challenges, all live labs, no files, all dynamic. Dangers redesigned to multi-step (Inherited Trust pollution×2, Cross Talk elevate→gate→confirm, Flash Seat arm→reserve→≤450ms admin flip). Hard markers: `w7blindx`, `strict_spill`, `forged_pass`. Code `WEB-2026`. Manual `docs/ADMIN_MANUAL_DAY7.md`.

**Arena:** Challenge open is **modal-first** (no direct jump to lab).

**Admin UX:** Event Control numbered workflow + “Next” line; denser steps/Days rows; player detail = drawer; `ConfirmDialog` for admin actions + hint unlock; status/players/solves = one-line strip beside title (not tile grid).

**Admin correctness:** Opening Admin from arena no longer flashes stale duration/freeze/day — fields seed/sync from `game.event` with server-change guards. Stop/STAND BY keeps arena timer and admin state aligned (`admin_stop_event` clears clocks + finale). Indexes/doc: `.cursor/db-performance.md`.

**Backend (same stretch):** RESTRICT FKs on solves; round-length vs add-time split; Day 7 live_material seal/gate; three `d7_*` lab RPCs; performance indexes. Full table in **Backend — live Supabase** above.

**Recent ship commits (examples):** modal-first · danger multi-step · STAND BY sync · Event Control workflow · Admin UX polish · stale-value fix (`a33fa2f`) · stats strip (`189f05f`).

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
