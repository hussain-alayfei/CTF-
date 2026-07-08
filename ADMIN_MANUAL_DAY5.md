# Day 5 — Privacy: Admin Solver Manual

> **Instructor use only.** Contains every answer, the solve path, and the
> live keys. Keep it off the projector.

## Why this exists

Day 5 continues the Day 4 anti-AI / anti-sharing model:

1. **Every challenge is per-player dynamic.** The value a student recovers is an
   **answer** (never flag-shaped). Only after `verify_challenge_answer` confirms it
   does the server mint a **personal flag** `KGSP{hmac(player_id, secret)[:12]}`.
   A flag one student earns will never validate for anyone else — pasting it in a
   group chat is useless.
2. **No prompt, file, or hint states the tool chain or the decode recipe.**
3. **Nothing flag-shaped exists in any artifact**, and `gen-day5-artifacts.py`
   asserts no plaintext answer (or `KGSP`) leaks into a file before shipping.
4. **The two hardest challenges need a key delivered live** on the challenge page
   (`challenge_live_material`), never inside the download — so uploading just the
   file to a chatbot produces nothing submittable.

Theme (from the syllabus): Web Browsing & Privacy, History/Cookies, Private
Browsing with Tor/VPN, Anonymity. Two challenges (Exit Node Eyes, Peeling the
Onion Router) align with the TryHackMe "Tor for Beginners" room.

Artifacts live in `public/challenges/day5/` and are regenerated with
`python scripts/gen-day5-artifacts.py` (pure stdlib, no dependencies). To check a
student's real solve, use `/admin` -> Players (never a lookup table).

---

## Challenge map

| # | Title | Difficulty | Skill / tool | Answer to recover |
|---|-------|-----------|--------------|--------------------|
| 1 | Cookie Crumbs | Easy | Browser DevTools + base64/hex/ROT13 | `st0p_tr4ck1ng_m3` |
| 2 | Metadata Betrayal | Medium | PDF metadata (exiftool) + maps | `eiffel_tower_magpie` |
| 3 | Exit Node Eyes | Medium | Wireshark + base64 (Tor exit) | `exit_nodes_see_http` |
| 4 | Zero-Width Whisper | Hard | Zero-width unicode stego | `1nv1s1bl3_1nk` |
| 5 | Peeling the Onion Router | Hard | Base64 -> Base32 -> XOR (live key) | `thr33_h0ps` |
| 6 | The De-Anonymizer | Danger | k-anonymity linkage + XOR (live key) | `anon_is_not_private` |

**Live keys** (shown to the student on the challenge page via
`challenge_live_material`; also stored in `challenge_answer_keys.live_material`):

- Peeling the Onion Router (`p_onion`): `key_hex = a1b2c3d4`
- The De-Anonymizer (`p_deanon`): `key_hex = 7e11`

Day access code (change it in the panel if you like): `PRIVACY-2026`.

---

## 1 - Cookie Crumbs (easy) — `/challenge/cookie-crumbs`

On **Accept tracking** the page plants one ID split across three stores, each
lightly obfuscated:

- cookie `_utm_track = c3QwcF8=`  -> base64 -> `st0p_`
- localStorage `_ga_client = 7472346b316e675f` -> hex -> `tr4ck1ng_`
- sessionStorage `_sess_fp = z3` -> ROT13 -> `m3`

Join in order: **`st0p_tr4ck1ng_m3`**. Teaches cross-store tracking + why
clearing only cookies is not enough.

## 2 - Metadata Betrayal (medium) — `press-release.pdf`

The visible page is boring; the PDF **properties** leak everything. `exiftool
press-release.pdf` (or any PDF metadata viewer) shows `Author: magpie` and
`Subject: Location 48.8584, 2.2945`. Those coordinates are the **Eiffel Tower**.

**Answer:** `eiffel_tower_magpie` (venue common name + `_` + author codename).

## 3 - Exit Node Eyes (medium, Tor #1) — `tor-exit.pcap`

Traffic as seen by a **Tor exit relay**. Most conversations are TLS (0x16/0x17
records) and unreadable. Exactly one is plain **HTTP** to
`mail.riverside-coop.example` and carries an `Authorization: Basic` header. Base64
-decode it (`Y291cmllcjpleGl0X25vZGVzX3NlZV9odHRw`) ->
`courier:exit_nodes_see_http`; the **password** is the answer.

**Answer:** `exit_nodes_see_http`. Lesson: Tor anonymises *who*, not *what* you
send to an unencrypted site — the exit node sees plaintext.

## 4 - Zero-Width Whisper (hard) — `memo.txt`

The memo hides the answer in **zero-width characters** between visible letters
(right after the word "clean"). Scheme: `U+200B` = bit 0, `U+200C` = bit 1,
8 bits per character, MSB first. Extract those chars in order, regroup into bytes,
decode ASCII.

Quick decoder:

```python
t = open('memo.txt', encoding='utf-8').read()
bits = ''.join('0' if c=='\u200b' else '1' for c in t if c in '\u200b\u200c')
print(''.join(chr(int(bits[i:i+8],2)) for i in range(0,len(bits),8)))
```

**Answer:** `1nv1s1bl3_1nk`.

## 5 - Peeling the Onion Router (hard, Tor #2) — `onion.txt` + live key

The payload is wrapped like onion routing: **From Base64 -> From Base32 -> XOR**
with the live key `a1b2c3d4` (repeating). CyberChef recipe: From Base64, From
Base32, XOR (key `a1b2c3d4`, HEX).

```python
import base64
outer = open('onion.txt').read().strip().splitlines()[-1]
inner = base64.b32decode(base64.b64decode(outer))
key = bytes.fromhex('a1b2c3d4')
print(bytes(b^key[i%len(key)] for i,b in enumerate(inner)).decode())
```

**Answer:** `thr33_h0ps`.

## 6 - The De-Anonymizer (danger) — `deanon.zip` + live key

`deanon.zip` has `anonymized_users.csv` (names removed, `pseudo_id` + quasi-
identifiers + an obscured `private_note`) and the public `voter_roll.csv`.

1. Find **Rania Alharbi** in `voter_roll.csv` -> her `(zipcode, birthdate,
   gender)` = `(31999, 1998-03-14, F)`. That triple is **unique** (most others
   collide — the whole point: only some people are re-identifiable).
2. Find the matching row in `anonymized_users.csv`; read its `private_note` (hex).
3. XOR-decode it with the live key `7e11` (repeating):

```python
note = '1f7f117f21780d4e107e0a4e0e6317671f651b'  # Rania's private_note
key = bytes.fromhex('7e11')
print(bytes(b^key[i%len(key)] for i,b in enumerate(bytes.fromhex(note))).decode())
```

**Answer:** `anon_is_not_private`. Lesson: stripping names is not anonymisation
(Sweeney / Netflix-style linkage attacks).

> The `private_note` hex is regenerated each time you rerun the artifact script,
> but the decoded answer is always `anon_is_not_private`.

---

## Opening Day 5 checklist

- [ ] `python scripts/gen-day5-artifacts.py` has been run and the files are in
      `public/challenges/day5/` (already committed).
- [ ] Frontend deployed (Cookie Crumbs route + Day 5 verify pages live).
- [ ] In `/admin`: **Unlock** Day 5, set it as the **Active Day**.
- [ ] Confirm/replace the Day 5 access code (default `PRIVACY-2026`).
- [ ] Set the timer (and a score freeze, e.g. 15 min, if you want the board
      blackout for the finish).
- [ ] Open `/board` on the projector and click **Enable sound** once.
