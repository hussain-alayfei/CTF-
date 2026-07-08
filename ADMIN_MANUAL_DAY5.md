# Day 5 — Privacy: Admin Solver Manual (v2)

> **Instructor use only.** Expected recoveries for the rewritten Day 5 pack.

## Pack summary

- **10 challenges** — 3 easy · 4 medium · 2 hard · 1 danger
- **All dynamic** (`is_dynamic = true`) — personal flags via `verify_challenge_answer`
- **Anti-AI design:** binary/sqlite/pcap/har/zip artifacts, live keys withheld, bespoke browser pages for interaction-heavy tasks. No plaintext answers in downloads.

## Answer map

| # | ID | Title | Level | Artifact / page | Answer |
|---|-----|-------|-------|-----------------|--------|
| 1 | `p5_cache_phantom` | Cache Phantom | Easy | Live `/challenge/cache-phantom` | `crumbs_trail` |
| 2 | `p5_bookmark_vault` | Bookmark Vault | Easy | `places.sqlite` | `route_17` |
| 3 | `p5_consent_labyrinth` | Consent Labyrinth | Easy | Live `/challenge/consent-labyrinth` | `narrow_path` |
| 4 | `p5_profile_archive` | Profile Archive | Medium | `browser-profile.zip` | `midnight_export` |
| 5 | `p5_dns_whisper` | DNS Whisper | Medium | `dns-whisper.pcap` | `internal_clinic_net` |
| 6 | `p5_tracker_ghost` | Tracker Ghost | Medium | `tracker-ghost.har` | `shadow_pixel` |
| 7 | `p5_briefing_carve` | Hidden Briefing | Medium | `briefing-snapshot.png` + live key `3a` | `leaked_briefing_pack` |
| 8 | `p5_mask_match` | Mask Match | Hard | `mask-capture.json` + live brief + `/challenge/mask-match` | `profile_aligned` |
| 9 | `p5_exit_witness` | Exit Witness | Hard | `exit-witness.pcap` + live key `21` | `witness_confirmed` |
| 10 | `p5_reidentified` | Re-Identified | Danger | `reident-kit.zip` + live key `7c` | `subject_unmasked` |

Day code: `PRIVACY-2026`

Regenerate artifacts: `python scripts/gen-day5-artifacts.py`

---

## 1 · Cache Phantom

1. Open `/challenge/cache-phantom` while logged in.
2. Click **Accept all tracking**.
3. DevTools → Application:
   - Cookie `_ck` → base64 → `crum`
   - Local storage `_ls` → reverse → `crumbs`
   - IndexedDB `ctf_cache_phantom_v1` / `shards` / key `c` → `trail`
4. Combine: **`crumbs_trail`**

---

## 2 · Bookmark Vault

1. Open `places.sqlite` in DB Browser / `sqlite3`.
2. Join `moz_bookmarks` ↔ `moz_places`.
3. Bookmark **Operations Vault** → URL path contains **`route_17`**.

---

## 3 · Consent Labyrinth

Correct posture per step:

- Functional ✓ · Marketing ✗
- Analytics ✗ · Security ✓
- Third-party sell ✗ · Essential storage ✓

Finish wizard → `sessionStorage._cl_recovery` is base64 → decode → **`narrow_path`**

---

## 4 · Profile Archive

Inside `browser-profile.zip`:

- Cookie domain `.midnight-export.internal`
- Download `midnight_export_pack.zip`
- History ends at same archive host

Answer: **`midnight_export`**

---

## 5 · DNS Whisper

Wireshark → DNS only. Noise = public CDNs. Repeated internal name:

**`internal.clinic.net`** → submit **`internal_clinic_net`**

---

## 6 · Tracker Ghost

HAR → third-party hosts only, chronological:

| Host | X-Trace-Shard |
|------|----------------|
| pixel.shadow.net | `73686164` → hex → `shad` |
| tag.metrics-aa.net | `ow` |
| sync.broker-cc.io | `cGl4ZWw=` → `pixel` |

**`shadow_pixel`**

---

## 7 · Hidden Briefing

1. Carve ZIP after PNG `IEND` (binwalk / unzip trick).
2. `inner/note.bin` — XOR each byte with **`0x3a`** (live page).
3. **`leaked_briefing_pack`**

---

## 8 · Mask Match

1. Live brief: `Asia/Riyadh`, `ar-SA`, `1366x768` — adjust browser sensors until 100%.
2. In `mask-capture.json`, row `profile_id` **`7f2a`** matches.
3. Token decode: base64 → gunzip → XOR `0x5A` → **`profile_aligned`**

---

## 9 · Exit Witness

1. PCAP: ignore TLS to 185.220.x.x relays.
2. Follow HTTP stream: `POST /relay/report` to `10.88.0.50:8080`.
3. Body is hex ciphertext — XOR each byte with **`0x21`** → **`witness_confirmed`**

---

## 10 · Re-Identified (danger)

1. Join `anon_export.csv` ↔ `municipal_roll.csv` on age+zip+gender.
2. Unique pair: **U-4412** ↔ **V-9001** (Aisha Rahman, 32, 11564, F).
3. `analyst_notes.txt` hex bytes XOR **`0x7c`** → **`subject_unmasked`**

---

## SQL source

- `supabase/migrations/20260709_0200_rewrite_day5_privacy_v2.sql`

v1 challenges (`p5_cookie_trail`, etc.) are deleted by this migration. Prior solves were cleared when the rewrite was applied.
