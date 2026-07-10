# Day 5 — Privacy: Admin Solver Manual (v4)

> **Instructor use only.** Expected recoveries for the hands-on Day 5 pack.

## Why v4 exists

v3 was a good crypto pack but monotonous and file-heavy: almost every medium+
challenge was "download a file, read the page key, XOR them." A student could
defeat the whole tier by pasting one file plus the page key into a chatbot, and
the sameness made it feel cheap.

v4 rebuilds the medium/hard/danger tier around **live, hands-on browser work**
that a chatbot cannot do for the student, because there is no single file to
paste — the task lives in the student's own browser (DevTools, spoofing
timezone/locale/screen, editing cookies/storage, watching the network,
reducing fingerprint entropy, cross-linking datasets). Only **two challenges are
file-based**: the kept easy `places.sqlite` bookmark vault and one image
forensics challenge.

**Anti-AI model, honestly stated:** for the fingerprint challenges the answer is
stored *only* as ciphertext whose key is the student's real environment, so the
plaintext exists neither in the JS bundle nor in the RPC response — it
materialises only in a correctly-configured browser. The danger challenge is
**server-gated**: the recovery token is released only after the correct unique
linkage is submitted. The realistic bar we enforce: pasting page source or a
file into a chatbot yields nothing submittable, and every medium+ challenge
requires real browser hands. A student who screen-shares their browser to an AI
agent can still be coached — that is assisted solving, which is acceptable.

## Pack summary

- **10 challenges** — 3 easy · 4 medium · 2 hard · 1 danger, all `is_dynamic`.
- Day code: `PRIVACY-2026`.
- Only 2 file downloads: `places.sqlite` (easy) and `metadata-mirage.jpg` (medium).
- Regenerate the image + crypto material + migration:
  `python scripts/gen-day5-privacy.py`
  (the image session key is random per run — re-apply the emitted migration if
  you regenerate).

## Answer map

| # | ID | Title | Level | Where | Answer |
|---|-----|-------|-------|-------|--------|
| 1 | `p5_cache_phantom` | Cache Phantom | Easy | Live `/challenge/cache-phantom` | `crumbs_trail` |
| 2 | `p5_bookmark_vault` | Bookmark Vault | Easy | File `places.sqlite` | `route_17` |
| 3 | `p5_consent_labyrinth` | Consent Labyrinth | Easy | Live `/challenge/consent-labyrinth` | `narrow_path` |
| 4 | `p5_ghost_profile` | Ghost Profile | Medium | Live `/challenge/ghost-profile` | `kiosk_admitted` |
| 5 | `p5_referer_burn` | Referer Burn | Medium | Live `/challenge/referer-burn` | `leak_via_referer` |
| 6 | `p5_metadata_mirage` | Metadata Mirage | Medium | File `metadata-mirage.jpg` + page key | `north_dock_gate` |
| 7 | `p5_cookie_jar` | Cookie Jar | Medium | Live `/challenge/cookie-jar` | `tier_escalated` |
| 8 | `p5_entropy_portal` | Entropy Portal | Hard | Live `/challenge/entropy-portal` | `blend_into_crowd` |
| 9 | `p5_supercookie` | Supercookie | Hard | Live `/challenge/supercookie` | `evercookie_rebuilt` |
| 10 | `p5_reidentified` | Re-Identified | Danger | Live `/challenge/re-identified` | `subject_relinked` |

> The image session key and the fingerprint reveal ciphertexts live in
> `challenge_answer_keys.live_material` and in the emitted migration
> (`supabase/migrations/*_rewrite_day5_privacy_v4.sql`). Read those to help a
> stuck student; don't read answers aloud in class.

---

## 1 · Cache Phantom (easy) — unchanged

Accept tracking → DevTools ▸ Application: cookie `_ck` (base64 → `crum`), local
storage `_ls` (reverse → `crumbs`), IndexedDB `ctf_cache_phantom_v1`/`shards`/`c`
→ `trail`. → **`crumbs_trail`**.

## 2 · Bookmark Vault (easy) — unchanged, file

Open `places.sqlite`, join `moz_bookmarks`↔`moz_places`. "Operations Vault" URL
contains **`route_17`**.

## 3 · Consent Labyrinth (easy) — unchanged

Functional ✓ · Marketing ✗ · Analytics ✗ · Security ✓ · Sell-data ✗ ·
Essential-storage ✓ → `sessionStorage._cl_recovery` (base64) → **`narrow_path`**.

## 4 · Ghost Profile (medium) — live fingerprint match

Open the page. It wants a kiosk profile: **timezone `Europe/London`, locale
`en-GB`, screen `1280x720`**. Student uses DevTools:
- Sensors ▸ Location ▸ *Other…* → set **Timezone ID** `Europe/London` and
  **Locale** `en-GB`.
- Device Toolbar (responsive) → set viewport so `screen` reads `1280x720`.

When all three show ✓ the page decrypts and displays the intake token
**`kiosk_admitted`**. (The token is XORed with SHA-256 of
`Europe/London|en-GB|1280x720`; it only decrypts in a matching browser.)

