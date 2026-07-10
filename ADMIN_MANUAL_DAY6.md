# Day 6 — Introduction to Pentesting: Admin Solver Manual

> **Instructor use only.** This file contains every answer. Do not ship it to
> students or commit it anywhere they can read it (it lives in the repo root,
> same as the other ADMIN_MANUAL_DAY*.md files — keep the repo private).

## Status

**Built and staged (locked).** 13 challenges are live in the database but the
day is `is_open = false` and code-gated, so students can't see or score it until
you open it. Artifacts are deployed under `public/challenges/day6/`.

- Day 6, title "🎯 Day 6 — Introduction to Pentesting"
- Day code: `PENTESTING-2026` (unchanged)
- `requires_code = true`, `is_open = false`
- 13 challenges: **10 main** (5 no-tool + 5 Kali) + **3 DANGER extras**
- Migration: `supabase/migrations/20260710_2258_day6_pentesting_challenges.sql`
- Generator: `scripts/gen-day6-pentesting.py`

## Why this exists (anti-AI angle)

Every challenge hands the student a **per-artifact** thing to recover — a hash to
crack, a stream to follow, a blob to carve/decrypt, a version to fingerprint, a
piece of code to deobfuscate. Pasting the prompt into a chatbot yields *nothing
submittable* because:

- the flag (`KGSP{...}`) is a **per-player HMAC** minted server-side only after
  the correct recovered answer is submitted — it exists in no file, no bundle,
  and no DB column a student can read (`challenge_answer_keys` is RLS deny-all);
- the answer depends on data that lives only inside the downloaded artifact, so
  the student must actually run the tool against *this* file.

The split the students see:

- **`[No special tools]`** — solvable in a browser / by reading + light decoding.
- **`[Kali toolbox required]`** — genuinely needs Kali tooling (hashcat, john,
  wireshark/tshark, binwalk/foremost, jwt_tool, openssl, scripting).

The Kali/no-tool label is in the first line of every prompt, and the `category`
chip reinforces it. The 3 dangers are chained multi-tool problems — brutal for
beginners, hard even for strong students.

## Pack summary

| Tier | Count | Points |
|------|-------|--------|
| Easy | 3 | 150–200 |
| Medium | 4 | 250–275 |
| Hard | 3 | 350–375 |
| **Danger (extra section)** | 3 | 500–550 |

Total on the board: **4,125 pts** (main 3,075 + extras 1,050). First-blood bonus
+50 on main, +100 on dangers. One hint each (−40).

## Answer map (INSTRUCTOR EYES ONLY)

Answers are compared case-insensitively and end-trimmed (`lower(btrim(...))`), so
minor case/whitespace differences are forgiven. Students submit the **answer** on
the challenge's verify page → they get a personal `KGSP{...}` flag → they paste
that into the arena.

### Main — No special tools (5)

| # | ID | Title | Level | Answer | How |
|---|-----|-------|-------|--------|-----|
| 1 | `d6_recon_footprint` | Footprint | easy | `harvest_the_headers` | robots.txt → source comment → `/backup/site-config.bak` → base64-decode `deploy_secret` |
| 2 | `d6_default_creds` | Factory Settings | easy | `sunwave_admin_5510` | only device on a cleartext mgmt port (SunWave AP-5510, telnet 23) that's also in the defaults table → its default password |
| 3 | `d6_severity_triage` | Triage | medium | `finding-06` | two 9.8s; finding-02 is internal-only, finding-06 is the internet-facing unauth RCE with a public exploit |
| 4 | `d6_version_hunt` | Fingerprint | medium | `vsftpd_2.3.4` | the famously backdoored vsftpd release in the banner grab |
| 5 | `d6_broken_auth` | Backdoor | hard | `magic_header_bypass` | deobfuscate the PHP: token is base64(ROT13(...)) — undo ROT13 then base64 |

### Main — Kali toolbox (5)

