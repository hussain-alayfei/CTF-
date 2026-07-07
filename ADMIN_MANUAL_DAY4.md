# Day 4 — Securing Networks: Admin Solver Manual

> **Instructor use only.** This document contains every flag, solution path, and
> common mistake for each Day 4 challenge. Keep it off the projector.

---

## Challenge Map

| # | Title | Difficulty | Points | Flag |
|---|-------|-----------|--------|------|
| 1 | Dead Address | Easy | 100 | `KGSP{172.16.42.159}` |
| 2 | Unmasked Port | Easy | 100 | `KGSP{telnet}` |
| 3 | Rule Blindspot | Medium | 200 | `KGSP{10.10.10.100}` |
| 4 | Cleartext Confession | Medium | 200 | `KGSP{Pr0t0col_S3cur3}` |
| 5 | Buried in DNS | Hard | 350 | `KGSP{dns_exfil_detected}` |
| 6 | Port 443, Not HTTPS | Hard | 350 | `KGSP{ssh}` |
| 7 | The Hidden Network | ☠ Danger | 500 | `KGSP{network_fortress_breached}` |
| — | Trust No Cookie *(extra)* | Medium | 300 | `KGSP{c00kies_can_be_edited}` |
| — | The Deep Web *(extra)* | Hard | 500 | `KGSP{you_followed_the_whole_chain}` |

---

## 1 · Dead Address (Easy · 100 pts)

**Topic:** IP Subnetting / Broadcast address

**The artifact given to students:**
```
172.16.42.130/27
```

**Solution walkthrough:**
1. `/27` means 27 bits of network — leaving **5 host bits** → block size = 2^5 = **32**
2. Find which 32-block contains `130`:
   - 0, 32, 64, 96, **128**, 160 …
   - 130 falls in the block that starts at **128**
3. Broadcast = block start + block size − 1 = 128 + 32 − 1 = **159**
4. Full broadcast: `172.16.42.159`

**Flag:** `KGSP{172.16.42.159}`

**Verify with:** Any online subnet calculator — enter `172.16.42.130/27` and read "Broadcast".

**Common student mistakes:**
- Forgetting the −1 (getting 160 instead of 159)
- Confusing /27 with 27 hosts (it means 32 addresses, 30 usable)

---

## 2 · Unmasked Port (Easy · 100 pts)

**Topic:** Network protocols / Well-known ports

**The artifact given to students:**
```
0x0017
```

**Solution walkthrough:**
1. Convert hex to decimal: `0x0017` = **23**
2. Port 23 is **Telnet** — an old remote-access protocol that sends everything in cleartext, including passwords
3. Flag format: lowercase protocol name

**Flag:** `KGSP{telnet}`

**Verify with:** Google "port 23 protocol" or any port reference site.

**Common student mistakes:**
- Confusing hex 17 (23) with decimal 17 (which is qotd/quote of the day)
- Writing `KGSP{Telnet}` with capital T — the flag is lowercase

---

## 3 · Rule Blindspot (Medium · 200 pts)

**Topic:** Stateless firewall / Access Control Lists (ACLs)

**The artifact given to students:**
```
RULE 1  DENY   TCP  ANY           → 10.0.0.5    :22
RULE 2  ALLOW  TCP  192.168.1.0/24 → ANY         :80
RULE 3  ALLOW  TCP  192.168.1.0/24 → ANY         :443
RULE 4  DENY   UDP  ANY           → ANY          :53
RULE 5  ALLOW  ALL  10.10.10.100  → ANY
RULE 6  DENY   ALL  ANY           → ANY
```

**Solution walkthrough:**
1. Rules are evaluated **top-down; first match wins**
2. A packet from `10.10.10.100` hits **Rule 5** (ALLOW ALL) before reaching Rule 6 (DENY ALL)
3. Rule 5 allows ALL traffic from that host — including TCP to port 22 on `10.0.0.5`
4. Rule 1 says DENY from ANY to port 22, but `10.10.10.100` matches Rule 5 *first*, so Rule 1 is never even reached
5. The blindspot: Rule 5 was added for a maintenance IP and never removed

