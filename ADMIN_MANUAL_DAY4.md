# Day 4 — Securing Networks: Admin Solver Manual

> **Instructor use only.** Contains every answer, solution path, and common
> mistake. Keep it off the projector.

## Why this exists (read this once)

Day 4 was rebuilt a second time after a student showed us its own failure
mode: uploading a challenge's `.pcap`/`.zip` straight into a chatbot with
code execution solved it in seconds — because our own challenge text/files
spelled out the exact decode recipe (CyberChef steps, an AES key sitting
right next to the ciphertext it decrypts), and one pcap's flag fragments
were literal `strings`-able ASCII, no analysis required at all.

The fix has two parts:

1. **No challenge text, file, or hint ever states the algorithm/tool chain.**
   Prompts describe the scenario and the goal only.
2. **Every flag is minted per player, server-side, and never exists as a
   static string anywhere.** Each challenge is split into an **answer**
   (what the player recovers — never flag-shaped) and a **personal flag**,
   computed as `HMAC(player_id, per-challenge secret)` only after the answer
   is verified correct. A flag one student earns will **never** validate for
   anyone else — pasting it into a group chat is now useless, and uploading
   just the downloadable file to an AI no longer produces anything
   submittable at all.

**Honest limits:** no challenge is un-solvable by a sufficiently capable
agentic AI with file upload, code execution, and browsing — the research is
unanimous on this (an autonomous agent won a full CTF outright in 2026). The
goal here is narrower and achievable: stop the *specific* failure mode we
saw (raw file → chatbot → instant flag) and stop flag-sharing between
students. Treat AI as a tutor a student can use *while* doing the work, not
a service that produces a submittable answer from the file alone.

---

## The mechanism (how it actually works now)

- `challenge_answer_keys` table: `answer` (the value the player must recover
  and submit), `secret` (random per-challenge HMAC seed), `live_material`
  (optional — decode keys shown **only** on the logged-in challenge page,
  deliberately never in the downloadable artifact).
- `verify_challenge_answer(player_id, token, challenge_id, answer)` — checks
  the answer server-side; on success, returns `'KGSP{' || hmac(player_id,
  secret)[:12] || '}'`. Does **not** award points by itself.
- `challenge_live_material(player_id, token, challenge_id)` — returns the
  withheld key material for challenges that need it, gated by an open day.
- `submit_flag` — unchanged for every static-flag challenge (Day 3, extras);
  for `is_dynamic` challenges it recomputes the same HMAC instead of a table
  lookup, so only the player who solved it can redeem it.
- Frontend: `AnswerVerifyChallenge.tsx` is a **generic** page
  (`/challenge/verify/:challengeId`) used by 6 of the 7 challenges — it shows
  any live material, takes the recovered answer, and displays the personal
  flag on success. `RouterConsoleChallenge.tsx` is the one bespoke page
  (nicer SNMP flavor) but calls the same `verify_challenge_answer` RPC.

**There is no fixed flag list anymore.** To check a student's actual solve,
use `/admin` → Players (shows real solves/points), not a lookup table. The
**answer** for each challenge (what instructors need to verify a submission
by eye, or help a stuck student) is listed below and also returned by
`admin_overview`.

---

## Challenge Map

| # | Title | Difficulty | Style / tool | Answer to recover |
|---|-------|-----------|--------------|--------------------|
| 1 | Cleartext Confessions | Easy | `.pcap` · Wireshark / online pcap viewer | `Wint3r2026!` |
| 2 | Hidden Cargo | Medium | carved `.png` · binwalk / unzip | `h1dden_aft3r_iend` |
| 3 | Field Report | Medium | `.jpg` EXIF · EXIF viewer + Google Maps | `statue_of_liberty` |
| 4 | The Chatty Router | Medium | live console · server RPC | `n0c_m0nit0r!` |
| 5 | Peeling the Onion | Hard | `.txt` + live key · CyberChef | `mult1_layer_r3cipe` |
| 6 | Needle in the Haystack | Hard | bigger `.pcap` · Wireshark statistics | `b34con_c2_f0und` |
| 7 | Deep Breach | ☠ Danger | `.zip` + live key · base64/AES | `d33p_breach_ch41n` |

