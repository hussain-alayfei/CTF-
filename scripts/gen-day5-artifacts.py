#!/usr/bin/env python3
"""Generate Day 5 (Privacy) v2 artifacts — anti-AI, multi-format forensics.

No answer strings ship in plaintext. Live decode keys stay server-side only.
Regenerate: python scripts/gen-day5-artifacts.py
"""
from __future__ import annotations

import base64
import gzip
import io
import os
import sqlite3
import struct
import socket
import textwrap
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "challenges" / "day5"
OUT.mkdir(parents=True, exist_ok=True)

# --- PCAP helpers (same family as Day 4 generator) ---------------------------------

def ip_checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    s = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    s = (s >> 16) + (s & 0xFFFF)
    s += s >> 16
    return (~s) & 0xFFFF


def eth(dst=b"\x02\x00\x00\x00\x00\x02", src=b"\x02\x00\x00\x00\x00\x01"):
    return dst + src + b"\x08\x00"


def ipv4(src, dst, proto, payload, ident=0):
    ver_ihl = 0x45
    total = 20 + len(payload)
    hdr = struct.pack(
        "!BBHHHBBH4s4s",
        ver_ihl, 0, total, ident, 0x4000, 64, proto, 0,
        socket.inet_aton(src), socket.inet_aton(dst),
    )
    chk = ip_checksum(hdr)
    hdr = struct.pack(
        "!BBHHHBBH4s4s",
        ver_ihl, 0, total, ident, 0x4000, 64, proto, chk,
        socket.inet_aton(src), socket.inet_aton(dst),
    )
    return hdr + payload


def udp(sport, dport, payload):
    length = 8 + len(payload)
    return struct.pack("!HHHH", sport, dport, length, 0) + payload


def tcp(sport, dport, seq, ack, flags, payload=b"", window=64240):
    off = (5 << 4)
    hdr = struct.pack("!HHIIBBHHH", sport, dport, seq, ack, off, flags, window, 0, 0)
    return hdr + payload


FIN, SYN, RST, PSH, ACK = 0x01, 0x02, 0x04, 0x08, 0x10


class Pcap:
    def __init__(self):
        self.records = []
        self.t = 1752019200.0

    def add(self, frame, dt=0.0011):
        self.t += dt
        sec = int(self.t)
        usec = int((self.t - sec) * 1_000_000)
        self.records.append(struct.pack("<IIII", sec, usec, len(frame), len(frame)) + frame)

    def write(self, path: Path):
        gh = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
        with open(path, "wb") as f:
            f.write(gh)
            for r in self.records:
                f.write(r)


def dns_query(qname: str, txid: bytes = b"\x12\x34") -> bytes:
    parts = qname.strip(".").split(".")
    body = b""
    for p in parts:
        body += bytes([len(p)]) + p.encode()
    body += b"\x00\x00\x01\x00\x01"
    return txid + b"\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00" + body


# --- Artifacts ---------------------------------------------------------------------

def bookmark_vault_sqlite():
    """Real Firefox-style places DB — query bookmarks, recover URL slug."""
    path = OUT / "places.sqlite"
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.executescript(
        """
        CREATE TABLE moz_bookmarks (
          id INTEGER PRIMARY KEY,
          type INTEGER,
          fk INTEGER,
          parent INTEGER,
          position INTEGER,
          title TEXT,
          dateAdded INTEGER,
          lastModified INTEGER
        );
        CREATE TABLE moz_places (
          id INTEGER PRIMARY KEY,
          url TEXT,
          title TEXT,
          rev_host TEXT,
          visit_count INTEGER DEFAULT 0
        );
        """
    )
    rows = [
        (1, "https://corp.intranet/wiki/privacy-policy", "Privacy Policy"),
        (2, "https://corp.intranet/tools/dns-check", "DNS Check"),
        (3, "https://archive.internal.corp/vault/route_17/snapshot", "Operations Vault"),
        (4, "https://news.example.com/feed", "News"),
    ]
    for i, url, title in rows:
        cur.execute("INSERT INTO moz_places (id,url,title,rev_host,visit_count) VALUES (?,?,?,?,?)",
                    (i, url, title, "moc.elpmaxe", 1))
        cur.execute(
            "INSERT INTO moz_bookmarks (id,type,fk,parent,position,title,dateAdded,lastModified) VALUES (?,?,?,?,?,?,?,?)",
            (i, 1, i, 1, i, title, 1752010000000 + i, 1752010000000 + i),
        )
    con.commit()
    con.close()
    print("places.sqlite", path.stat().st_size, "bytes")


