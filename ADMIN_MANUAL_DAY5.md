# Day 5 - Privacy: Admin Solver Manual

> Instructor use only. This file contains expected recoveries for all Day 5 challenges.

## Day 5 pack summary

- Challenge count: 10 total
- Difficulty split: 3 easy, 5 medium, 2 hard
- Delivery style: exploratory artifacts/web files + one hint each
- Scoring model: all 10 are `is_dynamic = true` (no static `KGSP{...}` flags stored anywhere)

## Expected answer map

Each challenge uses `/challenge/verify/<challenge_id>` to check a recovered **answer**.
When correct, the player receives a **personal flag** minted server-side:

`KGSP{<hmac(player_id, challenge_secret)[:12]>}`

That flag is unique per player and cannot be reused by other students.

| # | ID | Title | Level | File needed | Expected answer |
|---|----|-------|-------|-------------|-----------------|
| 1 | `p5_cookie_trail` | Cookie Flag Trail | Easy | `public/challenges/day5/cookie-trail.html` | `trail_of_crumbs` |
| 2 | `p5_firefox_profile_hunt` | Firefox Profile Hunt | Easy | `public/challenges/day5/firefox-profile-dump.txt` | `silentfox_archive` |
| 3 | `p5_consent_trap` | Consent Trap | Easy | `public/challenges/day5/consent-trap.html` | `reject_all_trackers` |
| 4 | `p5_gpc_unlock` | DNT/GPC Unlock | Medium | `public/challenges/day5/request-gateway.log` | `privacy_signal_seen` |
| 5 | `p5_history_reconstruction` | History Reconstruction | Medium | `public/challenges/day5/history-reconstruction.json` | `clinic_portal_last` |
| 6 | `p5_tracker_hunter` | Tracker Hunter | Medium | `public/challenges/day5/tracker-hunter.har` | `pixel_shadow_found` |
| 7 | `p5_storage_split` | Local Storage Split Flag | Medium | `public/challenges/day5/storage-split.txt` | `shards_reunited` |
| 8 | `p5_metadata_leak` | Metadata Leak | Medium | `public/challenges/day5/metadata-leak-exif.txt` | `midnight_lab_sparrow` |
| 9 | `p5_fingerprint_spoof` | Fingerprint Spoof Lite | Hard | `public/challenges/day5/fingerprint-gate.json` + live material | `mask_matches_profile` |
| 10 | `p5_tor_access_gate` | Tor Access Gate | Hard | `public/challenges/day5/tor-access-gate.log` + live material | `onion_gate_passed` |

## Hint design notes

- Every challenge has exactly one hint (`num_hints = 1`).
- Hints point to **what to inspect**, not exact step-by-step recipes.
- Hard challenges use live key material on the verify page:
  - `p5_fingerprint_spoof` live material: target timezone/language/screen profile.
  - `p5_tor_access_gate` live material: `xor_key_hex`.

## SQL source of truth

All Day 5 content above is inserted by:

- `supabase/migrations/20260709_0015_add_day5_ten_privacy_challenges.sql`

This migration also keeps Day 5 code-gated with default access code:

- `PRIVACY-2026`
