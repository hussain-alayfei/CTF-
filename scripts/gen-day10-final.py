#!/usr/bin/env python3
"""Generate Day 10 Final CTF artifacts + print SQL live_material / secrets.

Answers are fixed recovery words (never flag-shaped). Secrets/keys are random
per run — re-apply the emitted migration when regenerating.
"""
from __future__ import annotations

import hashlib
import io
import math
import os
import random
import socket
import struct
import textwrap
import zipfile
import zlib
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    raise SystemExit(f"Need pillow+numpy: {e}")

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "challenges" / "day10"
OUT.mkdir(parents=True, exist_ok=True)

# Fixed recovery answers (never KGSP{…})
ANSWERS = {
    "d10_deep_static": "spectrum_glyph",
    "d10_hidden_home": "always_check_dots",
    "d10_forgot_path": "backup_temp_note",
    "d10_loose_equals": "zero_match_ok",
    "d10_clear_stream": "http_desk_slip",
    "d10_ghost_canvas": "blue_branch_whisper",
    "d10_usb_polyglot": "usb_inner_pass",
    "d10_secret_album": "album_104_seal",
    "d10_poisoned_prefs": "prefs_exec_token",
    "d10_office_leak": "c2_payload_tag",
    "d10_process_residue": "ram_key_shard",
    "d10_gallery_lock": "curator_bypass",
    "d10_relay_note": "relay_plain_ok",
    "d10_license_vm": "vm_license_ok",
    "d10_rsa_broadcast": "crt_message",
    "d10_false_debug": "true_core_flag",
    "d10_layered_breach": "breach_full_chain",
    "d10_inherited_trust": "chief_final_clear",
    "d10_race_window": "race_final_ok",
    "d10_capstone_chain": "novatech_closed",
}

rng = random.SystemRandom()


def secret_hex(n=16) -> str:
    return rng.randbytes(n).hex()


def xor_hex(plain: str, key_seed: str) -> str:
    key = hashlib.sha256(key_seed.encode()).digest()
    data = plain.encode()
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data)).hex()


def write_bytes(name: str, data: bytes):
    path = OUT / name
    path.write_bytes(data)
    print(f"  wrote {path.relative_to(ROOT)} ({len(data)} bytes)")


# ---------- spectrogram WAV ----------
def make_spectrogram_wav(text: str, path: Path):
    """Paint `text` into a spectrogram by driving sine energy per column."""
    sample_rate = 44100
    duration = 3.2
    n = int(sample_rate * duration)
    # Render text to a small bitmap
    img_w, img_h = 220, 64
    img = Image.new("L", (img_w, img_h), 0)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    draw.text((6, 20), text, fill=255, font=font)
    pixels = np.array(img)

    audio = np.zeros(n, dtype=np.float64)
    col_samples = n // img_w
    f_lo, f_hi = 1800.0, 7800.0
    for x in range(img_w):
        col = pixels[:, x]
        lit = np.where(col > 40)[0]
        if len(lit) == 0:
            continue
        t0 = x * col_samples
        t1 = min(n, t0 + col_samples)
        t = np.arange(t0, t1) / sample_rate
        for y in lit:
            # y=0 top → high freq
            freq = f_hi - (y / (img_h - 1)) * (f_hi - f_lo)
            amp = 0.045 * (col[y] / 255.0)
            audio[t0:t1] += amp * np.sin(2 * np.pi * freq * t)

    # add quiet noise so it "sounds" like static
    audio += np.random.default_rng(7).normal(0, 0.008, n)
    audio = np.clip(audio, -0.95, 0.95)
    pcm = (audio * 32767).astype(np.int16)

    buf = io.BytesIO()
    # WAV header
    data = pcm.tobytes()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + len(data)))
    buf.write(b"WAVEfmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", len(data)))
    buf.write(data)
    path.write_bytes(buf.getvalue())
    print(f"  wrote {path.relative_to(ROOT)}")


# ---------- PCAP helpers ----------
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
        ver_ihl,
        0,
        total,
        ident,
        0x4000,
        64,
        proto,
        0,
        socket.inet_aton(src),
        socket.inet_aton(dst),
    )
    chk = ip_checksum(hdr)
    hdr = struct.pack(
        "!BBHHHBBH4s4s",
        ver_ihl,
        0,
        total,
        ident,
        0x4000,
        64,
        proto,
        chk,
        socket.inet_aton(src),
        socket.inet_aton(dst),
    )
    return hdr + payload


def tcp(sport, dport, seq, ack, flags, payload=b"", window=64240):
    off = 5 << 4
    return struct.pack("!HHIIBBHHH", sport, dport, seq, ack, off, flags, window, 0, 0) + payload