**Flag:** `KGSP{10.10.10.100}`

**Common student mistakes:**
- Thinking Rule 1 (DENY port 22) blocks everyone — it would if Rule 5 weren't above Rule 6
- Confusing stateless ACLs (first-match) with stateful firewalls that track connections

---

## 4 · Cleartext Confession (Medium · 200 pts)

**Topic:** HTTP vs HTTPS / Packet sniffing

**The artifact given to students** (Base64 string):
```
UE9TVCAvbG9naW4gSFRUUC8xLjEKSG9zdDogY29ycC12cG4uaW50ZXJuYWwKQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQKCnVzZXJuYW1lPXZwbl9hZG1pbiZwYXNzd29yZD1QcjB0MGNvbF9TM2N1cjM=
```

**Decoded plaintext:**
```
POST /login HTTP/1.1
Host: corp-vpn.internal
Content-Type: application/x-www-form-urlencoded

username=vpn_admin&password=Pr0t0col_S3cur3
```

**Solution walkthrough:**
1. Recognize the string as Base64 (ends in `=`, alphabet is A-Z/a-z/0-9/+/)
2. Decode with any Base64 decoder (browser console: `atob(...)`, CyberChef, online tools)
3. Read the decoded HTTP body — find the `password=` field
4. The value `Pr0t0col_S3cur3` is the flag content

**Flag:** `KGSP{Pr0t0col_S3cur3}`

**Common student mistakes:**
- Copying the Base64 with the whitespace/newline in the middle — must paste as one continuous string
- Submitting `KGSP{vpn_admin}` (the username) instead of the password

---

## 5 · Buried in DNS (Hard · 350 pts)

**Topic:** DNS exfiltration / data encoding

**The artifact given to students:**
```
S0dTUHtkbn  → .exfil.attacker.tools
NfZXhmaWxf → .exfil.attacker.tools
dGV0ZWN0ZWR9 → .exfil.attacker.tools
```

**Solution walkthrough:**
1. Take only the subdomain portions (before `.exfil.attacker.tools`), in order:
   - `S0dTUHtkbn`
   - `NfZXhmaWxf`
   - `dGV0ZWN0ZWR9`
2. Concatenate them (no spaces): `S0dTUHtkbnNfZXhmaWxfdGV0ZWN0ZWR9`
3. Base64-decode: → `KGSP{dns_exfil_detected}`

**Verify:** CyberChef → "From Base64" → paste the concatenated string.

**Flag:** `KGSP{dns_exfil_detected}`

**Why this technique matters:**
DNS queries normally look harmless. Attackers split stolen data into small Base64 chunks and hide them in subdomain names. Most firewalls allow all DNS traffic (UDP port 53) outbound, making it a popular exfiltration channel.

**Common student mistakes:**
- Adding spaces between fragments
- Decoding each fragment separately instead of concatenating first
- Including the `.exfil.attacker.tools` part in the decode

---

## 6 · Port 443, Not HTTPS (Hard · 350 pts)

**Topic:** Protocol tunneling / firewall evasion / SSH

**The artifact given to students:**
```
Client → Server : SSH-2.0-OpenSSH_9.3
Server → Client : SSH-2.0-OpenSSH_8.9p1 Ubuntu
```

Plus the client config:
```
Host jump
  HostName external.server.io
  Port 443
```

**Solution walkthrough:**
1. The session banners (`SSH-2.0-OpenSSH_*`) are the **SSH protocol identification strings** sent at the very start of every SSH connection
2. These banners prove the traffic is SSH, not HTTPS — even though the TCP port is 443
3. The employee configured their SSH client to connect on port 443 (`Port 443` in config), bypassing the firewall's assumption that 443 = HTTPS
4. The flag is the name of the actual protocol: `ssh`

**Flag:** `KGSP{ssh}`

