#!/usr/bin/env python3
"""Generate Day 5 (Privacy) v3 artifacts + matching migration.

Anti-AI principle: the downloadable file is deliberately INCOMPLETE. The
medium/hard/danger challenges embed ciphertext only; the key that decrypts it
is high-entropy and lives ONLY in challenge_live_material (shown on the logged-in
page), never in the file. Key length >= plaintext length, so the file alone is
information-theoretically useless — uploading just the file to a chatbot yields
nothing. No artifact carries the answer in plaintext or any labeled recipe.

Running this writes:
  - public/challenges/day5/*  (opaque artifacts)
  - supabase/migrations/20260709_0300_rewrite_day5_privacy_v3.sql  (keys match)

Regenerate: python scripts/gen-day5-artifacts.py
"""
from __future__ import annotations

import io
import json
import os
import socket
import sqlite3
import struct
import textwrap
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "challenges" / "day5"
MIG = ROOT / "supabase" / "migrations" / "20260709_0300_rewrite_day5_privacy_v3.sql"
OUT.mkdir(parents=True, exist_ok=True)


def xor(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def rand_key(plaintext: str, minimum: int = 48) -> bytes:
    return os.urandom(max(minimum, len(plaintext.encode())))


def enc_hex(plaintext: str, key: bytes) -> str:
    return xor(plaintext.encode(), key).hex()


# --- answers (fixed, stored server-side) -------------------------------------------
ANS = {
    "p5_profile_archive": "midnight_export",
    "p5_dns_whisper": "internal_clinic_net",
    "p5_tracker_ghost": "shadow_pixel",
    "p5_briefing_carve": "leaked_briefing_pack",
    "p5_mask_match": "profile_aligned",
    "p5_exit_witness": "witness_confirmed",
    "p5_reidentified": "subject_unmasked",
}
# per-challenge high-entropy off-file keys (>= plaintext length)
KEYS = {cid: rand_key(ans) for cid, ans in ANS.items()}


# --- PCAP primitives ---------------------------------------------------------------

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
    hdr = struct.pack("!BBHHHBBH4s4s", ver_ihl, 0, total, ident, 0x4000, 64, proto, 0,
                      socket.inet_aton(src), socket.inet_aton(dst))
    chk = ip_checksum(hdr)
    hdr = struct.pack("!BBHHHBBH4s4s", ver_ihl, 0, total, ident, 0x4000, 64, proto, chk,
                      socket.inet_aton(src), socket.inet_aton(dst))
    return hdr + payload


def udp(sport, dport, payload):
    return struct.pack("!HHHH", sport, dport, 8 + len(payload), 0) + payload


def tcp(sport, dport, seq, ack, flags, payload=b"", window=64240):
    return struct.pack("!HHIIBBHHH", sport, dport, seq, ack, (5 << 4), flags, window, 0, 0) + payload


FIN, SYN, RST, PSH, ACK = 0x01, 0x02, 0x04, 0x08, 0x10


class Pcap:
    def __init__(self):
        self.records = []
        self.t = 1752019200.0

    def add(self, frame, dt=0.0012):
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


def dns_query(qname: str, txid: bytes) -> bytes:
    body = b""
    for p in qname.strip(".").split("."):
        body += bytes([len(p)]) + p.encode()
    body += b"\x00\x00\x01\x00\x01"
    return txid + b"\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00" + body


class TcpConn:
    def __init__(self, pcap, cip, sip, cport, sport):
        self.p = pcap
        self.cip, self.sip = cip, sip
        self.cport, self.sport = cport, sport
        self.cseq, self.sseq = 1000, 5000
        self._c(SYN); self.cseq += 1
        self._s(SYN | ACK); self.sseq += 1
        self._c(ACK)

    def _c(self, flags, data=b"", dt=0.02):
        self.p.add(eth() + ipv4(self.cip, self.sip, 6, tcp(self.cport, self.sport, self.cseq, self.sseq, flags, data)), dt)

    def _s(self, flags, data=b"", dt=0.03):
        self.p.add(eth(dst=b"\x02\x00\x00\x00\x00\x01", src=b"\x02\x00\x00\x00\x00\x02")
                   + ipv4(self.sip, self.cip, 6, tcp(self.sport, self.cport, self.sseq, self.cseq, flags, data)), dt)

    def client_says(self, data: bytes):
        self._c(PSH | ACK, data); self.cseq += len(data)

    def server_says(self, data: bytes):
        self._s(PSH | ACK, data); self.sseq += len(data)

    def close(self):
        self._c(FIN | ACK); self.cseq += 1
        self._s(FIN | ACK); self.sseq += 1
        self._c(ACK)


# --- Artifacts ---------------------------------------------------------------------

def bookmark_vault_sqlite():
    """Easy — real places DB; answer is a route slug in one bookmark URL."""
    path = OUT / "places.sqlite"
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.executescript(
        """
        CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT, title TEXT, visit_count INTEGER);
        CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, position INTEGER, title TEXT, dateAdded INTEGER);
        """
    )
    rows = [
        (1, "https://corp.intranet/wiki/privacy-policy", "Privacy Policy"),
        (2, "https://corp.intranet/tools/dns-check", "DNS Check"),
        (3, "https://archive.internal.corp/vault/route_17/snapshot", "Operations Vault"),
        (4, "https://news.example.com/feed", "News Feed"),
    ]
    for i, url, title in rows:
        cur.execute("INSERT INTO moz_places VALUES (?,?,?,?)", (i, url, title, 3))
        cur.execute("INSERT INTO moz_bookmarks VALUES (?,?,?,?,?,?,?)", (i, 1, i, 1, i, title, 1752010000000 + i))
    con.commit()
    con.close()
    print("places.sqlite", path.stat().st_size, "bytes")


def profile_archive_zip():
    """Medium — ZIP with a real cookies.sqlite; one cookie value is ciphertext.
    Key is off-file (challenge page)."""
    cipher = enc_hex(ANS["p5_profile_archive"], KEYS["p5_profile_archive"])
    con = sqlite3.connect(":memory:")
    cur = con.cursor()
    cur.execute("CREATE TABLE moz_cookies (id INTEGER PRIMARY KEY, host TEXT, name TEXT, value TEXT)")
    cur.executemany(
        "INSERT INTO moz_cookies (host,name,value) VALUES (?,?,?)",
        [
            (".cdn.example.net", "uid", "a1b2c3"),
            (".corp.intranet", "lang", "en"),
            (".vault.internal", "blob", cipher),
            (".analytics.example", "sid", "990210"),
        ],
    )
    con.commit()
    db_bytes = con.serialize()
    con.close()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("triage/cookies.sqlite", db_bytes)
        z.writestr("triage/notes.txt", "Seized workstation triage. One stored value is not what it looks like.\n")
    (OUT / "browser-profile.zip").write_bytes(buf.getvalue())
    print("browser-profile.zip", (OUT / "browser-profile.zip").stat().st_size, "bytes")


def dns_whisper_pcap():
    """Medium — DNS exfil: ciphertext hex chunked across query labels amid CDN noise."""
    cipher = enc_hex(ANS["p5_dns_whisper"], KEYS["p5_dns_whisper"])
    chunks = [cipher[i:i + 20] for i in range(0, len(cipher), 20)]
    p = Pcap()
    host, resolver = "10.55.0.44", "10.55.0.53"
    noise = ["www.example.com", "fonts.googleapis.com", "cdn.jsdelivr.net",
             "api.github.com", "status.cloudflare.com", "o.clarity.ms"]
    for i, d in enumerate(noise * 3):
        p.add(eth() + ipv4(host, resolver, 17, udp(52000 + i, 53, dns_query(d, bytes([i & 0xFF, 0x11])))), 0.07)
    for i, ch in enumerate(chunks, 1):
        name = f"s{i}-{ch}.sync.telemetry-cdn.net"
        p.add(eth() + ipv4(host, resolver, 17, udp(53100 + i, 53, dns_query(name, bytes([i, 0x99])))), 0.13)
    p.write(OUT / "dns-whisper.pcap")
    print("dns-whisper.pcap", (OUT / "dns-whisper.pcap").stat().st_size, "bytes")


def tracker_ghost_har():
    """Medium — HAR: ciphertext hex split across third-party response headers, in time order."""
    cipher = enc_hex(ANS["p5_tracker_ghost"], KEYS["p5_tracker_ghost"])
    n = max(1, len(cipher) // 3)
    parts = [cipher[0:n], cipher[n:2 * n], cipher[2 * n:]]

    def entry(url, host, sec, resp_headers):
        return {
            "startedDateTime": f"2026-07-08T12:00:{sec:02d}.000Z",
            "time": 30,
            "request": {"method": "GET", "url": url, "headers": [{"name": "Host", "value": host}]},
            "response": {"status": 204, "headers": resp_headers},
        }

    entries = [
        entry("https://shop.example/", "shop.example", 0, [{"name": "Content-Type", "value": "text/html"}]),
        entry("https://shop.example/cart", "shop.example", 2, [{"name": "Content-Type", "value": "text/html"}]),
        entry("https://pixel.shadow.net/collect", "pixel.shadow.net", 4, [{"name": "X-Seg", "value": parts[0]}]),
        entry("https://tag.metrics-aa.net/p", "tag.metrics-aa.net", 6, [{"name": "X-Seg", "value": parts[1]}]),
        entry("https://sync.broker-cc.io/id", "sync.broker-cc.io", 9, [{"name": "X-Seg", "value": parts[2]}]),
        entry("https://shop.example/checkout", "shop.example", 11, [{"name": "Content-Type", "value": "text/html"}]),
    ]
    har = {"log": {"version": "1.2", "creator": {"name": "SOC export", "version": "1.0"}, "entries": entries}}
    (OUT / "tracker-ghost.har").write_text(json.dumps(har, indent=2), encoding="utf-8")
    print("tracker-ghost.har", (OUT / "tracker-ghost.har").stat().st_size, "bytes")


def briefing_carve_png():
    """Medium — valid PNG with a ZIP carved after IEND; inner blob is ciphertext (key off-file)."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("SKIP briefing-snapshot.png (Pillow missing)")
        return
    cipher_bytes = xor(ANS["p5_briefing_carve"].encode(), KEYS["p5_briefing_carve"])
    img = Image.new("RGB", (720, 400), (18, 22, 28))
    d = ImageDraw.Draw(img)
    d.rectangle([24, 24, 696, 376], outline=(46, 204, 113))
    d.text((48, 48), "SANITIZED BRIEFING EXPORT", fill=(236, 240, 241))
    png_buf = io.BytesIO()
    img.save(png_buf, format="PNG")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("inner/passenger.bin", cipher_bytes)
    with open(OUT / "briefing-snapshot.png", "wb") as f:
        f.write(png_buf.getvalue())
        f.write(zip_buf.getvalue())
    print("briefing-snapshot.png", (OUT / "briefing-snapshot.png").stat().st_size, "bytes")


def mask_capture_json():
    """Hard — one shared off-file key; every row's blob decodes to a plausible token,
    so ONLY matching the live brief (real browser spoofing) picks the right one."""
    key = KEYS["p5_mask_match"]
    rows = [
        {"profile_id": "a1", "timezone": "Europe/London", "language": "en-GB", "screen": "1920x1080",
         "blob": xor(b"profile_drifted", key).hex()},
        {"profile_id": "7f2a", "timezone": "Asia/Riyadh", "language": "ar-SA", "screen": "1366x768",
         "blob": xor(ANS["p5_mask_match"].encode(), key).hex()},
        {"profile_id": "c9", "timezone": "America/New_York", "language": "en-US", "screen": "1440x900",
         "blob": xor(b"profile_masked", key).hex()},
    ]
    doc = {"export": "browser_mask_capture_2026-07-08", "profiles": rows}
    (OUT / "mask-capture.json").write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print("mask-capture.json", (OUT / "mask-capture.json").stat().st_size, "bytes")


def exit_witness_pcap():
    """Hard — Tor-noise pcap; one cleartext HTTP POST body is ciphertext hex (key off-file)."""
    cipher = enc_hex(ANS["p5_exit_witness"], KEYS["p5_exit_witness"])
    p = Pcap()
    client = "10.88.0.12"
    for i, node in enumerate(["185.220.101.44", "185.220.101.45", "185.220.101.46"] * 4):
        c = TcpConn(p, client, node, 44000 + i, 9001)
        c.client_says(b"\x16\x03\x01\x00\xa0" + os.urandom(24))
        c.server_says(b"\x16\x03\x03\x00\x4a" + os.urandom(16))
        c.close()
    leak = TcpConn(p, client, "10.88.0.50", 45100, 8080)
    leak.client_says(
        b"POST /relay/report HTTP/1.1\r\nHost: proxy.internal\r\n"
        b"Content-Type: application/octet-stream\r\n"
        b"Content-Length: " + str(len(cipher)).encode() + b"\r\n\r\n" + cipher.encode()
    )
    leak.server_says(b"HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\n\r\n")
    leak.close()
    p.write(OUT / "exit-witness.pcap")
    print("exit-witness.pcap", (OUT / "exit-witness.pcap").stat().st_size, "bytes")


def reident_kit_zip():
    """Danger — quasi-identifier join to a unique subject; that subject's note is
    ciphertext hex (key off-file). Wrong subject -> wrong bytes -> garbage."""
    key = KEYS["p5_reidentified"]
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
    # Unique exact match: U-4412 (32/11564/F) <-> V-9001. Give every subject a note
    # blob so there's no shortcut; only the correct one decrypts to a real word.
    notes = {
        "U-4410": os.urandom(len(ANS["p5_reidentified"])).hex(),
        "U-4411": os.urandom(len(ANS["p5_reidentified"])).hex(),
        "U-4412": xor(ANS["p5_reidentified"].encode(), key).hex(),
        "U-4413": os.urandom(len(ANS["p5_reidentified"])).hex(),
    }
    notes_txt = "user_id,note\n" + "\n".join(f"{k},{v}" for k, v in notes.items()) + "\n"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("anon_export.csv", anon)
        z.writestr("municipal_roll.csv", roll)
        z.writestr("analyst_notes.csv", notes_txt)
    (OUT / "reident-kit.zip").write_bytes(buf.getvalue())
    print("reident-kit.zip", (OUT / "reident-kit.zip").stat().st_size, "bytes")


# --- Migration emission -------------------------------------------------------------

def sq(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def emit_migration():
    kh = {cid: KEYS[cid].hex() for cid in KEYS}
    challenges = [
        # id, title, category, difficulty, points, fbb, sort, prompt, asset, action, hint
        ("p5_cache_phantom", "Cache Phantom", "Web Privacy", "easy", 160, 50, 501,
         "A marketing page scattered tracking residue across three separate browser stores after you consented. "
         "Nothing is shown on the page itself — recover every fragment from your own session and rebuild the label.",
         None, "/challenge/cache-phantom",
         "Everything you need is already inside your own browser."),
        ("p5_bookmark_vault", "Bookmark Vault", "Browser Forensics", "easy", 170, 50, 502,
         "Analysts seized a browser profile database. Among routine intranet links, the operator kept one destination "
         "that does not belong. Recover the route slug it points to.",
         "/challenges/day5/places.sqlite", "/challenge/verify/p5_bookmark_vault",
         "It behaves like a database, not a document."),
        ("p5_consent_labyrinth", "Consent Labyrinth", "Web Privacy", "easy", 180, 50, 503,
         "This consent wizard only rewards one exact privacy posture. Walk every step, keep only what is truly "
         "required, and read what the page kept for your session.",
         None, "/challenge/consent-labyrinth",
         "Say no to everything that is merely optional."),
        ("p5_profile_archive", "Profile Archive", "Browser Forensics", "medium", 250, 50, 504,
         "A seized workstation triage archive holds the label of a data set the operator quietly pulled off the "
         "machine. Reconstruct that label. Some material needed to read it is provided only on this challenge page.",
         "/challenges/day5/browser-profile.zip", "/challenge/verify/p5_profile_archive",
         "One stored value is not what it claims to be."),
        ("p5_dns_whisper", "DNS Whisper", "Network Privacy", "medium", 275, 50, 505,
         "A capture was taken while someone assumed their name lookups were private. Buried in ordinary noise, a "
         "sensitive value was smuggled out piece by piece. Recover it. Extra material is only on this challenge page.",
         "/challenges/day5/dns-whisper.pcap", "/challenge/verify/p5_dns_whisper",
         "Follow the query names that do not belong."),
        ("p5_tracker_ghost", "Tracker Ghost", "Web Tracking", "medium", 290, 50, 506,
         "A single page load was recorded with all its third-party chatter. The trackers passed a value between "
         "themselves across several calls. Rebuild it. Extra material is only on this challenge page.",
         "/challenges/day5/tracker-ghost.har", "/challenge/verify/p5_tracker_ghost",
         "Only the strangers matter, and the order in which they spoke."),
        ("p5_briefing_carve", "Hidden Briefing", "File Carving", "medium", 305, 50, 507,
         "A sanitized briefing image renders perfectly, yet analysts insist it carries a hidden passenger. Recover "
         "what it hides. Part of what you need is only on this challenge page.",
         "/challenges/day5/briefing-snapshot.png", "/challenge/verify/p5_briefing_carve",
         "The picture keeps something after its ending."),
        ("p5_mask_match", "Mask Match", "Fingerprinting", "hard", 440, 75, 508,
         "A surveillance export logged several browser masks; exactly one belongs to the target session described "
         "on this page. The record only makes sense once your own browser genuinely looks like the target. Recover "
         "the target's value.",
         "/challenges/day5/mask-capture.json", "/challenge/mask-match",
         "The page will not trust a browser that is not really the target."),
        ("p5_exit_witness", "Exit Witness", "Tor / Traffic Analysis", "hard", 470, 75, 509,
         "A capture is dominated by anonymized traffic, but a single report slipped out in the open. Recover what it "
         "carried. Additional material is only on this challenge page.",
         "/challenges/day5/exit-witness.pcap", "/challenge/verify/p5_exit_witness",
         "Almost everything here is sealed. Almost."),
        ("p5_reidentified", "Re-Identified", "De-anonymization", "danger", 600, 100, 510,
         "An 'anonymous' data set and a public list describe the same small population. One person is uniquely "
         "exposed by what the two share. Find them, then recover the note held against their record. Material to "
         "read it is only on this challenge page.",
         "/challenges/day5/reident-kit.zip", "/challenge/verify/p5_reidentified",
         "Three ordinary details are enough to name one person."),
    ]

    lm = {
        "p5_profile_archive": {"session_key_hex": kh["p5_profile_archive"]},
        "p5_dns_whisper": {"session_key_hex": kh["p5_dns_whisper"]},
        "p5_tracker_ghost": {"session_key_hex": kh["p5_tracker_ghost"]},
        "p5_briefing_carve": {"session_key_hex": kh["p5_briefing_carve"]},
        "p5_mask_match": {"timezone": "Asia/Riyadh", "language": "ar-SA", "screen": "1366x768",
                          "session_key_hex": kh["p5_mask_match"]},
        "p5_exit_witness": {"session_key_hex": kh["p5_exit_witness"]},
        "p5_reidentified": {"session_key_hex": kh["p5_reidentified"]},
    }
    answers = {
        "p5_cache_phantom": "crumbs_trail",
        "p5_bookmark_vault": "route_17",
        "p5_consent_labyrinth": "narrow_path",
        **ANS,
    }

    lines = []
    lines.append("-- Day 5 (Privacy) v3 — anti-AI rebuild: file ciphertext + off-file high-entropy keys.")
    lines.append("-- Generated by scripts/gen-day5-artifacts.py — keys here match the shipped artifacts.")
    lines.append("-- 3 easy / 4 medium / 2 hard / 1 danger. Medium+ answers are NOT recoverable from the")
    lines.append("-- download alone; the decrypt key is served only via challenge_live_material.\n")
    for t in ("submission_attempts", "hint_unlocks", "solves", "challenge_answer_keys", "challenge_hints"):
        lines.append(f"delete from public.{t} where challenge_id like 'p5_%';")
    lines.append("delete from public.challenges where id like 'p5_%';\n")

    lines.append("insert into public.challenges")
    lines.append("  (id, title, category, difficulty, points, first_blood_bonus, sort_order, prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic)")
    lines.append("values")
    vals = []
    for cid, title, cat, diff, pts, fbb, sort, prompt, asset, action, _hint in challenges:
        asset_sql = sq(asset) if asset else "null"
        vals.append(f"  ({sq(cid)},{sq(title)},{sq(cat)},{sq(diff)},{pts},{fbb},{sort},\n   {sq(prompt)},\n   {asset_sql},{sq(action)},1,5,false,true)")
    lines.append(",\n".join(vals) + ";\n")

    lines.append("insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)")
    lines.append("values")
    akv = []
    for cid, *_ in challenges:
        material = lm.get(cid)
        mat_sql = (sq(json.dumps(material)) + "::jsonb") if material else "null"
        akv.append(f"  ({sq(cid)},{sq(answers[cid])},encode(extensions.gen_random_bytes(16),'hex'),{mat_sql})")
    lines.append(",\n".join(akv) + ";\n")

    lines.append("insert into public.challenge_hints (challenge_id, hint_number, body, penalty)")
    lines.append("values")
    hv = []
    for cid, title, cat, diff, *_rest in challenges:
        hint = _rest[-1]
        penalty = {"easy": 25, "medium": 40, "hard": 60, "danger": 75}[diff]
        hv.append(f"  ({sq(cid)},1,{sq(hint)},{penalty})")
    lines.append(",\n".join(hv) + ";\n")

    lines.append("insert into public.day_codes (day, code) values (5, 'PRIVACY-2026')")
    lines.append("on conflict (day) do update set code = excluded.code;")
    lines.append("update public.days set requires_code = true where day = 5;")

    MIG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("migration ->", MIG.name)


def main():
    bookmark_vault_sqlite()
    profile_archive_zip()
    dns_whisper_pcap()
    tracker_ghost_har()
    briefing_carve_png()
    mask_capture_json()
    exit_witness_pcap()
    reident_kit_zip()
    emit_migration()
    # Safety: no plaintext answer should appear in any shipped artifact.
    for cid, ans in ANS.items():
        for art in OUT.iterdir():
            data = art.read_bytes()
            assert ans.encode() not in data, f"LEAK: {ans} found in {art.name}"
    print("DONE — Day 5 v3 artifacts + migration; no plaintext answer leaked.")


if __name__ == "__main__":
    main()