FIN, SYN, RST, PSH, ACK = 0x01, 0x02, 0x04, 0x08, 0x10


class Pcap:
    def __init__(self):
        self.records = []
        self.t = 1752600000.0

    def add(self, frame, dt=0.002):
        self.t += dt
        sec = int(self.t)
        usec = int((self.t - sec) * 1_000_000)
        self.records.append(struct.pack("<IIII", sec, usec, len(frame), len(frame)) + frame)

    def write(self, path: Path):
        gh = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
        path.write_bytes(gh + b"".join(self.records))
        print(f"  wrote {path.relative_to(ROOT)}")


class TcpConn:
    def __init__(self, pcap, cip, sip, cport, sport):
        self.p = pcap
        self.cip = cip
        self.sip = sip
        self.cport = cport
        self.sport = sport
        self.cseq = 1000
        self.sseq = 5000
        self._c(SYN)
        self.cseq += 1
        self._s(SYN | ACK)
        self.sseq += 1
        self._c(ACK)

    def _c(self, flags, data=b"", dt=0.02):
        frame = eth() + ipv4(self.cip, self.sip, 6, tcp(self.cport, self.sport, self.cseq, self.sseq, flags, data))
        self.p.add(frame, dt)
        self.cseq += len(data)

    def _s(self, flags, data=b"", dt=0.03):
        frame = eth(dst=b"\x02\x00\x00\x00\x00\x01", src=b"\x02\x00\x00\x00\x00\x02") + ipv4(
            self.sip, self.cip, 6, tcp(self.sport, self.cport, self.sseq, self.cseq, flags, data)
        )
        self.p.add(frame, dt)
        self.sseq += len(data)

    def http_get(self, path, host="desk.novatech.local"):
        req = f"GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n".encode()
        self._c(PSH | ACK, req)
        self._s(ACK)

    def http_resp(self, body: bytes, status="200 OK", ctype="text/plain"):
        head = (
            f"HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n"
        ).encode()
        self._s(PSH | ACK, head + body)
        self._c(ACK)
        self._s(FIN | ACK)
        self.sseq += 1
        self._c(FIN | ACK)
        self.cseq += 1
        self._s(ACK)


