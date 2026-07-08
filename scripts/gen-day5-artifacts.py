#!/usr/bin/env python3
"""Generate all Day 5 (Privacy) challenge artifacts — pure stdlib, no deps.

Design rules (same as Day 4): the plaintext answer NEVER appears in any
artifact, nothing is flag-shaped (KGSP{...}), and the two hardest challenges
need a key that is delivered live (challenge_live_material), not in the file —
so uploading just the download to a chatbot yields nothing submittable.

Run:  python scripts/gen-day5-artifacts.py
Outputs to public/challenges/day5/. Prints the live-material keys to copy into
challenge_answer_keys, and self-checks every artifact for plaintext leaks.
"""
import base64, csv, io, os, random, struct, socket, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "challenges", "day5"))
os.makedirs(OUT, exist_ok=True)

# ---- Answers (must match the challenge_answer_keys migration) ----
A_METADATA = "eiffel_tower_magpie"
A_TOR_EXIT = "exit_nodes_see_http"
A_ZEROWIDTH = "1nv1s1bl3_1nk"
A_ONION = "thr33_h0ps"
A_DEANON = "anon_is_not_private"

# ---- Live-delivered keys (go into challenge_answer_keys.live_material) ----
ONION_KEY_HEX = "a1b2c3d4"
DEANON_KEY_HEX = "7e11"

_leaks = []  # (filename, needle) that must NOT appear in the artifact bytes


