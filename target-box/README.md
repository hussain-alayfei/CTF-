# Day 4 target box — instructor setup

Three of the Day 4 **extra** challenges (Rogue Port, Tapped Wire, Rogue
Resolver) are solved by running real tools — **nmap, Wireshark, dig** — against
a live host you control. That host is this little server. Because the answers
live on a box only reachable on your network, **a student can't paste anything
into an AI and get the flag** — they have to run the tool.

## Run it

On any laptop/VM on the **same Wi-Fi/LAN as the students**:

```bash
python3 server.py        # no dependencies, no admin/root needed
```

(or containerised — see the `Dockerfile` header.)

Then find the machine's IP and give it to the students:

- Linux/Mac: `ip addr` or `ifconfig` → the `192.168.x.x` / `10.x.x.x` address
- Windows: `ipconfig` → "IPv4 Address"

> **Firewall:** allow inbound TCP 8021 & 8080 and UDP 5353, or students won't
> reach the box. On Windows the first run pops a Firewall prompt — click
> "Allow", and make sure "Private networks" is ticked. Test from another
> machine with `nmap <ip>` before the round starts.

## What each service is for

| Challenge | Service | Port | Student solves it with | Answer they recover |
|-----------|---------|------|------------------------|---------------------|
| Rogue Port | TCP banner | 8021 | `nmap -p- <ip>` to find it, then `nc <ip> 8021` | `r0gue_p0rt_f0und` |
| Tapped Wire | plain HTTP | 8080 | Wireshark capture of `http://<ip>:8080/` | `cl34rtext_sn1ff3d` |
| Rogue Resolver | DNS TXT | udp/8053 | `dig -p 8053 @<ip> flag.kgsp.ctf TXT` | `dns_txt_l00kup` |

Students submit the recovered code on the challenge's page in the arena, which
mints their **personal** flag (`verify_challenge_answer`), so codes can't be
shared as finished flags.

## Rotating the answers

Every token is an env var. To change one:

```bash
KGSP_ROGUE_CODE=some_new_code python3 server.py
```

If you rotate a token, update the matching row in
`public.challenge_answer_keys` (challenge ids `net_extra_nmap`,
`net_extra_sniff`, `net_extra_dns`) so the grader agrees. See
`ADMIN_MANUAL_DAY4.md`.

## Note on "AI-proof"

An AI can *coach* a student through nmap/Wireshark/dig — that's fine, it's a
tutor. What it can't do is produce the answer without the student actually
running the tool against your box, because the box isn't on the public
internet and its tokens exist nowhere else. That's the whole point of these
three.