## 5 · Referer Burn (medium) — network inspection

Open DevTools ▸ Network, filter to `partner-pixel`, click **Share to partners**.
Three pixel requests fire out of order, each with `seq` and `seg` query params:
`seq=1 seg=leak`, `seq=2 seg=_via_`, `seq=3 seg=referer`. Order by `seq` and
concatenate → **`leak_via_referer`**. (Fragments come from the server, so they
are not in the page source.)

## 6 · Metadata Mirage (medium) — image forensics + page key

Download `metadata-mirage.jpg`. Its visible sign is redacted, but EXIF
`ImageDescription` holds `residual-export-note;xor=<hex>` (read with any real
metadata tool). The challenge page shows a **session key (hex)** (48 bytes).
XOR the note's cipher bytes with the session-key bytes → **`north_dock_gate`**.
(GPS + thumbnail in the file are flavour; the note alone is meaningless without
the page key.)

## 7 · Cookie Jar (medium) — cookie tampering

The page trusts two cookies it set: `cw_tier=guest`, `cw_consent=granted`. In
DevTools ▸ Application ▸ Cookies, edit them to **`cw_tier=member`** and
**`cw_consent=revoked`**. The dossier then decrypts and shows the recovery tag
**`tier_escalated`**. (Reveal is keyed to `member|revoked`; wrong posture → no
plaintext.)

## 8 · Entropy Portal (hard) — reduce fingerprint entropy

Opposite of Ghost Profile: match the **common crowd baseline on all five traits
at once** — timezone `America/New_York`, locale `en-US`, screen `1920x1080`,
colour scheme `light`, pixel ratio `1`. Use Sensors (timezone/locale), Device
Toolbar (screen + DPR = 1), and Rendering ▸ *Emulate CSS prefers-color-scheme:
light*. All five ✓ → token **`blend_into_crowd`**.

## 9 · Supercookie (hard) — multi-vector reassembly

Click **Let the tracker tag me**. The id is scattered, in this order, across:
1. cookie `sc_id` → `ever`
2. localStorage `sc_id` → `cookie`
3. sessionStorage `sc_id` → `_re`
4. IndexedDB `ctf_supercookie_v1`/`vault`/`seg` → `buil`
5. Cache Storage `ctf-sc-v1` ▸ `/sc/segment` (response body) → `t`

Read each from DevTools ▸ Application and join in that order →
**`evercookie_rebuilt`**. (Cache Storage is the vector students miss.)

## 10 · Re-Identified (danger) — server-side query exploration (v2)

**Anti-AI note:** The anonymized patient table is NOT in the JS bundle (v1's fatal
flaw). It lives only inside the `query_anon_db` RPC. The page shows a query
interface; students must make API calls to explore the search space.

**Solve path:** Open the challenge page. Use the query tool:
- Start broad, narrow down. The answer is (age=29, zip=11215, gender=F) → count=1.
- Good exploration: filter by zip=11215 first (3 zip codes to try), then add gender=F,
  then age — or try individual ages. Smart path ≈ 5–8 queries.
- When count=1 the tool reveals: **anon_id `A-7731`**, condition **HIV treatment**.
- Cross-reference the public roll (visible in the UI): the one 29-year-old F in
  11215 is **`V-2050` Nadia Osman**.

Submit: `A-7731` / `V-2050` → `verify_reident` confirms the linkage → returns
`subject_relinked` → auto-exchanged for the personal flag.

**Budget:** 40 queries total per player; max 3 per 15 seconds. All other
(count > 1) pairs are rejected. Re-identifying Nadia exposes her HIV-treatment
record — the privacy harm the lesson is about.

---

## Anti-AI notes for instructors

- **Chatbot paste → nothing.** Only 2 files; every other answer needs live browser work.
- **Bundle grep → nothing.** No answer string ships in JS. Confirmed at build.
- **Fingerprint answers exist nowhere as plaintext** until the browser matches.
- **Danger (Re-Identified v2):** The anonymized data is GONE from the JS bundle.
  The page shows an empty query interface — pasting the source into a chatbot gives
  only the public roll. The anonymized data lives only inside `query_anon_db` RPC
  body (a Postgres VALUES clause), never in any table the client can SELECT.
  Even a student who fully understands the solution must make real API calls (rate-
  limited, budgeted) to confirm it. Reading the page gives ≈ half the picture.
- **Flag-sharing → nothing:** flags are per-player HMAC via `verify_challenge_answer`.

## SQL / generator source

- `scripts/gen-day5-privacy.py` (image + crypto material + v4 migration).
- `supabase/migrations/20260709_1233_rewrite_day5_privacy_v4.sql` (challenge rows).
- `supabase/migrations/20260710_1700_reident_server_query.sql` (Re-Identified v2:
  `reident_query_log` table + `query_anon_db` RPC).
- **Do NOT regenerate** without re-applying both migrations — image session key
  changes on every generator run.