def _xor(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


# ============================================================
# 1) Metadata Betrayal  (medium) — press-release.pdf
#    exiftool reveals Author (codename) + GPS in Subject.
# ============================================================
def gen_metadata_pdf():
    author = "magpie"                 # -> second half of the answer
    gps = "48.8584, 2.2945"           # -> Eiffel Tower -> eiffel_tower

    lines = [
        "PRESS RELEASE - FOR IMMEDIATE RELEASE",
        "",
        "Our foundation will unveil its new public monument-side venue",
        "at a launch event next month. Details to follow.",
        "",
        "Media contact: press office.",
        "",
        "(Note: everything an editor forgot to strip lives in this file's",
        "properties -- author and location included.)",
    ]
    # Page content stream (simple Helvetica text).
    content = "BT /F1 12 Tf 72 720 Td 16 TL\n"
    for ln in lines:
        safe = ln.replace("(", "\\(").replace(")", "\\)")
        content += f"({safe}) Tj T*\n"
    content += "ET"
    content_b = content.encode("latin-1")

    info = (
        f"<< /Author ({author}) /Title (New Venue Launch) "
        f"/Subject (Location {gps}) /Keywords (privacy, metadata, launch) "
        f"/Creator (CommsOffice) /Producer (CommsOffice) >>"
    ).encode("latin-1")

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content_b)).encode() + b" >>\nstream\n" + content_b + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        info,
    ]

    pdf = io.BytesIO()
    pdf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(pdf.tell())
        pdf.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref_pos = pdf.tell()
    n = len(objs) + 1
    pdf.write(f"xref\n0 {n}\n".encode())
    pdf.write(b"0000000000 65535 f \n")
    for off in offsets:
        pdf.write(f"{off:010d} 00000 n \n".encode())
    pdf.write(b"trailer\n")
    pdf.write(f"<< /Size {n} /Root 1 0 R /Info 6 0 R >>\n".encode())
    pdf.write(b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF\n")

    path = os.path.join(OUT, "press-release.pdf")
    with open(path, "wb") as f:
        f.write(pdf.getvalue())
    _leaks.append(("press-release.pdf", A_METADATA))
    print("press-release.pdf", os.path.getsize(path), "bytes  (Author:", author, "| GPS:", gps, ")")


# ============================================================
# PCAP primitives (classic little-endian .pcap, Ethernet)
# ============================================================
def _ip_checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    s = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    s = (s >> 16) + (s & 0xFFFF)
    s += s >> 16
    return (~s) & 0xFFFF


def _eth(dst=b"\x02\x00\x00\x00\x00\x02", src=b"\x02\x00\x00\x00\x00\x01"):
    return dst + src + b"\x08\x00"


def _ipv4(src, dst, proto, payload, ident=0):
    total = 20 + len(payload)
    hdr = struct.pack("!BBHHHBBH4s4s", 0x45, 0, total, ident, 0x4000, 64, proto, 0,
                      socket.inet_aton(src), socket.inet_aton(dst))
    chk = _ip_checksum(hdr)
    hdr = struct.pack("!BBHHHBBH4s4s", 0x45, 0, total, ident, 0x4000, 64, proto, chk,
                      socket.inet_aton(src), socket.inet_aton(dst))
    return hdr + payload


def _tcp(sport, dport, seq, ack, flags, payload=b"", window=64240):
    hdr = struct.pack("!HHIIBBHHH", sport, dport, seq, ack, (5 << 4), flags, window, 0, 0)
    return hdr + payload


FIN, SYN, RST, PSH, ACK = 0x01, 0x02, 0x04, 0x08, 0x10


class Pcap:
    def __init__(self):
        self.records = []
        self.t = 1751878800.0

    def add(self, frame, dt=0.0012):
        self.t += dt
        sec = int(self.t); usec = int((self.t - sec) * 1_000_000)
        self.records.append(struct.pack("<IIII", sec, usec, len(frame), len(frame)) + frame)

    def write(self, path):
        gh = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
        with open(path, "wb") as f:
            f.write(gh)
            for r in self.records:
                f.write(r)


class TcpConn:
    def __init__(self, pcap, cip, sip, cport, sport):
        self.p = pcap; self.cip = cip; self.sip = sip
        self.cport = cport; self.sport = sport
        self.cseq = 1000; self.sseq = 5000
        self._c(SYN); self.cseq += 1
        self._s(SYN | ACK); self.sseq += 1
        self._c(ACK)

    def _c(self, flags, data=b"", dt=0.02):
        frame = _eth() + _ipv4(self.cip, self.sip, 6,
                               _tcp(self.cport, self.sport, self.cseq, self.sseq, flags, data))
        self.p.add(frame, dt)

    def _s(self, flags, data=b"", dt=0.03):
        frame = _eth(dst=b"\x02\x00\x00\x00\x00\x01", src=b"\x02\x00\x00\x00\x00\x02") + \
            _ipv4(self.sip, self.cip, 6,
                  _tcp(self.sport, self.cport, self.sseq, self.cseq, flags, data))
        self.p.add(frame, dt)

    def client_says(self, data: bytes):
        self._c(PSH | ACK, data); self.cseq += len(data)

    def server_says(self, data: bytes):
        self._s(PSH | ACK, data); self.sseq += len(data)

    def close(self):
        self._c(FIN | ACK); self.cseq += 1
        self._s(FIN | ACK); self.sseq += 1
        self._c(ACK)


# ============================================================
# 2) Exit Node Eyes (medium, Tor #1) — tor-exit.pcap
#    Several opaque HTTPS (TLS) sessions + ONE cleartext HTTP session
#    that leaks HTTP Basic auth (base64). Decode -> password = answer.
# ============================================================
def gen_tor_exit_pcap():
    p = Pcap()
    EXIT = "10.9.0.7"  # the machine running the exit relay (capture point)
    rng = random.Random(1337)

    # Opaque HTTPS conversations (TLS records: 0x16 handshake / 0x17 appdata).
    https_hosts = ["185.70.41.130", "104.18.2.161", "151.101.65.140"]
    for i, h in enumerate(https_hosts):
        c = TcpConn(p, EXIT, h, 44300 + i, 443)
        # ClientHello-ish + encrypted application data (unreadable).
        c.client_says(b"\x16\x03\x01" + struct.pack("!H", 512) + bytes(rng.randrange(256) for _ in range(512)))
        c.server_says(b"\x16\x03\x03" + struct.pack("!H", 80) + bytes(rng.randrange(256) for _ in range(80)))
        c.client_says(b"\x17\x03\x03" + struct.pack("!H", 300) + bytes(rng.randrange(256) for _ in range(300)))
        c.close()

    # The slip: a user believes Tor protects them, but logs into a plain-HTTP
    # webmail. The exit relay sees the HTTP Basic auth header in the clear.
    cred = base64.b64encode(("courier:" + A_TOR_EXIT).encode()).decode()
    h = TcpConn(p, EXIT, "203.0.113.24", 44400, 80)
    h.client_says(
        b"GET /webmail/inbox HTTP/1.1\r\n"
        b"Host: mail.riverside-coop.example\r\n"
        b"Authorization: Basic " + cred.encode() + b"\r\n"
        b"User-Agent: Mozilla/5.0\r\n"
        b"Accept: text/html\r\n\r\n"
    )
    h.server_says(
        b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n"
        b"Content-Length: 34\r\n\r\n<h1>Inbox (3 unread)</h1>"
    )
    h.close()

    path = os.path.join(OUT, "tor-exit.pcap")
    p.write(path)
    _leaks.append(("tor-exit.pcap", A_TOR_EXIT))  # only the base64 should be present
    print("tor-exit.pcap", os.path.getsize(path), "bytes  (HTTP Basic b64:", cred, ")")


# ============================================================
# 3) Zero-Width Whisper (hard) — memo.txt
#    Answer hidden as zero-width chars (ZWSP=0, ZWNJ=1), 8 bits/char.
# ============================================================
def gen_zerowidth_memo():
    ZERO, ONE = "\u200b", "\u200c"
    bits = "".join(format(b, "08b") for b in A_ZEROWIDTH.encode("ascii"))
    hidden = "".join(ZERO if c == "0" else ONE for c in bits)

    visible = (
        "INTERNAL MEMO - Document Handling\n"
        "==================================\n\n"
        "Team,\n\n"
        "A reminder from Compliance: before you forward any file outside the\n"
        "organisation, review it. Text that looks perfectly clean" + hidden + " can still\n"
        "carry passengers you cannot see with your eyes. Copy-pasting often\n"
        "strips them; opening the raw bytes does not.\n\n"
        "Stay sharp,\n"
        "- Compliance Office\n"
    )
    path = os.path.join(OUT, "memo.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(visible)
    _leaks.append(("memo.txt", A_ZEROWIDTH))
    print("memo.txt", os.path.getsize(path), "bytes  (", len(bits), "hidden bits )")


# ============================================================
# 4) Peeling the Onion Router (hard, Tor #2) — onion.txt
#    outer = Base64( Base32( XOR(answer, key) ) ). Key delivered live.
# ============================================================
def gen_onion():
    key = bytes.fromhex(ONION_KEY_HEX)
    inner = _xor(A_ONION.encode(), key)
    mid = base64.b32encode(inner)            # bytes of base32 text
    outer = base64.b64encode(mid).decode()   # base64 of that
    body = (
        "RELAY CELL // captured mid-circuit\n"
        "----------------------------------\n"
        "This cell was wrapped for transport and is unreadable on its own.\n"
        "Your session key is issued on the challenge page, not in this file.\n\n"
        + outer + "\n"
    )
    path = os.path.join(OUT, "onion.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)
    _leaks.append(("onion.txt", A_ONION))
    print("onion.txt", os.path.getsize(path), "bytes  (key_hex:", ONION_KEY_HEX, ")")


# ============================================================
# 5) The De-Anonymizer (danger) — deanon.zip
#    Re-identify a named target by linking a "pseudonymized" export to a
#    public voter roll on (zip, birthdate, gender); their note is XOR-hex,
#    decoded with the live key.
# ============================================================
def gen_deanon():
    rng = random.Random(2026)
    first = ["Sara", "Omar", "Lina", "Yusuf", "Maya", "Adam", "Noor", "Zaid", "Hana", "Tariq",
             "Rania", "Sami", "Dana", "Faris", "Layla", "Nabil", "Rima", "Karim", "Huda", "Basel"]
    last = ["Khan", "Aziz", "Nasser", "Farah", "Saleh", "Habib", "Younis", "Darwish", "Mansour", "Rashid"]
    genders = ["F", "M"]

    def rand_dob():
        y = rng.randint(1985, 2003); m = rng.randint(1, 12); d = rng.randint(1, 28)
        return f"{y:04d}-{m:02d}-{d:02d}"

    # Build a pool of people. Deliberately create collisions on (zip,dob,gender)
    # for most, so only a few are uniquely identifiable (k-anonymity failure).
    zips = ["31421", "31422", "31423", "31424"]  # few zips -> collisions
    people = []
    seen = {}
    for i in range(44):
        nm = f"{rng.choice(first)} {rng.choice(last)}"
        z = rng.choice(zips); dob = rand_dob(); g = rng.choice(genders)
        people.append({"name": nm, "zipcode": z, "birthdate": dob, "gender": g})

    # The TARGET: force a globally UNIQUE (zip, dob, gender) triple.
    target = {"name": "Rania Alharbi", "zipcode": "31999", "birthdate": "1998-03-14", "gender": "F"}
    people.append(target)

    # Ensure uniqueness of the target triple (no other row shares it).
    for p in people:
        if p is target:
            continue
        if (p["zipcode"], p["birthdate"], p["gender"]) == ("31999", "1998-03-14", "F"):
            p["zipcode"] = "31421"

    rng.shuffle(people)

    # Public voter roll.
    voter_rows = [["name", "zipcode", "birthdate", "gender"]]
    for p in people:
        voter_rows.append([p["name"], p["zipcode"], p["birthdate"], p["gender"]])

    # Pseudonymized export: name replaced by an opaque id; carries a private_note.
    key = bytes.fromhex(DEANON_KEY_HEX)
    target_note = _xor(A_DEANON.encode(), key).hex()

    def fake_note():
        return _xor(("u" + str(rng.randint(1000, 9999)) + "_record").encode(), key).hex()

    anon_rows = [["pseudo_id", "zipcode", "birthdate", "gender", "private_note"]]
    for idx, p in enumerate(people):
        pid = "u" + format(abs(hash((p["name"], idx))) % (10 ** 10), "010d")
        note = target_note if p is target else fake_note()
        anon_rows.append([pid, p["zipcode"], p["birthdate"], p["gender"], note])

    def csv_bytes(rows):
        buf = io.StringIO()
        csv.writer(buf).writerows(rows)
        return buf.getvalue().encode("utf-8")

    readme = (
        "DATA RELEASE - anonymized_users.csv + voter_roll.csv\n"
        "====================================================\n"
        "anonymized_users.csv has had names removed and replaced with an opaque\n"
        "pseudo_id. It was released as 'anonymous'. voter_roll.csv is public.\n\n"
        "Investigate: re-identify RANIA ALHARBI in the anonymized export and\n"
        "recover the private_note attached to her record. The note is obscured;\n"
        "your session page issues the key that reveals it.\n"
    )

    path = os.path.join(OUT, "deanon.zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", readme)
        z.writestr("voter_roll.csv", csv_bytes(voter_rows))
        z.writestr("anonymized_users.csv", csv_bytes(anon_rows))
    _leaks.append(("deanon.zip", A_DEANON))
    print("deanon.zip", os.path.getsize(path), "bytes  (target note hex:", target_note,
          "| key_hex:", DEANON_KEY_HEX, ")")


def self_check():
    print("\n--- leak self-check (plaintext answers must be absent) ---")
    ok = True
    for fname, needle in _leaks:
        data = open(os.path.join(OUT, fname), "rb").read()
        bad = needle.encode() in data or b"KGSP{" in data
        print(f"  {fname:22s} clean={not bad}")
        ok = ok and not bad
    if not ok:
        raise SystemExit("LEAK DETECTED — an answer or KGSP{ is present in an artifact.")
    print("all artifacts clean.\n")


if __name__ == "__main__":
    gen_metadata_pdf()
    gen_tor_exit_pcap()
    gen_zerowidth_memo()
    gen_onion()
    gen_deanon()
    self_check()
    print("Live material for challenge_answer_keys:")
    print("  p_onion  live_material = {\"key_hex\": \"%s\"}" % ONION_KEY_HEX)
    print("  p_deanon live_material = {\"key_hex\": \"%s\"}" % DEANON_KEY_HEX)
    print("DONE ->", OUT)
