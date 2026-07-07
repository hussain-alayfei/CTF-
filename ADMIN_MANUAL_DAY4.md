# Day 4 — Securing Networks: Admin Solver Manual

> **Instructor use only.** Contains every flag, solution path, and common
> mistake. Keep it off the projector.

Day 4 uses **mixed challenge styles on purpose** so students actually practice
the skills instead of pasting a prompt into an AI:

- **Interactive pages** (hands-on — must click / inspect / read a live page)
- **Inline analysis** (a networking skill applied to data in the prompt)
- **File forensics** (download a real artifact and investigate it)

---

## Challenge Map

| # | Title | Difficulty | Style | Flag |
|---|-------|-----------|-------|------|
| 1 | Dead Address | Easy | Inline analysis | `KGSP{172.16.42.159}` |
| 2 | Rogue Service | Easy | Interactive page | `KGSP{telnet}` |
| 3 | Rule Blindspot | Medium | Inline analysis | `KGSP{10.10.10.100}` |
| 4 | The Unlocked Portal | Medium | Interactive page (DevTools) | `KGSP{Pr0t0col_S3cur3}` |
| 5 | Buried in DNS | Hard | File forensics | `KGSP{dns_exfil_detected}` |
| 6 | Port 443, Not HTTPS | Hard | Interactive page | `KGSP{ssh}` |
| 7 | The Hidden Network | ☠ Danger | File forensics | `KGSP{network_fortress_breached}` |

---

## 1 · Dead Address — inline

**Skill:** subnetting / broadcast address.

The prompt gives `172.16.42.130/27`.
- `/27` → 5 host bits → block size 32.
- 130 falls in the block starting at 128.
- Broadcast = 128 + 32 − 1 = **159**.

**Flag:** `KGSP{172.16.42.159}`

**Common mistakes:** submitting the gateway (`.129`) or the host (`.130`); using an online subnet calculator is fine and expected.

---

## 2 · Rogue Service — interactive page

**Where:** the “Open challenge” button opens `/challenge/net-monitor`.

**What students do:** a live services table lists ports, transports and
encryption. Exactly one row shows encryption **NONE (cleartext)** — Telnet on
port 23. Clicking that row reveals the flag on the page; wrong rows explain
they are encrypted.

**Flag:** `KGSP{telnet}`

**Common mistakes:** clicking SSH (22) or HTTPS (443) — those are encrypted.

---

## 3 · Rule Blindspot — inline

**Skill:** stateless firewall ACL evaluation (first match wins).

The prompt shows 6 rules. Rule 01 denies SSH to `10.0.0.5`, but Rule 05 is an
unconditional ALLOW for `10.10.10.100`, evaluated before the default deny. That
host bypasses the SSH deny.

**Flag:** `KGSP{10.10.10.100}`

**Common mistakes:** assuming Rule 01 blocks everyone; missing that order matters.

---

## 4 · The Unlocked Portal — interactive page (DevTools)

**Where:** the “Open challenge” button opens `/challenge/vpn-portal`.

**What students do:** the portal is served over “HTTP” and its debug build
leaves a leftover HTML comment in the live DOM. Students open **DevTools (F12) →
Elements** and read the markup near the top of the page:

```
<!-- DEBUG BUILD v2.3.1 | TODO: strip before prod | default admin login  vpn_admin : Pr0t0col_S3cur3 -->
```

Typing the recovered password `Pr0t0col_S3cur3` into the portal reveals the flag.

> Note: “View Page Source” shows the bundled JS, not this comment. It lives in
> the live **DOM**, so students must use DevTools → Elements (the intended skill).

**Flag:** `KGSP{Pr0t0col_S3cur3}`

**Common mistakes:** guessing passwords instead of inspecting; submitting the username.

---

## 5 · Buried in DNS — file forensics

**Artifact:** `/challenges/day4/dns-queries.txt` (download button).

**What students do:** among normal queries, three go to `*.exfil.attacker.tools`.
Take the subdomain fragments in log order and Base64-decode the joined string:

- `S0dTUHtkbn` + `NfZXhmaWxf` + `dGV0ZWN0ZWR9`
- = `S0dTUHtkbnNfZXhmaWxfdGV0ZWN0ZWR9`
- Base64-decode → `KGSP{dns_exfil_detected}`

**Flag:** `KGSP{dns_exfil_detected}`

**Common mistakes:** wrong order; decoding fragments separately; including the domain.

---

## 6 · Port 443, Not HTTPS — interactive page

**Where:** the “Open challenge” button opens `/challenge/packet-inspector`.

**What students do:** a hex/ASCII packet viewer shows a flow to port 443 with no
TLS handshake. The ASCII column reads `SSH-2.0-OpenSSH_9.3`. They type the real
protocol (`ssh`) to reveal the flag.

**Flag:** `KGSP{ssh}`

**Common mistakes:** answering `https` (the port) instead of reading the banner; adding version numbers.

---

## 7 · The Hidden Network — file forensics (Danger)

**Artifact:** `/challenges/day4/edge-router-config.txt` (download button).

**What students do:** the config contains an AES-CBC encrypted syslog payload
plus the key and IV (both hex) in a maintenance comment. Decrypt in CyberChef:
Key type HEX, IV type HEX, Mode CBC, Input HEX.

- Key: `4e6574776f726b4b657932303236ffaa`
- IV: `0102030405060708090a0b0c0d0e0f10`
- Payload: `b5dfb94cff30ad3d99493d89b961ca9312bb3e3798a2ddfd5a957c0672768e46`

**Flag:** `KGSP{network_fortress_breached}`

**Common mistakes:** using UTF-8 instead of HEX for key/IV; wrong mode; using the wrong hex string as input.

---

## Interactive challenge routes (for reference)

| Challenge | Route |
|-----------|-------|
| Rogue Service | `/challenge/net-monitor` |
| The Unlocked Portal | `/challenge/vpn-portal` |
| Port 443, Not HTTPS | `/challenge/packet-inspector` |

All three reveal the flag on the page after the correct interaction; students
then submit it in the normal arena flag box.

---

## Files served (both plain .txt for Windows + Mac safety)

- `/challenges/day4/dns-queries.txt`
- `/challenges/day4/edge-router-config.txt`

> `.csv` and `.log` extensions were avoided because Vercel static hosting can
> mis-handle them; plain `.txt` downloads reliably on every OS/browser.

---

## Opening Day 4 Checklist

- [ ] Open Day 4 in Admin Panel
- [ ] Set Day 4 as the Active Day
- [ ] Add or clear the Day 4 access code
- [ ] Start the 35-minute timer
- [ ] Open `/board` on the projector

> Last updated: mixed-style Day 4 (interactive + inline + file).