def png_rgb(w, h, paint_fn) -> bytes:
    img = Image.new("RGB", (w, h), (20, 80, 30))
    paint_fn(img)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main():
    print("Generating Day 10 artifacts…")
    materials: dict[str, dict] = {}
    secrets: dict[str, str] = {cid: secret_hex() for cid in ANSWERS}

    # --- Easy: spectrogram (full recovery word painted in frequencies) ---
    make_spectrogram_wav(ANSWERS["d10_deep_static"], OUT / "deep-static.wav")

    # --- Easy: intern home zip ---
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("home/Documents/readme.txt", "NovaTech intern notes — nothing sensitive here.\n")
        zf.writestr("home/Desktop/todo.txt", "- finish onboarding\n- return badge\n")
        zf.writestr("home/.bash_history", "ls\nnano .secret\ncat .secret\nexit\n")
        zf.writestr("home/.secret", ANSWERS["d10_hidden_home"] + "\n")
    write_bytes("Intern_Home.zip", zbuf.getvalue())

    # --- Easy: clear stream pcap ---
    p = Pcap()
    c = TcpConn(p, "10.0.4.22", "10.0.4.8", 49152, 80)
    c.http_get("/desk/slip.txt")
    c.http_resp(f"desk slip: {ANSWERS['d10_clear_stream']}\n".encode())
    # noise traffic
    c2 = TcpConn(p, "10.0.4.30", "10.0.4.8", 49160, 80)
    c2.http_get("/health")
    c2.http_resp(b"ok")
    p.write(OUT / "overnight-desk.pcap")

    # --- Medium: ghost canvas (blue channel partial + live key) ---
    partial = "blue_branch"
    key_seed = secrets["d10_ghost_canvas"][:16]
    reveal = xor_hex(ANSWERS["d10_ghost_canvas"], "woods")
    materials["d10_ghost_canvas"] = {"reveal_hex": reveal, "note": "finish with the gallery word from the page title mark"}

    def paint_ghost(img: Image.Image):
        # green forest base
        px = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                g = 40 + (x * 3 + y * 5) % 90
                px[x, y] = (10 + (x % 20), g, 8 + (y % 15))
        # draw text only into blue channel at low intensity
        overlay = Image.new("L", img.size, 0)
        d = ImageDraw.Draw(overlay)
        try:
            font = ImageFont.truetype("arial.ttf", 28)
        except Exception:
            font = ImageFont.load_default()
        d.text((40, h // 2 - 20), partial, fill=40, font=font)
        opx = overlay.load()
        for y in range(h):
            for x in range(w):
                if opx[x, y]:
                    r, g, b = px[x, y]
                    px[x, y] = (r, g, min(255, b + opx[x, y]))

    write_bytes("silence_of_the_woods.png", png_rgb(640, 400, paint_ghost))
    # fix material: students recover partial from blue channel, decrypt reveal with seed "woods"
    materials["d10_ghost_canvas"] = {"reveal_hex": reveal}

    # --- Medium: USB polyglot PNG+ZIP ---
    logo = png_rgb(
        240,
        120,
        lambda im: ImageDraw.Draw(im).text((30, 45), "NovaTech", fill=(220, 220, 220)),
    )
    inner_cipher = xor_hex(ANSWERS["d10_usb_polyglot"], "usb-lot")
    materials["d10_usb_polyglot"] = {"key_seed": "usb-lot", "hint_hex": inner_cipher[:8]}
    # Put ciphertext in zip; live page shows key_seed as key_hex material differently
    # Better: zip contains cipher hex; live_material has reveal via key
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as zf:
        zf.writestr("credentials.txt", f"cipher_hex={inner_cipher}\n")
    poly = logo + zbuf.getvalue()
    write_bytes("company_logo.png", poly)
    materials["d10_usb_polyglot"] = {"reveal_hex": xor_hex(ANSWERS["d10_usb_polyglot"], "lot")}
    # students: extract zip from png, get cipher_hex, XOR with sha256("lot") from live page label
    # Actually put key on live page as key_seed in material:
    materials["d10_usb_polyglot"] = {
        "key_seed": "lot",
        "instruction": "combine the inner cipher with the live seed",
    }
    # Store cipher only in zip; live has key_seed. Answer = decrypt cipher with sha256(key_seed)
    # Re-write zip content cleanly:
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as zf:
        zf.writestr(
            "credentials.txt",
            f"cipher_hex={xor_hex(ANSWERS['d10_usb_polyglot'], 'lot')}\n",
        )
    write_bytes("company_logo.png", logo + zbuf.getvalue())
    materials["d10_usb_polyglot"] = {"key_seed": "lot"}

    # --- Medium: office leak pcap (partial tag in traffic + live fragment) ---
    partial_tag = "c2_payload"
    live_frag = "_tag"
    materials["d10_office_leak"] = {"frag": live_frag}
    p = Pcap()
    c = TcpConn(p, "10.1.0.44", "10.1.0.9", 50001, 8080)
    c.http_get("/exfil")
    c.http_resp(f"transfer-id: {partial_tag}\nstatus: queued\n".encode())
    for i in range(4):
        c3 = TcpConn(p, f"10.1.0.{50+i}", "10.1.0.9", 51000 + i, 80)
        c3.http_get("/ping")
        c3.http_resp(b"pong")
    p.write(OUT / "office-capture.pcap")

    # --- Medium: process residue bin ---
    shard = "ram_key"
    noise = rng.randbytes(1800)
    marker = b"NTPROC\x00" + shard.encode() + b"\x00END"
    blob = noise[:400] + marker + noise[400:]
    write_bytes("process-residue.bin", blob)
    materials["d10_process_residue"] = {"suffix": "_shard"}

    # --- Medium: relay note ---
    key = rng.randbytes(32).hex()
    plain = ANSWERS["d10_relay_note"].encode()
    key_b = bytes.fromhex(key)
    cipher = bytes(plain[i] ^ key_b[i % len(key_b)] for i in range(len(plain)))
    write_bytes("relay-note.txt", f"cipher_hex={cipher.hex()}\n".encode())
    materials["d10_relay_note"] = {"key_hex": key}

    # --- Hard: RSA e=3 broadcast (toy CRT; message fits under each n) ---
    msg = ANSWERS["d10_rsa_broadcast"].encode()
    m = int.from_bytes(msg, "big")
    e = 3
    # ~50-bit primes → n large enough for an 11-byte ASCII message (~87 bits)
    primes = [
        (1114899329767523, 157784336128931),
        (736383415060781, 2625743645811719),
        (1395077478906017, 2147084732397713),
    ]
    ns = []
    cs = []
    for p_, q_ in primes:
        n = p_ * q_
        if m >= n:
            raise SystemExit(f"message too large for n={n}")
        c = pow(m, e, n)
        ns.append(n)
        cs.append(c)
    rsa_body = textwrap.dedent(
        f"""\
        # Triple wrap of one short desk message (public exponents match).
        e = {e}
        n1 = {ns[0]}
        c1 = {cs[0]}
        n2 = {ns[1]}
        c2 = {cs[1]}
        n3 = {ns[2]}
        c3 = {cs[2]}
        """
    )
    write_bytes("triple-broadcast.txt", rsa_body.encode())
    materials["d10_rsa_broadcast"] = {"e": str(e)}

    # --- Hard: layered breach zip ---
    # piece A in txt, B in blue-ish note, C needs live key
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as zf:
        zf.writestr("piece_a.txt", "piece_a=breach_full\n")
        zf.writestr(
            "piece_b.png",
            png_rgb(
                200,
                80,
                lambda im: ImageDraw.Draw(im).text((10, 30), "_chain", fill=(30, 30, 200)),
            ),
        )
        zf.writestr("noise.log", "irrelevant\n" * 20)
    write_bytes("layered-breach.zip", zbuf.getvalue())
    materials["d10_layered_breach"] = {"suffix": ""}  # answer is breach_full_chain from a+b; live confirms
    # Make medium+ incomplete: live material required — put final underscore glue on page
    materials["d10_layered_breach"] = {"glue": "_"}  # a=breach_full b=chain with glue → breach_full_chain
    # Wait piece_b is "_chain" — a+b = breach_full_chain without live. Add live requirement:
    materials["d10_layered_breach"] = {"reveal_hex": xor_hex(ANSWERS["d10_layered_breach"], "breach")}
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as zf:
        zf.writestr("piece_a.txt", "stage=breach\n")
        zf.writestr("piece_b.txt", "stage=full\n")
        zf.writestr("readme.txt", "Two stage marks found. The live desk holds the seal that finishes them.\n")
    write_bytes("layered-breach.zip", zbuf.getvalue())
    materials["d10_layered_breach"] = {"reveal_hex": xor_hex(ANSWERS["d10_layered_breach"], "breach")}

    # --- Capstone in-lab evidence (also public for generator completeness) ---
    write_bytes(
        "capstone-map.txt",
        textwrap.dedent(
            """\
            NovaTech final desk map
            /assets/backups/temp/   (legacy)
            album id window: 100-110
            overnight transfer tag prefix: c2_
            license desk: activation lattice
            """
        ).encode(),
    )

    # Live-only materials for labs (no download)
    materials["d10_forgot_path"] = {}
    materials["d10_loose_equals"] = {"reveal_hex": xor_hex(ANSWERS["d10_loose_equals"], "0e")}
    materials["d10_secret_album"] = {"reveal_hex": xor_hex(ANSWERS["d10_secret_album"], "104")}
    materials["d10_poisoned_prefs"] = {"reveal_hex": xor_hex(ANSWERS["d10_poisoned_prefs"], "admin")}
    materials["d10_gallery_lock"] = {"reveal_hex": xor_hex(ANSWERS["d10_gallery_lock"], "curator")}
    materials["d10_license_vm"] = {"reveal_hex": xor_hex(ANSWERS["d10_license_vm"], "lattice")}
    materials["d10_false_debug"] = {"reveal_hex": xor_hex(ANSWERS["d10_false_debug"], "core")}
    materials["d10_inherited_trust"] = {
        "reveal_hex": xor_hex(ANSWERS["d10_inherited_trust"], "chief"),
        "seal": "D10-SEAL",
    }
    materials["d10_race_window"] = {"reveal_hex": xor_hex(ANSWERS["d10_race_window"], "race")}
    materials["d10_capstone_chain"] = {
        "reveal_hex": xor_hex(ANSWERS["d10_capstone_chain"], "closed"),
        "gate": "n10-final",
    }

    # Emit SQL fragment for migration authoring
    emit = ROOT / "scripts" / "_day10_generated_material.sql"
    lines = ["-- AUTO-generated by gen-day10-final.py — paste into migration\n"]
    for cid, ans in ANSWERS.items():
        sec = secrets[cid]
        mat = materials.get(cid) or {}
        import json

        mat_json = json.dumps(mat).replace("'", "''")
        lines.append(
            f"insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)\n"
            f"values ('{cid}', '{ans}', '{sec}', '{mat_json}'::jsonb)\n"
            f"on conflict (challenge_id) do update set\n"
            f"  answer = excluded.answer,\n"
            f"  secret = excluded.secret,\n"
            f"  live_material = excluded.live_material;\n"
        )
    emit.write_text("".join(lines), encoding="utf-8")
    print(f"\n  wrote {emit.relative_to(ROOT)}")
    print("Done. Re-apply Day 10 content migration after regenerating.")


if __name__ == "__main__":
    main()
