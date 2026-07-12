# Day 7 — Web Applications: Admin Solver Manual (v2)

> **Instructor use only.** Expected recoveries for the live Day 7 pack.

## Why v2 exists

v1 was fifteen `.txt` downloads (logic puzzles + “web” transcripts). Students
could paste every file into a chatbot and clear the board without opening a
browser. That fails the course goal.

v2 is **ten live pages** — cookies, DOM, storage, network, frames, a weak sink,
and a three-lock finale. **No downloadable artifacts.** Medium+ answers are
gated by browser state and/or `live_material` (never sitting as plaintext in the
JS bundle for the hard path).

**One test solve on old `d7_vm` (TEST_USER) was wiped** when v2 replaced Day 7.

## Pack summary

| | |
|--|--|
| Count | **10** — 3 easy · 4 medium · 2 hard · 1 danger |
| Day code | `WEB-2026` |
| Files | **None** (`asset_url` is null on every row) |
| Flag model | All `is_dynamic` → personal `KGSP{…}` via `verify_challenge_answer` |

## Answer map

| # | ID | Title | Level | Where | Answer |
|---|-----|-------|-------|-------|--------|
| 1 | `d7_markup_trail` | Markup Trail | Easy | `/challenge/markup-trail` | `ink_below` |
| 2 | `d7_side_door` | Side Door | Easy | `/challenge/side-door` → `/hatch` | `service_hatch` |
| 3 | `d7_desk_wizard` | Desk Wizard | Easy | `/challenge/desk-wizard` | `quiet_path` |
| 4 | `d7_role_chip` | Role Chip | Medium | `/challenge/role-chip` | `analyst_seat` |
| 5 | `d7_twin_check` | Twin Check | Medium | `/challenge/twin-check` | `both_match` |
| 6 | `d7_frame_whisper` | Frame Whisper | Medium | `/challenge/frame-whisper` | `posted_secret` |
| 7 | `d7_stash_order` | Stash Order | Medium | `/challenge/stash-order` | `abc_order` |
| 8 | `d7_blind_counter` | Blind Counter | Hard | `/challenge/blind-counter` | `gate_7k2` |
| 9 | `d7_friendly_sink` | Friendly Sink | Hard | `/challenge/friendly-sink` | `vault_spill` |
| 10 | `d7_triple_lock` | Triple Lock | Danger | `/challenge/triple-lock` | `all_three_open` |

---

## 1 · Markup Trail (easy)

Open the live page. In the Elements tree:

- `data-k="ink"`
- `data-k="_bel"`
- HTML comment `ow`

Concatenate → **`ink_below`**.

## 2 · Side Door (easy)

Open `/challenge/side-door` (sets visit cookie). Navigate to
**`/challenge/side-door/hatch`**. Page shows **`service_hatch`**.

## 3 · Desk Wizard (easy)

Choose: **Walk-in** → **Quiet-room access** → **Nobody — keep it internal**.
Then read `sessionStorage` key `d7_desk_recovery` (base64) → **`quiet_path`**.

## 4 · Role Chip (medium)

Cookie `d7_role` is base64 JSON with `role: guest`. Change `role` to
**`analyst`**, write the cookie back. Page decrypts → **`analyst_seat`**.

## 5 · Twin Check (medium)

Cookie `d7_pair` holds a random hex twin. Paste the same value into the form,
click Check twins → **`both_match`**.

## 6 · Frame Whisper (medium)

Open DevTools console, listen for `message` events (or catch the iframe’s
`postMessage`). Note payload → **`posted_secret`**.

## 7 · Stash Order (medium)

Click **Request floor plan**. Network → `/collect/desk-drawers` — order by
`seq`, read `seg`: `alpha`, `beta`, `gamma`. Set lasting storage:

- `d7_stash_a` = `alpha`
- `d7_stash_b` = `beta`
- `d7_stash_c` = `gamma`

Open vault → **`abc_order`**.

## 8 · Blind Counter (hard)

Eight positions. Probe glyph-by-glyph with the Ask UI until each seat shows
YES. Rebuild → **`gate_7k2`**.

## 9 · Friendly Sink (hard)

Filter strips `script` / `javascript:` only. Inject e.g.
`<img src=x onerror="document.body.append(window.__D7_VAULT)">` (any equivalent
sink). Vault value → **`vault_spill`**.

## 10 · Triple Lock (danger)

1. **Stamp visit** → cookie `d7_lock_c=hatch`
2. **Ping desk** → Network `/collect/desk-ping` → `seg=ping` (type `ping` into
   the middle field)
3. **Stash mark** → `localStorage d7_lock_s=lock`

Open triple lock → **`all_three_open`**.

---

## Instructor notes

- Day stays **locked + code-gated** until you open it (`WEB-2026`).
- Regenerating `challenge_answer_keys.secret` would invalidate personal flags —
  do not touch secrets after players have solved.
- Hints are vague on purpose. Do not strengthen them mid-event.
- Frontend routes live under `src/pages/day7/` + `App.tsx`.
