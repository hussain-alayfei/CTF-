# Day 4 — Securing Networks: Admin Solver Manual

> **Instructor use only.** Contains every flag, solution path, and common
> mistake. Keep it off the projector.

Day 4 was **redesigned to resist "paste-it-into-an-AI" solving**. The old set
had the answer sitting in the prompt text (subnetting, ACL logic) or the flag
hardcoded in the page's JavaScript. The rebuilt set instead:

- **Keeps every flag server-side.** No flag string ships in the client bundle.
  Flags live in Supabase `challenge_flags` and are checked by `submit_flag`; the
  live console challenge only releases its flag from a Postgres function.
- **Forces a real tool or website** for each challenge — Wireshark, CyberChef,
  an EXIF viewer + maps, file carving, or a live server round-trip.
- **Uses genuine binary artifacts** (a real `.pcap`, a carved `.png`, a `.jpg`
  with real EXIF GPS, an encrypted `.zip`) that can't just be pasted as text.

> Honest expectation: a capable multimodal AI with file upload + code execution
> can still *assist* on any of these. The goal is that no challenge is solved by
> pasting the prompt into a chatbot — students must actually operate the tool.
> Treat AI as a tutor, not a solver.

---

## Challenge Map

| # | Title | Difficulty | Style / tool | Flag |
|---|-------|-----------|--------------|------|
| 1 | Cleartext Confessions | Easy | `.pcap` · Wireshark / online pcap viewer | `KGSP{Wint3r2026!}` |
| 2 | Hidden Cargo | Medium | carved `.png` · binwalk / unzip | `KGSP{h1dden_aft3r_iend}` |
| 3 | Field Report | Medium | `.jpg` EXIF · EXIF viewer + Google Maps | `KGSP{statue_of_liberty}` |
| 4 | The Chatty Router | Medium | live console · server RPC | `KGSP{snmp_c0mmunity_pwn3d}` |
| 5 | Peeling the Onion | Hard | `.txt` · CyberChef multi-layer | `KGSP{mult1_layer_r3cipe}` |
| 6 | Needle in the Haystack | Hard | bigger `.pcap` · Wireshark statistics | `KGSP{b34con_c2_f0und}` |
| 7 | Deep Breach | ☠ Danger | nested `.zip` · base64 + AES | `KGSP{d33p_breach_ch41n}` |

All artifacts live under `public/challenges/day4/`.

---

## 1 · Cleartext Confessions — real pcap (Wireshark)

**Artifact:** `login-capture.pcap` (download button).

**Skill:** reading credentials sent over plain HTTP.

The capture has **two** POSTs to `/auth` on port 80:
- `guest` / `letmein` → **401 Unauthorized** (decoy).
- `jbennett` / `Wint3r2026!` → **200 OK** ("Welcome back, jbennett").

Students open the pcap in **Wireshark → Follow → HTTP/TCP Stream** (or an online
viewer like apackets.com), find the stream that got a **200**, and read the
password from its form body.

**Flag:** `KGSP{Wint3r2026!}`

**Common mistakes:** submitting the decoy `letmein` (that login was rejected);
including `username=`.

---

## 2 · Hidden Cargo — file carving (PNG + appended ZIP)

**Artifact:** `network-diagram.png` (download button).

**Skill:** data appended after a PNG's `IEND` chunk still renders as a normal
image but is recoverable as an archive.

Solve paths (any one):
- `binwalk -e network-diagram.png`
- rename to `.zip`, or run `unzip network-diagram.png` (unzip warns about the
  leading image bytes, then extracts anyway)
- an online "extract files from image" / carving site
- a hex editor — spot the `PK` ZIP header after the image data

Inside: `recovered/secret.txt` → the flag.

**Flag:** `KGSP{h1dden_aft3r_iend}`

**Common mistakes:** running a stego tool expecting LSB data (it's appended, not
steganographic); giving up when the image "looks normal."

---

## 3 · Field Report — EXIF GPS + maps (OSINT)

**Artifact:** `recon-photo.jpg` (download button).

**Skill:** photos carry GPS in EXIF; coordinates → a real-world landmark.

Students read the EXIF with an **online EXIF viewer** (exif.tools,
metadata2go, etc.) or `exiftool`. The GPS points to **40.6892, −74.0445** →
drop into **Google Maps** → the **Statue of Liberty**. The embedded
`UserComment` states the format explicitly: common English name, lowercase,
words joined by underscores.

**Flag:** `KGSP{statue_of_liberty}`

**Common mistakes:** wrong separators (`statue-of-liberty`, `statueofliberty`);
naming "Liberty Island" instead of the monument. The EXIF comment gives the
exact format — point stuck students at it.

---

## 4 · The Chatty Router — live console (server-validated)