All artifacts live under `public/challenges/day4/`. Regenerate with
`scripts/gen-day4-artifacts.py` (base set) — the v2 fixes described here were
applied by hand on top; if you rerun the generator from scratch, re-apply the
"no recipe / no co-located key" pattern described per challenge below.

---

## 1 · Cleartext Confessions — real pcap (Wireshark)

**Artifact:** `login-capture.pcap`.

Two POSTs to `/auth`: `guest`/`letmein` → 401 (decoy); `jbennett`/`Wint3r2026!`
→ 200 OK. Follow the stream that got a 200, read the password.

**Answer:** `Wint3r2026!`

> Unchanged from the first rebuild — there was never a recipe leak here. This
> tier remains the most AI-assistable one by nature (any code-execution tool
> can scan a pcap for ASCII), which is why it's priced as the cheapest
> challenge; the per-player flag is what actually stops sharing it.

---

## 2 · Hidden Cargo — file carving (PNG + appended ZIP)

**Artifact:** `network-diagram.png`.

Data appended after the PNG's `IEND` chunk is a ZIP. `binwalk -e`, rename to
`.zip`, or `unzip network-diagram.png` (it'll warn about leading image bytes,
then extract anyway) → `recovered/secret.txt` → `RECOVERY CODE:
h1dden_aft3r_iend`.

**Answer:** `h1dden_aft3r_iend`

> v2 change: the carved file used to read `KGSP{h1dden_aft3r_iend}` — flag-
> shaped text sitting in a file is exactly the kind of static, shareable
> string the whole redesign removes. It now reads as a plain "recovery code."

---

## 3 · Field Report — EXIF GPS + maps (OSINT)

**Artifact:** `recon-photo.jpg`.

EXIF GPS → **40.6892, −74.0445** → Google Maps → **Statue of Liberty**.

**Answer:** `statue_of_liberty`

> v2 change: the EXIF comment no longer says "Flag = ...". It states the
> answer *format* (lowercase, underscores) without using the word flag.

---

## 4 · The Chatty Router — live console (server-validated, per-player)

**Where:** `/challenge/router-console`. **Artifact:** `snmp-backup.txt`.

Config backup lists `public` (ro) and `n0c_m0nit0r!` (rw). Send the rw string
in the live console. `verify_challenge_answer` checks it and returns a flag
**personal to that player** — nothing flag-shaped exists in the page, the
file, or the database.

**Answer:** `n0c_m0nit0r!`

> v2 change: previously backed by a bespoke `net_router_query` function that
> returned one static flag for everyone. Now uses the shared per-player RPC.

---

## 5 · Peeling the Onion — CyberChef, key delivered live

**Artifact:** `intercepted.txt` (payload only) + **live page** (the key).

Payload is `Base64( gzip( XOR(answer, key) ) )`. Opening
`/challenge/verify/net_cyberchef` while logged in shows **Session
material → Key (hex): `4b3379523074`** — this key is deliberately absent
from the downloaded file. Recipe (not stated to players): From Base64 →
Gunzip → XOR (key hex, from the live page).

**Answer:** `mult1_layer_r3cipe`

> v2 change: the file used to spell out "Recommended CyberChef recipe: From
> Base64 → Gunzip → XOR (key ..., HEX)" **and** the key itself — this is the
> exact recipe a code-execution AI followed verbatim in the incident that
> triggered this rebuild. Both are gone from the file now; the key only
> appears on the logged-in live page, so uploading just the `.txt` gets an AI
> (or a student) nowhere.

---

## 6 · Needle in the Haystack — pcap hunt (Wireshark statistics)

**Artifact:** `traffic-dump.pcap`.

Host `10.20.0.15` beacons to **`185.220.101.44:8443`** three times, ~30s
apart. Best found via Statistics → Conversations or a filter on that IP.
Each beacon carries `SEQ n/3 CHK=<base64 chunk>` — reassemble the three
chunks **in order** and Base64-decode.

**Answer:** `b34con_c2_f0und`

