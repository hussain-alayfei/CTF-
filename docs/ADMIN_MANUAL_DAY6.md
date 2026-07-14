# Day 6 — Introduction to Pentesting: Admin Solver Manual

> **Instructor use only.** This file contains every answer. Keep the repo
> private — same as the other ADMIN_MANUAL_DAY*.md files.

## Status

**Built and staged (locked).** Day 6 is `is_open = false` and code-gated, so
students can't see or score it until you open it. Artifacts are deployed under
`public/challenges/day6/`.

- Day 6, title "🎯 Day 6 — Introduction to Pentesting", code `PENTESTING-2026`
- **13 challenges: 10 NO-TOOL main + 3 Kali DANGER extras**
- Migration (v2): `supabase/migrations/20260712_1157_day6_pentesting_challenges.sql`
- Generator: `scripts/gen-day6-pentesting.py`

> ⚠️ **The v2 migration still needs to be APPLIED to the live database.** The 5
> original Kali *main* challenges were replaced with 5 no-tool ones, but the
> Supabase MCP was disconnected when this was built, so I could not apply it.
> Until you apply it, the live DB still holds the old Day-6 set. Day 6 is locked,
> so nothing is broken in the meantime. **To apply:** reconnect the Supabase MCP
> (or use the Supabase SQL editor / CLI) and run the v2 migration file. It removes
> the 5 retired Kali mains and installs the current 13.

## Design (v2)

Per your request, the **main** tier is now entirely **no-tool** (browser +
reasoning): recon, access control, appsec, web logic. The **Kali toolbox** only
appears in the 3 DANGER extras — the hardest, most engaging challenges. Every
challenge's first line tags it `[No special tools]` or `[Kali toolbox required]`.

Anti-AI is unchanged: flags are per-player `KGSP{}` HMACs minted server-side only
on the correct recovered answer, so pasting a prompt into a chatbot yields nothing
submittable. Answers are never served by `challenge_live_material` (all Day 6
`live_material = null`). Where the answer sits inside an artifact it is base64/
ROT13-wrapped so a naive "read the file" AI paste won't just print it.

## Pack summary

| Tier | Count | Points |
|------|-------|--------|
| Easy | 3 | 150–200 |
| Medium | 4 | 250–275 |
| Hard | 3 | 350–375 |
| **Danger (Kali extras)** | 3 | 500–550 |

Main total 2,725 pts + extras 1,575 = **4,300 pts**. First-blood +50 on main,
+100 on dangers. One hint each (−40).

## Answer map (INSTRUCTOR EYES ONLY)

Answers compare case-insensitively and end-trimmed. Students submit the answer on
the verify page → get a personal `KGSP{...}` → paste that into the arena.

### Main — No special tools (10)

| # | ID | Title | Level | Answer | How |
|---|-----|-------|-------|--------|-----|
| 1 | `d6_recon_footprint` | Footprint | easy | `harvest_the_headers` | robots.txt → source comment → `/backup/site-config.bak` → base64-decode `deploy_secret` |
| 2 | `d6_default_creds` | Factory Settings | easy | `sunwave_admin_5510` | only device on a cleartext mgmt port (SunWave AP-5510, telnet 23) also in the defaults table → its default password |
| 3 | `d6_jwt_read` | Token Inspector | easy | `jwt_not_encrypted` | base64url-decode the JWT payload → `note` claim → base64-decode it |
| 4 | `d6_severity_triage` | Triage | medium | `finding-06` | two 9.8s; finding-02 is internal-only, finding-06 is the internet-facing unauth RCE with public exploit |
| 5 | `d6_idor` | Off By One | medium | `sequential_ids_leak` | in the API log, the `role:superadmin` record's `recovery_phrase` (base64) |
| 6 | `d6_mass_assign` | Extra Fields | medium | `mass_assignment_win` | Attempt 2 adds `role/verified` → response leaks `panel_token` (base64) |
| 7 | `d6_version_hunt` | Fingerprint | medium | `vsftpd_2.3.4` | the famously backdoored vsftpd release in the banner grab |
| 8 | `d6_broken_auth` | Backdoor | hard | `magic_header_bypass` | deobfuscate the PHP: token is base64(ROT13(...)) — undo ROT13 then base64 |
| 9 | `d6_git_leak` | Left in History | hard | `git_never_forgets` | the `-` (removed) line in the "remove hardcoded password" commit diff → base64-decode |
| 10 | `d6_logic_flaw` | Free Lunch | hard | `logic_beats_brute` | negative `qty` succeeds → decode the `store_credit_code` (base64) |

### Extra section — DANGER · Kali toolbox (3)

| # | ID | Title | Level | Answer | Chain |
|---|-----|-------|-------|--------|-------|
| 11 | `d6_kill_chain` | Kill Chain | danger | `exfil_chain_unmasked` | Follow the POST stream in `exfil-capture.pcap` → base64-decode body (`Salted__`) → crack `X-Pw-MD5` (`84d961568a65073a3bcf0eb216b2a576` = `superman`) → `openssl enc -d -aes-256-cbc -pbkdf2 -k superman` |
| 12 | `d6_ghost_machine` | Ghost in the Machine | danger | `credential_harvested` | in `process-dump.bin`: 16 bytes after `KEY:` (hex `10d3eeaea6306d40eb45c381ab776c25`) = RC4 key; base64-decode the `BLOB:` region; RC4-decrypt |
| 13 | `d6_payload_analyst` | Payload Analyst | danger | `c2_key_bluef0x_2026` | trace `dropper.js.txt`: `_k = 0x2d ^ 0x77 = 0x5A`; base64-decode `_p` → hex-decode → XOR each byte with `0x5A` |

## Verification

`scripts/gen-day6-pentesting.py` regenerates all 13 artifacts + the migration.
Every challenge was reverse-solved from disk (13/13), including the real
`openssl enc -d` for Kill Chain. Re-running only re-randomizes the in-DB `secret`
(via `gen_random_bytes`); answers/artifacts stay stable.

## How to take Day 6 live (instructor, on the day)

**First, apply the v2 migration** (see the ⚠️ note above) — otherwise the old
Kali-main set is what students will get. Then, in the instructor panel:

1. **Days tab** → Unlock Day 6 (`is_open = true`); confirm code `PENTESTING-2026`.
2. Mark the previous live day **completed** so it drops to practice.
3. Set Day 6 as the **active day** (Event Control).
4. **Start event** to open scoring.

Students: unlock with the code → open a challenge → download the artifact →
recover the answer → **Open challenge** (verify page) → submit the answer → get
their personal `KGSP{...}` → paste it into the arena to score.
