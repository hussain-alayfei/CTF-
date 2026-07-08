# Day 5 — Privacy: Admin Solver Manual (v3)

> **Instructor use only.** Expected recoveries for the anti-AI Day 5 pack.

## Why v3 exists

v2 was still solvable by pasting a single file into a chatbot: the decode key
was either **1 byte** (256 brute-force guesses) or the answer sat in the file as
plaintext. v3 fixes the whole medium/hard/danger tier with one principle:

> **The download is deliberately incomplete.** The file holds only ciphertext;
> the key that decrypts it is **high-entropy (48 bytes) and lives only in
> `challenge_live_material`**, shown on the logged-in challenge page — never in
> the file. Because the key is at least as long as the plaintext, the file alone
> is information-theoretically useless. Uploading just the artifact to an AI
> yields nothing submittable.

Students must therefore: open the file with a **real tool** (DB Browser,
Wireshark, a HAR viewer, a carving/unzip tool), read the **session key** off the
challenge page, and combine them. Prompts state scenario + goal only; hints are
one short nudge with no tool/algorithm names.

The combine step is a repeating-key XOR of the recovered ciphertext bytes with
the session-key bytes (`plaintext[i] = cipher[i] XOR key[i]`). We never say this
in any prompt/hint/file — that inference is the challenge.

## Pack summary

- **10 challenges** — 3 easy · 4 medium · 2 hard · 1 danger, all `is_dynamic`
- Day code: `PRIVACY-2026`
- Regenerate artifacts **and** the matching migration:
  `python scripts/gen-day5-artifacts.py`
  (keys are random each run — re-apply the emitted migration if you regenerate)

## Answer map

| # | ID | Title | Level | Artifact / page | Answer |
|---|-----|-------|-------|-----------------|--------|
| 1 | `p5_cache_phantom` | Cache Phantom | Easy | Live `/challenge/cache-phantom` | `crumbs_trail` |
| 2 | `p5_bookmark_vault` | Bookmark Vault | Easy | `places.sqlite` | `route_17` |
| 3 | `p5_consent_labyrinth` | Consent Labyrinth | Easy | Live `/challenge/consent-labyrinth` | `narrow_path` |
| 4 | `p5_profile_archive` | Profile Archive | Medium | `browser-profile.zip` + session key | `midnight_export` |
| 5 | `p5_dns_whisper` | DNS Whisper | Medium | `dns-whisper.pcap` + session key | `internal_clinic_net` |
| 6 | `p5_tracker_ghost` | Tracker Ghost | Medium | `tracker-ghost.har` + session key | `shadow_pixel` |
| 7 | `p5_briefing_carve` | Hidden Briefing | Medium | `briefing-snapshot.png` + session key | `leaked_briefing_pack` |
| 8 | `p5_mask_match` | Mask Match | Hard | `mask-capture.json` + live brief + key | `profile_aligned` |
| 9 | `p5_exit_witness` | Exit Witness | Hard | `exit-witness.pcap` + session key | `witness_confirmed` |
| 10 | `p5_reidentified` | Re-Identified | Danger | `reident-kit.zip` + session key | `subject_unmasked` |

> **Session keys are random per generator run.** The exact hex values live in
> `challenge_answer_keys.live_material` and in
> `supabase/migrations/20260709_0300_rewrite_day5_privacy_v3.sql`. To help a
> stuck student, read the key from `/admin` data or the migration; do not read
> them out loud in class.

---

## 1 · Cache Phantom (easy)

Live page → **Accept all tracking** → DevTools ▸ Application:
- Cookie `_ck` → base64 → `crum`
- Local storage `_ls` → reverse → `crumbs`
- IndexedDB `ctf_cache_phantom_v1` / `shards` / key `c` → `trail`

→ **`crumbs_trail`**

## 2 · Bookmark Vault (easy)

Open `places.sqlite` (DB Browser / `sqlite3`), join `moz_bookmarks`↔`moz_places`.
"Operations Vault" URL contains **`route_17`**.

## 3 · Consent Labyrinth (easy)

Correct posture: Functional ✓ · Marketing ✗ · Analytics ✗ · Security ✓ ·
Sell-data ✗ · Essential-storage ✓ → `sessionStorage._cl_recovery` (base64) →
**`narrow_path`**.

## 4 · Profile Archive (medium)

`browser-profile.zip` → `triage/cookies.sqlite` (real DB). Cookie `.vault.internal`
name `blob` holds ciphertext hex. XOR its bytes with the page **session key** →
**`midnight_export`**.

## 5 · DNS Whisper (medium)

`dns-whisper.pcap` in Wireshark → DNS only. Ignore public CDNs. Queries to
`sX-<hex>.sync.telemetry-cdn.net` carry the payload; order by `s1,s2,s3`,
concatenate the hex labels, XOR with the page key → **`internal_clinic_net`**.

## 6 · Tracker Ghost (medium)

`tracker-ghost.har` → third-party hosts only, in time order
(`pixel.shadow.net` → `tag.metrics-aa.net` → `sync.broker-cc.io`). Concatenate the
`X-Seg` response-header values → ciphertext hex → XOR page key → **`shadow_pixel`**.

## 7 · Hidden Briefing (medium)

`briefing-snapshot.png` renders normally; a ZIP is carved after the PNG `IEND`.
Extract `inner/passenger.bin` (raw ciphertext bytes), XOR with the page key →
**`leaked_briefing_pack`**.

## 8 · Mask Match (hard)

Live brief: `Asia/Riyadh` · `ar-SA` · `1366x768`. Spoof browser timezone/locale
and resize the viewport until alignment hits **100%** — only then does the page
reveal the session key. In `mask-capture.json`, every row's `blob` decrypts (with
that one key) to a plausible token; the row whose profile matches the brief
(`profile_id 7f2a`) yields **`profile_aligned`**.

## 9 · Exit Witness (hard)

`exit-witness.pcap`: most flows are TLS-looking noise to `185.220.101.x` (Tor
relays). One cleartext `POST /relay/report` to `10.88.0.50:8080` carries hex in
its body. Follow that stream, XOR the body bytes with the page key →
**`witness_confirmed`**.

## 10 · Re-Identified (danger)

`reident-kit.zip`: cross-match `anon_export.csv` ↔ `municipal_roll.csv` on
age+zip+gender. Unique exact match: **U-4412** (32/11564/F) ↔ **V-9001 Aisha
Rahman**. Take U-4412's note from `analyst_notes.csv` (hex), XOR with the page key
→ **`subject_unmasked`**. (Other subjects' notes are random bytes — a wrong match
decrypts to garbage, so the linkage reasoning is mandatory.)

---

## Anti-AI notes for instructors

- **File-only AI upload → nothing.** Every medium+ answer needs the off-file key.
- **Flag-sharing → nothing.** Flags are still per-player HMAC via
  `verify_challenge_answer`.
- **Honest limit:** a student who pastes the file *and* the page key into an AI
  will get help — that is assisted solving, which is fine. The bar we enforce is
  "the artifact alone is not a solution," plus real tool work to extract the
  ciphertext in the first place.

## SQL source

- `supabase/migrations/20260709_0300_rewrite_day5_privacy_v3.sql`
  (supersedes the v1 `..._0015_...` and v2 `..._0200_...` migrations).