> v2 change (real bug fix, not just an AI issue): the beacon payloads used to
> be literal ASCII `payload=KGSP{...}` fragments — `strings traffic-dump.pcap
> | grep KGSP` solved it instantly, no packet analysis needed, human or AI.
> They're now Base64 chunks with neutral framing; the answer only emerges
> after reassembling in the right order **and** decoding.

---

## 7 · Deep Breach — two-stage chain, key delivered live (Danger)

**Artifact:** `breach-kit.zip` (ciphertext only) + **live page** (key + IV).

Opening `/challenge/verify/net_chain_danger` shows **Key (hex)** and
**IV (hex)**. Byte lengths (32-byte key, 16-byte IV) point to AES-256-CBC.
Decrypt `payload.enc.hex` with them (CyberChef *From Hex → AES Decrypt*, or
`xxd -r -p payload.enc.hex | openssl enc -d -aes-256-cbc -nosalt -K <KEY>
-iv <IV>`).

**Answer:** `d33p_breach_ch41n`

> v2 change: this is the other challenge shown solved end-to-end in the
> incident — `stage1.b64` sat right next to the ciphertext it unlocked, and
> the README named the exact algorithm and openssl command. `stage1.b64` is
> gone entirely; the key/IV now only exist on the live page; the README
> names no algorithm.

---

## Extra challenges (optional bonus)

Day 4 carries **two** `is_extra` bonus challenges (both per-player dynamic — no
static flag in the source or in any file).

> **Removed 2026-07-08:** the three "target box" extras — Rogue Port (nmap),
> Tapped Wire (Wireshark), Rogue Resolver (dig) — that required the instructor
> to run a host and hand out its IP have been **deleted**. They had zero solves,
> so no player scores were affected, and the `target-box/` folder was removed
> from the repo. Future challenges must never depend on the instructor sharing
> an IP (see the design rules below).

### Web extras — now per-player

- **Trust No Cookie** (`/challenge/admin-panel`): forge `role=admin` in your
  browser, then the page mints your personal flag from the server. The flag is
  no longer hardcoded in the JavaScript. Answer key: role = `admin`.
- **The Deep Web** (chain): `robots.txt` → base64 breadcrumb →
  `/s3cr3t-vault.html` → `strings vault.png`. The image now yields a
  **recovery code** (`d33p_w3b_tr4v3ler`), not a flag; the student enters it on
  `/challenge/verify/chain` for their personal flag. (Residual note: the chain
  is public static content, so an AI that can browse the URL can still follow
  it — the per-player change stops flag-sharing and source-reading, not a
  browsing agent. Truly closing that needs server-gated steps.)

## Interactive / live routes

| Challenge | Route |
|-----------|-------|
| The Chatty Router | `/challenge/router-console` (bespoke page) |
| Trust No Cookie | `/challenge/admin-panel` (bespoke page) |
| Everything else with a live component | `/challenge/verify/<challenge_id>` (generic page) |

---

## Design rules for any future Day 4+ challenge

1. **Never state the algorithm, tool chain, or decode order** in the prompt,
   file, or hint. Hints may nudge *what to look at*, never hand over the
   *procedure*.
2. **Never put a key next to the ciphertext it unlocks.** If a challenge
   needs a key, deliver it via `challenge_live_material` (live, logged-in
   page only) or via a separate correlated clue — never in the same
   downloadable artifact.
3. **Nothing flag-shaped (`KGSP{...}`) should exist in any file, prompt, or
   client code.** Use `is_dynamic` + `challenge_answer_keys` so the flag is
   minted server-side per player and never stored as a static string.
4. **Sanity-check every generated artifact for plaintext leaks** before
   shipping — `grep`/`strings` the file for the answer and for `KGSP` the way
   `scripts/gen-day4-artifacts.py`'s assertions do. A human running `strings`
   should not solve the challenge for free any more than an AI should.

---

## Opening Day 4 Checklist

- [ ] Open Day 4 in Admin Panel (also required for `challenge_live_material`
      and `verify_challenge_answer` to work — both check the day is open)
- [ ] Set Day 4 as the Active Day
- [ ] Add or clear the Day 4 access code
- [ ] Start the timer
- [ ] Open `/board` on the projector

> Last updated: per-player dynamic flags, live-delivered keys, no recipes
> anywhere, pcap plaintext-leak fixed.