def profile_archive_zip():
    """Browser triage zip — correlate cookies, downloads, history."""
    buf = io.BytesIO()
    cookies = textwrap.dedent(
        """\
        # Netscape HTTP Cookie File — triage export 2026-07-08
        .midnight-export.internal\tTRUE\t/\tFALSE\t1783555200\tsession\t8f2caa11
        .corp.intranet\tTRUE\t/\tFALSE\t1783555200\tlang\ten
        .cdn.example.net\tTRUE\t/\tFALSE\t1783555200\tuid\tdecoy-4412
        """
    )
    downloads = textwrap.dedent(
        """\
        {
          "version": 1,
          "entries": [
            {"target": "https://midnight-export.internal/archives/", "file": "readme.txt", "state": "complete"},
            {"target": "https://midnight-export.internal/archives/midnight_export_pack.zip", "file": "midnight_export_pack.zip", "state": "complete"},
            {"target": "https://cdn.example.net/assets/logo.svg", "file": "logo.svg", "state": "complete"}
          ]
        }
        """
    )
    history = textwrap.dedent(
        """\
        # visit_time (chrome epoch µs) | url | title
        13397830400000000 | https://corp.intranet/ | Corp Home
        13397830450000000 | https://midnight-export.internal/archives/ | Archive Portal
        13397830500000000 | https://midnight-export.internal/archives/midnight_export_pack.zip | Pack Download
        """
    )
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("triage/README.txt", "Workstation triage — correlate session, downloads, and visits.\n")
        z.writestr("triage/cookies.txt", cookies)
        z.writestr("triage/downloads.json", downloads)
        z.writestr("triage/history.tsv", history)
    (OUT / "browser-profile.zip").write_bytes(buf.getvalue())
    print("browser-profile.zip", (OUT / "browser-profile.zip").stat().st_size, "bytes")


def dns_whisper_pcap():
    """DNS leak capture — find the sensitive domain queried off-VPN."""
    p = Pcap()
    host = "10.55.0.44"
    resolver = "10.55.0.53"
    noise = [
        "www.example.com", "fonts.googleapis.com", "cdn.jsdelivr.net",
        "api.github.com", "status.cloudflare.com", "metrics.google.com",
    ]
    private = [
        "internal.clinic.net", "internal.clinic.net", "patient.internal.clinic.net",
        "internal.clinic.net", "records.internal.clinic.net", "internal.clinic.net",
    ]
    for d in noise * 3:
        frame = eth() + ipv4(host, resolver, 17, udp(52000 + (hash(d) % 1000), 53, dns_query(d)))
        p.add(frame, 0.08)
    for d in private:
        frame = eth() + ipv4(host, resolver, 17, udp(53001, 53, dns_query(d)))
        p.add(frame, 0.15)
    p.write(OUT / "dns-whisper.pcap")
    print("dns-whisper.pcap", (OUT / "dns-whisper.pcap").stat().st_size, "bytes")


