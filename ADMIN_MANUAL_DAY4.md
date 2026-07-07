# Day 4 — Securing Networks: Admin Solver Manual

> **Instructor use only.** This document contains every flag, solution path, and
> common mistake for each Day 4 challenge. Keep it off the projector.

The student-facing challenges are now artifact-first: prompts point to a
downloadable log/config/export file. Students must inspect the file and reason
from the evidence instead of copy/pasting the prompt into AI.

---

## Challenge Map

| # | Title | Difficulty | Artifact | Flag |
|---|-------|------------|----------|------|
| 1 | Dead Address | Easy | `network-map.txt` | `KGSP{172.16.42.159}` |
| 2 | Unmasked Port | Easy | `firewall-export.txt` | `KGSP{telnet}` |
| 3 | Rule Blindspot | Medium | `acl-review.txt` | `KGSP{10.10.10.100}` |
| 4 | Cleartext Confession | Medium | `http-capture.log` | `KGSP{Pr0t0col_S3cur3}` |
| 5 | Buried in DNS | Hard | `dns-queries.log` | `KGSP{dns_exfil_detected}` |
| 6 | Port 443, Not HTTPS | Hard | `tls-anomaly.txt` | `KGSP{ssh}` |
| 7 | The Hidden Network | ☠ Danger | `edge-router-config.txt` | `KGSP{network_fortress_breached}` |

---

## 1 · Dead Address

**Artifact:** `/challenges/day4/network-map.txt`

**What students see:** a network inventory export with several segments. They are asked for the broadcast address of the VPN admin segment.

**How to solve:**
1. Open `network-map.txt`.
2. Find the `vpn-admin` segment: `172.16.42.130/27`.
3. `/27` leaves 5 host bits, so the block size is 32.
4. 130 falls in the block starting at 128.
5. Broadcast = 128 + 32 − 1 = 159.
6. Full broadcast address is `172.16.42.159`.

**Flag:** `KGSP{172.16.42.159}`

**Common mistakes:**
- Submitting the gateway (`172.16.42.129`)
- Submitting the host IP (`172.16.42.130`)
- Forgetting that broadcast is the last address in the subnet

---

## 2 · Unmasked Port

**Artifact:** `/challenges/day4/firewall-export.txt`

**What students see:** a firewall CSV export with hexadecimal port numbers and many normal entries.

**How to solve:**
1. Open `firewall-export.txt`.
2. Look for the suspicious temporary exception. The important row is:
   `legacy-admin,198.51.100.77,TCP,0x0017,ALLOW`.
3. Convert `0x0017` from hex to decimal: `23`.
4. Port 23 is Telnet.
5. Submit lowercase protocol name.

**Flag:** `KGSP{telnet}`

**Common mistakes:**
- Treating `0x0017` as decimal 17
- Answering `KGSP{port23}` instead of the protocol
- Capitalizing Telnet

---

## 3 · Rule Blindspot

**Artifact:** `/challenges/day4/acl-review.txt`

**What students see:** a firewall ACL and test packets. They must find which source can still reach the admin server over SSH.

**How to solve:**
1. Open `acl-review.txt`.
2. Read the rule note: top-down, first match wins.
3. Rule 1 denies SSH to `10.0.0.5`, but Rule 5 allows all traffic from `10.10.10.100`.
4. Test packet B is `10.10.10.100 -> 10.0.0.5:22`.
5. Because Rule 5 is an unconditional allow for that source, this is the blindspot.

**Flag:** `KGSP{10.10.10.100}`

**Common mistakes:**
- Assuming Rule 1 blocks everyone
- Ignoring the rule evaluation order
- Picking a destination IP instead of the source IP

---

## 4 · Cleartext Confession

**Artifact:** `/challenges/day4/http-capture.log`

**What students see:** a packet summary log. The request body is encoded.

**How to solve:**
1. Open `http-capture.log`.
2. Find `HTTP stream #18`.
3. Copy the Base64 body.
4. Base64-decode it.
5. Decoded request:
   ```http
   POST /login HTTP/1.1
   Host: corp-vpn.internal
   Content-Type: application/x-www-form-urlencoded

   username=vpn_admin&password=Pr0t0col_S3cur3
   ```
6. Extract the password value.

**Flag:** `KGSP{Pr0t0col_S3cur3}`

**Common mistakes:**
- Submitting the username
- Copying extra whitespace incorrectly
- Not recognizing the encoded request body

---

## 5 · Buried in DNS

**Artifact:** `/challenges/day4/dns-queries.log`

**What students see:** DNS query logs with many normal entries and three suspicious exfiltration domains.

**How to solve:**
1. Open `dns-queries.log`.
2. Identify only the queries ending with `.exfil.attacker.tools`.
3. Take the subdomain fragments in timestamp order:
   - `S0dTUHtkbn`
   - `NfZXhmaWxf`
   - `dGV0ZWN0ZWR9`
4. Concatenate them:
   `S0dTUHtkbnNfZXhmaWxfdGV0ZWN0ZWR9`
5. Base64-decode the result.

**Flag:** `KGSP{dns_exfil_detected}`

**Common mistakes:**
- Decoding each fragment separately
- Including `.exfil.attacker.tools` in the payload
- Changing the order

---

## 6 · Port 443, Not HTTPS

**Artifact:** `/challenges/day4/tls-anomaly.txt`

**What students see:** a connection on TCP/443 that fails TLS inspection and includes first payload bytes.

**How to solve:**
1. Open `tls-anomaly.txt`.
2. Notice `dst_port: 443`, but `client_hello_seen: false`.
3. Read the first payload bytes:
   - `SSH-2.0-OpenSSH_9.3`
   - `SSH-2.0-OpenSSH_8.9p1 Ubuntu`
4. These strings identify SSH.
5. The trick is that SSH is running on port 443, pretending to be allowed HTTPS traffic.

**Flag:** `KGSP{ssh}`

**Common mistakes:**
- Answering HTTPS because of the port number
- Answering OpenSSH instead of SSH
- Including version numbers

---

## 7 · The Hidden Network

**Artifact:** `/challenges/day4/edge-router-config.txt`

**What students see:** a router backup with a maintenance key, vector, AES mode, and an encrypted log payload.

**How to solve:**
1. Open `edge-router-config.txt`.
2. Extract these values:
   - Key: `4e6574776f726b4b657932303236ffaa`
   - IV/vector: `0102030405060708090a0b0c0d0e0f10`
   - Ciphertext: `b5dfb94cff30ad3d99493d89b961ca9312bb3e3798a2ddfd5a957c0672768e46`
   - Algorithm: `AES-CBC`
   - Input encoding: `hex`
3. In CyberChef, use AES Decrypt:
   - Key type: Hex
   - IV type: Hex
   - Mode: CBC
   - Input: Hex
4. Output decrypts to the flag.

**Flag:** `KGSP{network_fortress_breached}`

**Common mistakes:**
- Using UTF-8 instead of Hex for key/IV
- Forgetting CBC mode
- Using the config filename as input instead of the encrypted payload

---

## Extra Challenges

The old Cookie and Deep Web challenges are still present as optional extras.
They are not part of the core Day 4 sequence above.

---

## Opening Day 4 Checklist

- [ ] Open Day 4 in Admin Panel
- [ ] Set Day 4 as the Active Day
- [ ] Add or clear the Day 4 access code
- [ ] Start the 35-minute timer
- [ ] Open `/board` on the projector

> Last updated: artifact-based Day 4 redesign.