| # | ID | Title | Level | Answer | Tool / how |
|---|-----|-------|-------|--------|-----|
| 6 | `d6_crack_hash` | Crack It | easy | `spongebob` | `hashcat -m 0` / john on the unsalted MD5 `e1964798cfe86e914af895f8d0291812` + rockyou |
| 7 | `d6_wire_tap` | Wiretap | medium | `s3cure_ftp_2026` | Wireshark Follow TCP Stream on `ftp-capture.pcap` → FTP `PASS` |
| 8 | `d6_buried_signal` | Buried | medium | `binwalk_finds_all` | `binwalk -e` / foremost the PNG → `recovered/secret.txt` → base64-decode |
| 9 | `d6_forged_token` | Forgery | hard | `sunshine` | `hashcat -m 16500` / jwt_tool on the HS256 JWT + rockyou → signing secret |
| 10 | `d6_leaked_db` | Data Dump | hard | `chocolate` | `hashcat -m 1410` (sha256($pass.$salt)); crack the `role=admin` row (`root_ops`, salt `77de`) |

### Extra section — DANGER (3)

| # | ID | Title | Level | Answer | Chain |
|---|-----|-------|-------|--------|-------|
| 11 | `d6_kill_chain` | Kill Chain | danger | `exfil_chain_unmasked` | Follow the POST stream in `exfil-capture.pcap` → base64-decode body (`Salted__`) → crack `X-Pw-MD5` (`84d961568a65073a3bcf0eb216b2a576` = `superman`) → `openssl enc -d -aes-256-cbc -pbkdf2 -k superman` |
| 12 | `d6_ghost_machine` | Ghost in the Machine | danger | `credential_harvested` | in `process-dump.bin`: 16 bytes after `KEY:` (hex `10d3eeaea6306d40eb45c381ab776c25`) = RC4 key; base64-decode the `BLOB:` region; RC4-decrypt |
| 13 | `d6_payload_analyst` | Payload Analyst | danger | `c2_key_bluef0x_2026` | trace `dropper.js.txt`: `_k = 0x2d ^ 0x77 = 0x5A`; base64-decode `_p` → hex-decode → XOR each byte with `0x5A` |

## Anti-AI notes for instructors

- A chatbot paste of any prompt yields no flag: flags are per-player HMACs minted
  only by `verify_challenge_answer` on the correct recovered answer.
- The recovered answers are per-artifact and never served by
  `challenge_live_material` (all Day 6 `live_material = null`).
- The easy no-tool answers (recon/backdoor) are still base64/ROT13-wrapped inside
  the artifact so a naive "read the file" AI paste won't just print them.
- All rockyou passwords used (`spongebob`, `sunshine`, `chocolate`, `superman`)
  are standard rockyou.txt entries, so hashcat/john crack them with the stock
  wordlist. If a student says "my wordlist doesn't have it," they're not using
  rockyou.

## Verification

`scripts/gen-day6-pentesting.py` regenerates all artifacts + the migration.
Every challenge was reverse-solved from disk (including the real
`openssl enc -d` for Kill Chain) — 13/13 confirmed solvable. Re-running the
generator produces new random `secret`s only in-DB (the migration uses
`gen_random_bytes`), so answers/artifacts stay stable across re-applies.

## How to take Day 6 live (instructor, on the day)

In the arena's instructor panel (🛠 Admin):

1. **Days tab** → set Day 6 `is_open = true` (and, if you rotate it, confirm the
   code is `PENTESTING-2026`).
2. Mark the *previous* live day `is_completed = true` so it drops to the practice
   section (students keep practicing it, un-blurred).
3. Set Day 6 as the **active day** so its leaderboard becomes the live one.
4. **Start event** to open the timer / scoring window.

Students then: unlock the day with the code → open a challenge → download the
artifact → recover the answer → **Open challenge** (verify page) → submit the
answer → get their personal `KGSP{...}` → paste it into the arena flag box to
score. Before you flip it open, the whole day is hidden/blurred exactly like
Days 7–10.