def tracker_ghost_har():
    """HAR export — isolate third-party shards in header order."""
    import json

    entries = []
    t0 = 1752019200000

    def entry(url, host, shard_hdr, shard_val, offset_ms):
        return {
            "startedDateTime": f"2026-07-08T12:00:{offset_ms // 1000:02d}.000Z",
            "time": 40,
            "request": {"method": "GET", "url": url, "headers": [{"name": "Host", "value": host}]},
            "response": {
                "status": 204,
                "headers": [{"name": "X-Trace-Shard", "value": shard_val}],
            },
        }

    # First-party noise
    entries.append(entry("https://shop.example/", "shop.example", "", "", 0))
    entries.append(entry("https://shop.example/cart", "shop.example", "", "", 200))
    # Third-party trackers — shards: hex, plain, b64 fragments -> shadow_pixel
    entries.append(entry("https://pixel.shadow.net/collect", "pixel.shadow.net", "X-Trace-Shard", "73686164", 400))
    entries.append(entry("https://tag.metrics-aa.net/p", "tag.metrics-aa.net", "X-Trace-Shard", "ow", 800))
    entries.append(entry("https://sync.broker-cc.io/id", "sync.broker-cc.io", "X-Trace-Shard", "cGl4ZWw=", 1200))
    entries.append(entry("https://shop.example/checkout", "shop.example", "", "", 1600))

    har = {"log": {"version": "1.2", "creator": {"name": "SOC export", "version": "1.0"}, "entries": entries}}
    (OUT / "tracker-ghost.har").write_text(json.dumps(har, indent=2), encoding="utf-8")
    print("tracker-ghost.har", (OUT / "tracker-ghost.har").stat().st_size, "bytes")


def briefing_carve_png():
    """Valid PNG with ZIP carved after IEND; inner note XOR'd (key lives server-side)."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("SKIP briefing-snapshot.png (Pillow not installed)")
        return

    answer = b"leaked_briefing_pack"
    key = 0x3A
    xored = bytes(b ^ key for b in answer)

    img = Image.new("RGB", (720, 400), (18, 22, 28))
    d = ImageDraw.Draw(img)
    d.rectangle([24, 24, 696, 376], outline=(46, 204, 113))
    d.text((48, 48), "SANITIZED BRIEFING EXPORT", fill=(236, 240, 241))
    d.text((48, 360), "visual layer only — analysts reported trailing payload", fill=(127, 140, 141))
    png_buf = io.BytesIO()
    img.save(png_buf, format="PNG")
    png_bytes = png_buf.getvalue()

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "inner/note.bin",
            xored,
        )
        z.writestr(
            "inner/readme.txt",
            "Recovered from slack space. Payload is single-byte masked — session key is on the challenge page.\n",
        )
    with open(OUT / "briefing-snapshot.png", "wb") as f:
        f.write(png_bytes)
        f.write(zip_buf.getvalue())
    print("briefing-snapshot.png", (OUT / "briefing-snapshot.png").stat().st_size, "bytes")


def mask_capture_json():
    """Surveillance export — match live session profile, decode that row's token."""
    import json

    def enc(s: str) -> str:
        raw = s.encode()
        x = bytes(b ^ 0x5A for b in raw)
        return base64.b64encode(gzip.compress(x)).decode()

    rows = [
        {"profile_id": "a1", "timezone": "Europe/London", "language": "en-GB", "screen": "1920x1080", "token": enc("decoy_alpha")},
        {"profile_id": "7f2a", "timezone": "Asia/Riyadh", "language": "ar-SA", "screen": "1366x768", "token": enc("profile_aligned")},
        {"profile_id": "c9", "timezone": "America/New_York", "language": "en-US", "screen": "1440x900", "token": enc("decoy_bravo")},
    ]
    doc = {
        "export": "browser_mask_capture_2026-07-08",
        "note": "Each row is a observed workstation profile. One row matches the live session brief on the challenge page.",
        "profiles": rows,
    }
    (OUT / "mask-capture.json").write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print("mask-capture.json", (OUT / "mask-capture.json").stat().st_size, "bytes")