**Common student mistakes:**
- Answering `KGSP{https}` — that's what the port number *implies*, not what the traffic actually is
- Including version numbers (`KGSP{ssh2}`)

---

## 7 · The Hidden Network (☠ Danger · 500 pts)

**Topic:** AES decryption / network forensics / config analysis

**The artifact given to students:**

Config comment:
```
# Maintenance key (temp — remove after audit):
# 4e6574776f726b4b657932303236ffaa
# Inspection bypass vector:
# 0102030405060708090a0b0c0d0e0f10
```

Encrypted log entry:
```
b5dfb94cff30ad3d99493d89b961ca9312bb3e3798a2ddfd5a957c0672768e46
```

**Solution walkthrough:**
1. Identify the three components:
   - **Ciphertext (hex):** `b5dfb94cff30ad3d99493d89b961ca9312bb3e3798a2ddfd5a957c0672768e46`
   - **Key (hex):** `4e6574776f726b4b657932303236ffaa`
   - **IV (hex):** `0102030405060708090a0b0c0d0e0f10`
2. Open **CyberChef** (gchq.github.io/CyberChef)
3. Add recipe: **AES Decrypt**
   - Key: `4e6574776f726b4b657932303236ffaa` — type: **HEX**
   - IV: `0102030405060708090a0b0c0d0e0f10` — type: **HEX**
   - Mode: **CBC**
   - Input: **Hex**
4. Paste the ciphertext in the Input box → Output shows the flag

**Flag:** `KGSP{network_fortress_breached}`

**Connection to Day 3:**
Students who did Day 3 (lab_encrypt) know exactly how to do this — it's the same tool and mode. The twist is finding the key *inside* the firewall config comment, not being handed it directly.

**Common student mistakes:**
- Setting Key or IV type to UTF8 instead of HEX — gives wrong output
- Not setting Mode to CBC (default may be ECB)
- Forgetting to set Input to Hex (pasting ciphertext as text doesn't work)

---

## Extra Challenges (Bonus — Optional)

These were the original Day 4 web challenges from Day 3 week. They are marked "Extra" and do not count toward the live Day 4 competition, but students can still solve them for practice.

### Trust No Cookie (Medium · 300 pts)
Flag: `KGSP{c00kies_can_be_edited}`
Go to `/challenge/admin-panel` → Open F12 → Application → Cookies → change `role` to `admin` → refresh.

### The Deep Web (Hard · 500 pts)
Flag: `KGSP{you_followed_the_whole_chain}`
1. Visit `/robots.txt` → find Base64 string → decode to get a hidden path
2. Visit that path → find an image
3. Open the image in Notepad (or `strings`) → flag is at the end of the file

---

## Questions Students May Ask

| Question | Answer |
|----------|--------|
| "I can't convert hex to decimal" | Calculator app: type `0x0017` or search "hex to decimal converter" |
| "My Base64 decode gives garbage" | Make sure you copied the string as one line with no spaces or line breaks |
| "I got the firewall answer wrong" | Re-read which rule number matches first — remember top-down, first match wins |
| "CyberChef shows nothing for challenge 7" | Check that Key type and IV type are both set to HEX, not UTF8 |
| "What is 'stateless' firewall?" | It doesn't track connection state — every packet is evaluated on its own rules, in order |
| "What is DNS exfiltration?" | Hiding stolen data inside DNS query names. Firewalls allow DNS traffic (port 53) so it often goes undetected |
| "How does SSH bypass the firewall?" | SSH is an application-layer protocol. The firewall only sees the TCP port (443), not what's inside. Firewalls without deep packet inspection can't tell SSH from HTTPS |

---

## Opening Day 4 Checklist

- [ ] Open Day 4 in Admin Panel (Unlock)
- [ ] Set Day 4 as the Active Day (leaderboard switches to Day 4)
- [ ] Set the access code if required (or leave open)
- [ ] Start the 35-minute timer
- [ ] Verify the `/board` projector screen shows Day 4

> Last updated: Day 4 — Securing Networks