**Where:** the "Open challenge" button opens `/challenge/router-console`.
**Artifact:** `snmp-backup.txt` (download button on the same card).

**Skill:** SNMP community strings; `ro` vs `rw`.

The config backup lists two communities:
- `public` (ro) — read-only
- `n0c_m0nit0r!` (rw) — **read-write**, the one that reaches the flag OID

Students send `n0c_m0nit0r!` in the live console. The server function
`net_router_query` verifies it and returns the flag — **the flag is not in the
page or bundle**, so inspecting the source (or an AI reading it) reveals
nothing. Sending `public` returns decoy OIDs + a nudge.

**Flag:** `KGSP{snmp_c0mmunity_pwn3d}`

**Common mistakes:** submitting the ro community `public`; submitting the OID.

> Backend note: `net_router_query(text)` only releases the flag while **Day 4 is
> open**. If students get "administratively locked," open Day 4 in the admin
> panel.

---

## 5 · Peeling the Onion — CyberChef multi-layer

**Artifact:** `intercepted.txt` (download button).

**Skill:** chaining decode operations in the right order.

The payload is `Base64( gzip( XOR(flag, key) ) )`. The file names the three
layers and gives the XOR key in hex (`4b3379523074`). In **CyberChef**:

```
From Base64  →  Gunzip  →  XOR (key 4b3379523074, HEX)
```

**Flag:** `KGSP{mult1_layer_r3cipe}`

**Common mistakes:** wrong order; leaving the XOR key type as UTF-8 instead of
HEX; expecting CyberChef "Magic" to one-shot it (the multi-byte XOR defeats it).

---

## 6 · Needle in the Haystack — pcap hunt (Wireshark statistics)

**Artifact:** `traffic-dump.pcap` (download button).

**Skill:** finding a periodic C2 beacon inside noise.

Among ~12 benign HTTP/DNS conversations, host `10.20.0.15` beacons to
**`185.220.101.44:8443`** **three times, ~30 s apart**. Best found via
**Wireshark → Statistics → Conversations** (the repeat external talker) or a
filter like `ip.addr == 185.220.101.44`. Each beacon payload carries one
fragment; read them in time order:

- `KGSP{` + `b34con_` + `c2_f0und}`

**Flag:** `KGSP{b34con_c2_f0und}`

**Common mistakes:** reading the fragments out of order; chasing the benign
CDN/DNS traffic.

---

## 7 · Deep Breach — two-stage chain (Danger)

**Artifact:** `breach-kit.zip` (download button). Contains `README.txt`,
`stage1.b64`, `payload.enc.hex`.

**Skill:** chaining two tools; no single decoder finishes it.

1. **Stage 1** — Base64-decode `stage1.b64` (CyberChef *From Base64* or
   `base64 -d`) → reveals the **AES-256-CBC key + IV** (both hex).
2. **Stage 2** — AES-256-CBC decrypt `payload.enc.hex`:
   - CyberChef: *From Hex → AES Decrypt* (Key HEX, IV HEX, mode CBC)
   - or `xxd -r -p payload.enc.hex | openssl enc -d -aes-256-cbc -nosalt -K <KEY> -iv <IV>`

Key (hex): `6b6579666f727468656272656163686b6579666f72746865627231323334ffee`
IV (hex): `aabbccddeeff00112233445566778899`

**Flag:** `KGSP{d33p_breach_ch41n}`

**Common mistakes:** using the base64 text as the key directly (decode it first);
UTF-8 instead of HEX for key/IV; forgetting `-nosalt` / that there is no
`Salted__` header.

---

## Interactive challenge routes (for reference)

| Challenge | Route |
|-----------|-------|
| The Chatty Router | `/challenge/router-console` |

Backend: `net_router_query(p_community text)` (SECURITY DEFINER) is the only
place challenge 4's flag is released.

---

## Files served (all under `public/challenges/day4/`)

- `login-capture.pcap` · `traffic-dump.pcap` (real captures)
- `network-diagram.png` (image + carved zip)
- `recon-photo.jpg` (real EXIF GPS)
- `snmp-backup.txt` · `intercepted.txt` (text)
- `breach-kit.zip` (nested archive)

> The generator that produced these is `scripts/gen-day4-artifacts.py`
> (needs `pip install Pillow piexif`). Rerun it to rotate the flags/values, then
> update `challenge_flags` (and `net_router_query`'s expected community) to match.

---

## Opening Day 4 Checklist

- [ ] Open Day 4 in Admin Panel (also required for the live router flag to release)
- [ ] Set Day 4 as the Active Day
- [ ] Add or clear the Day 4 access code
- [ ] Start the timer
- [ ] Open `/board` on the projector

> Last updated: tool-forced, AI-resistant Day 4 (pcap · carving · EXIF+maps ·
> live SNMP console · CyberChef · pcap hunt · AES chain). All flags server-side.