class TcpConn:
    def __init__(self, pcap, cip, sip, cport, sport):
        self.p = pcap
        self.cip, self.sip = cip, sip
        self.cport, self.sport = cport, sport
        self.cseq, self.sseq = 1000, 5000
        self._c(SYN)
        self.cseq += 1
        self._s(SYN | ACK)
        self.sseq += 1
        self._c(ACK)

    def _c(self, flags, data=b"", dt=0.02):
        frame = eth() + ipv4(self.cip, self.sip, 6, tcp(self.cport, self.sport, self.cseq, self.sseq, flags, data))
        self.p.add(frame, dt)

    def _s(self, flags, data=b"", dt=0.03):
        frame = (
            eth(dst=b"\x02\x00\x00\x00\x00\x01", src=b"\x02\x00\x00\x00\x00\x02")
            + ipv4(self.sip, self.cip, 6, tcp(self.sport, self.cport, self.sseq, self.cseq, flags, data))
        )
        self.p.add(frame, dt)

    def client_says(self, data: bytes):
        self._c(PSH | ACK, data)
        self.cseq += len(data)

    def server_says(self, data: bytes):
        self._s(PSH | ACK, data)
        self.sseq += len(data)

    def close(self):
        self._c(FIN | ACK)
        self.cseq += 1
        self._s(FIN | ACK)
        self.sseq += 1
        self._c(ACK)


def exit_witness_pcap():
    """Tor-noise pcap with one cleartext proxy leak (body XOR'd, key on verify page)."""
    p = Pcap()
    client = "10.88.0.12"
    tor_nodes = ["185.220.101.44", "185.220.101.45", "185.220.101.46"]
    for i, node in enumerate(tor_nodes * 4):
        c = TcpConn(p, client, node, 44000 + i, 9001)
        c.client_says(b"\x16\x03\x01\x00\xa0")  # TLS-looking noise
        c.server_says(b"\x16\x03\x03\x00\x4a")
        c.close()

    answer = b"witness_confirmed"
    body_hex = bytes(b ^ 0x21 for b in answer).hex()
    proxy = "10.88.0.50"
    leak = TcpConn(p, client, proxy, 45100, 8080)
    leak.client_says(
        b"POST /relay/report HTTP/1.1\r\nHost: proxy.internal\r\n"
        b"Content-Type: application/octet-stream\r\n"
        b"Content-Length: " + str(len(body_hex)).encode() + b"\r\n\r\n" + body_hex.encode()
    )
    leak.server_says(b"HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\n\r\n")
    leak.close()
    p.write(OUT / "exit-witness.pcap")
    print("exit-witness.pcap", (OUT / "exit-witness.pcap").stat().st_size, "bytes")


def reident_kit_zip():
    """Danger — quasi-identifier join + XOR note (key on verify page)."""
    anon = textwrap.dedent(
        """\
        user_id,age,zip,gender,visit_week
        U-4410,29,11564,F,2026-W27
        U-4411,27,90210,M,2026-W27
        U-4412,32,11564,F,2026-W28
        U-4413,42,10001,M,2026-W27
        """
    )
    roll = textwrap.dedent(
        """\
        voter_id,name,age,zip,gender
        V-9001,Aisha Rahman,32,11564,F
        V-9002,James Cole,27,90210,M
        V-9003,Maria Santos,42,10001,M
        V-9004,Lin Wei,31,11564,F
        """
    )
    # Unique match: U-4412 <-> V-9001 (only 32/F/11564)
    note_plain = b"subject_unmasked"
    key = 0x7C
    note_enc = note_plain.hex()  # stored as hex ciphertext bytes XOR'd per nibble pair... use raw xor bytes as hex
    xored = bytes(b ^ key for b in note_plain)
    mapping = textwrap.dedent(
        """\
        # analyst notes — crosswalk when confident
        # U-4412 note payload (hex bytes, single-byte mask — see challenge page):
        """
    ) + xored.hex() + "\n"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("anon_export.csv", anon)
        z.writestr("municipal_roll.csv", roll)
        z.writestr("analyst_notes.txt", mapping)
    (OUT / "reident-kit.zip").write_bytes(buf.getvalue())
    print("reident-kit.zip", (OUT / "reident-kit.zip").stat().st_size, "bytes")


def main():
    bookmark_vault_sqlite()
    profile_archive_zip()
    dns_whisper_pcap()
    tracker_ghost_har()
    briefing_carve_png()
    mask_capture_json()
    exit_witness_pcap()
    reident_kit_zip()
    print("DONE — Day 5 v2 artifacts in", OUT)


if __name__ == "__main__":
    main()
