# Day 10 — Final CTF Challenges: Admin Solver Manual

> **Instructor use only.** Contains every answer and solution path. Keep it off the projector.  
> Site: `https://ctf-two-alpha.vercel.app` · Day code: **`FINAL-2026`** · **20 challenges** · Day stays **locked** until you open it.

## Scoring (finale tiers)

| Tier | Base | Decay step | Floor | First blood |
|------|------|------------|-------|-------------|
| Easy | 100 | 5 | 50 | +25 |
| Medium | 250 | 15 | 125 | +25 |
| Hard | 400 | 20 | 200 | +25 |
| Danger | 500 | 25 | 250 | +25 |

All challenges are **dynamic**. Students recover an **answer** (never `KGSP{…}`), verify on the lab/verify page, then submit the personal flag in the arena modal.

## Quick map

| # | ID | Title | Level | Answer |
|---|-----|-------|-------|--------|
| 1 | `d10_deep_static` | Deep Static | Easy | `spectrum_glyph` |
| 2 | `d10_hidden_home` | Curious Intern | Easy | `always_check_dots` |
| 3 | `d10_forgot_path` | Forgot-Me-Not | Easy | `backup_temp_note` |
| 4 | `d10_loose_equals` | Soft Gate | Easy | `zero_match_ok` |
| 5 | `d10_clear_stream` | Overnight Desk | Easy | `http_desk_slip` |
| 6 | `d10_ghost_canvas` | Ghost Canvas | Medium | `blue_branch_whisper` |
| 7 | `d10_usb_polyglot` | Parking Lot USB | Medium | `usb_inner_pass` |
| 8 | `d10_secret_album` | Admin Album | Medium | `album_104_seal` |
| 9 | `d10_poisoned_prefs` | Poisoned Prefs | Medium | `prefs_exec_token` |
| 10 | `d10_office_leak` | Curious Admin | Medium | `c2_payload_tag` |
| 11 | `d10_process_residue` | Memory Residue | Medium | `ram_key_shard` |
| 12 | `d10_gallery_lock` | Gallery Lock | Medium | `curator_bypass` |
| 13 | `d10_relay_note` | Relay Note | Medium | `relay_plain_ok` |
| 14 | `d10_license_vm` | License Lattice | Hard | `vm_license_ok` |
| 15 | `d10_rsa_broadcast` | Triple Broadcast | Hard | `crt_message` |
| 16 | `d10_false_debug` | False Debugger | Hard | `true_core_flag` |
| 17 | `d10_layered_breach` | Layered Breach | Hard | `breach_full_chain` |
| 18 | `d10_inherited_trust` | Inherited Trust | Danger | `chief_final_clear` |
| 19 | `d10_race_window` | Race Window | Danger | `race_final_ok` |
| 20 | `d10_capstone_chain` | Final Desk | Danger | `novatech_closed` |

Regenerate artifacts with `python scripts/gen-day10-final.py` then **re-apply** the content migration (secrets change).

---

## Easy

### 1 · Deep Static · `spectrum_glyph`
Open `deep-static.wav` in Audacity → Spectrogram view → read the painted word.

### 2 · Curious Intern · `always_check_dots`
Unzip `Intern_Home.zip`. Enable hidden files. Read `home/.secret` (history hints `nano .secret`).

### 3 · Forgot-Me-Not · `backup_temp_note`
Open lab → follow `/challenge/forgot-path/assets/backups/temp/` → read `programmer_notes.log`.

### 4 · Soft Gate · `zero_match_ok`
Stored verifier is `0e830482052480`. Submit any `0e`+digits password (loose numeric match). Plaque decrypts with seed `0e`.

### 5 · Overnight Desk · `http_desk_slip`
Open `overnight-desk.pcap` → follow HTTP stream to `/desk/slip.txt`.

---

## Medium

### 6 · Ghost Canvas · `blue_branch_whisper`
Isolate the blue channel of `silence_of_the_woods.png` → read `blue_branch`. Live page suffix `_whisper`.

### 7 · Parking Lot USB · `usb_inner_pass`
`company_logo.png` is PNG+ZIP. Carve/extract ZIP → `credentials.txt` cipher_hex. Live seed `lot` → XOR with SHA-256(`lot`).

### 8 · Admin Album · `album_104_seal`
Change album id from 105 → 104. Plaque decrypts with seed `104`.

### 9 · Poisoned Prefs · `prefs_exec_token`
Cookie `d10_prefs` = base64 JSON. Set `"role":"admin"`. Plaque seed `admin`.

### 10 · Curious Admin · `c2_payload_tag`
`office-capture.pcap` has `transfer-id: c2_payload`. Live fragment `_tag`.

### 11 · Memory Residue · `ram_key_shard`
`process-residue.bin` contains `NTPROC\0ram_key\0END`. Live suffix `_shard`.

### 12 · Gallery Lock · `curator_bypass`
Open `/challenge/gallery-lock/vault`. Set `localStorage.d10_gallery_role=curator`. Plaque seed `curator`.

### 13 · Relay Note · `relay_plain_ok`
`relay-note.txt` cipher_hex XOR live `key_hex` (repeating).

---

## Hard

### 14 · License Lattice · `vm_license_ok`
Targets are `char XOR 0x1b`. Key = `LATTICE9`. Plaque seed `lattice`.

### 15 · Triple Broadcast · `crt_message`
RSA broadcast with `e=3` (shown live). CRT three ciphertexts → cube root → ASCII.

### 16 · False Debugger · `true_core_flag`
Set `localStorage.d10_analysis_trap=0` and `d10_core_bypass=1`. Fake plaque `TryAgain_not_real` while trap armed. Real plaque seed `core`.

### 17 · Layered Breach · `breach_full_chain`
ZIP: `stage=breach` + `stage=full` → `breach_full` + live suffix `_chain`.

---

## Danger

### 18 · Inherited Trust · `chief_final_clear`
Prototype pollution via `constructor.prototype` (literal `__proto__` blocked):
1. Merge `{ "constructor": { "prototype": { "deskRole": "chief" } } }` → stage 2.
2. Same plus `"deskSeal":"D10-SEAL"` (seal on page) in one merge → plaque (`chief`).

### 19 · Race Window · `race_final_ok`
1. Arm desk (cookie).
2. Reserve as guest (ticket in sessionStorage).
3. Within 450ms: set `localStorage.d10_race_role=admin`, Confirm. Plaque seed `race`.

### 20 · Final Desk · `novatech_closed`
Server-gated via `d10_lab_step`:
1. `backup_temp_note`
2. `album_104_seal`
3. `c2_payload_tag`
4. Live gate `n10-final`
Then plaque decrypts with seed `closed`.

---

## Ops

- Day code: **FINAL-2026**
- Leave `is_open=false` until class time
- Artifacts under `public/challenges/day10/`
- Migrations: `20260716_1400_day10_schema_rpc.sql`, `20260716_1410_day10_final_ctf_v1.sql`
