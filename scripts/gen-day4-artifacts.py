#!/usr/bin/env python3
"""Generate all Day 4 (Securing Networks) artifacts.

Every flag is embedded ONLY inside the artifact (or lives server-side in
challenge_flags for the live one). No flag string ships in client JS.
"""
import struct, socket, zlib, gzip, io, os, base64, subprocess, textwrap

OUT = "/home/user/CTF-/public/challenges/day4"
os.makedirs(OUT, exist_ok=True)

# ----------------------------------------------------------------------------
# PCAP primitives (classic little-endian .pcap, Ethernet link type)
# ----------------------------------------------------------------------------
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
    hdr = struct.pack("!BBHHHBBH4s4s", ver_ihl, 0, total, ident, 0x4000,
                      64, proto, 0, socket.inet_aton(src), socket.inet_aton(dst))
    chk = ip_checksum(hdr)
    hdr = struct.pack("!BBHHHBBH4s4s", ver_ihl, 0, total, ident, 0x4000,
                      64, proto, chk, socket.inet_aton(src), socket.inet_aton(dst))
    return hdr + payload

def tcp(sport, dport, seq, ack, flags, payload=b"", window=64240):
    off = (5 << 4)
    hdr = struct.pack("!HHIIBBHHH", sport, dport, seq, ack, off, flags,
                      window, 0, 0)
    return hdr + payload  # TCP checksum 0 (Wireshark default: not validated)

def udp(sport, dport, payload):
    length = 8 + len(payload)
    return struct.pack("!HHHH", sport, dport, length, 0) + payload

FIN, SYN, RST, PSH, ACK = 0x01, 0x02, 0x04, 0x08, 0x10

class Pcap:
    def __init__(self):
        self.records = []
        self.t = 1751878800.0  # 2026-07-07T09:00:00Z-ish
    def add(self, frame, dt=0.0011):
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
    """Models one client<->server TCP conversation with correct seq/ack so
    Wireshark 'Follow TCP Stream' reassembles cleanly."""
    def __init__(self, pcap, cip, sip, cport, sport):
        self.p = pcap; self.cip = cip; self.sip = sip
        self.cport = cport; self.sport = sport
        self.cseq = 1000; self.sseq = 5000
        # handshake
        self._c(SYN); self.cseq += 1
        self._s(SYN | ACK); self.sseq += 1
        self._c(ACK)
    def _c(self, flags, data=b"", dt=0.02):
        frame = eth() + ipv4(self.cip, self.sip, 6,
                             tcp(self.cport, self.sport, self.cseq, self.sseq, flags, data))
        self.p.add(frame, dt)
    def _s(self, flags, data=b"", dt=0.03):
        frame = eth(dst=b"\x02\x00\x00\x00\x00\x01", src=b"\x02\x00\x00\x00\x00\x02") + \
                ipv4(self.sip, self.cip, 6,
                     tcp(self.sport, self.cport, self.sseq, self.cseq, flags, data))
        self.p.add(frame, dt)
    def client_says(self, data: bytes):
        self._c(PSH | ACK, data); self.cseq += len(data)
    def server_says(self, data: bytes):
        self._s(PSH | ACK, data); self.sseq += len(data)
    def close(self):
        self._c(FIN | ACK); self.cseq += 1
        self._s(FIN | ACK); self.sseq += 1
        self._c(ACK)

# ----------------------------------------------------------------------------
# Capture 1: login-capture.pcap  (Easy — follow the SUCCESSFUL http login)
# ----------------------------------------------------------------------------
def cap_login():
    p = Pcap()
    CLIENT, SERVER = "10.10.5.23", "10.10.5.10"
    # DNS noise
    dnsq = b"\x12\x34\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00" \
           b"\x06portal\x05local\x00\x00\x01\x00\x01"
    p.add(eth() + ipv4(CLIENT, "10.10.5.53", 17, udp(51000, 53, dnsq)), 0.05)

    # Conn A: FAILED login (decoy) — guest/letmein -> 401
    a = TcpConn(p, CLIENT, SERVER, 49001, 80)
    a.client_says(b"POST /auth HTTP/1.1\r\nHost: portal.local\r\n"
                  b"Content-Type: application/x-www-form-urlencoded\r\n"
                  b"Content-Length: 30\r\n\r\n"
                  b"username=guest&password=letmein")
    a.server_says(b"HTTP/1.1 401 Unauthorized\r\nContent-Type: text/html\r\n"
                  b"Content-Length: 26\r\n\r\n<h1>Invalid credentials</h1>")
    a.close()

    # Conn B: SUCCESSFUL login — jbennett/Wint3r2026! -> 200 Welcome
    b = TcpConn(p, CLIENT, SERVER, 49002, 80)
    b.client_says(b"POST /auth HTTP/1.1\r\nHost: portal.local\r\n"
                  b"Content-Type: application/x-www-form-urlencoded\r\n"
                  b"Content-Length: 38\r\n\r\n"
                  b"username=jbennett&password=Wint3r2026!")
    b.server_says(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n"
                  b"Set-Cookie: session=ok\r\nContent-Length: 34\r\n\r\n"
                  b"<h1>Welcome back, jbennett</h1>")
    b.close()
    p.write(f"{OUT}/login-capture.pcap")
    print("login-capture.pcap", os.path.getsize(f"{OUT}/login-capture.pcap"), "bytes")

# ----------------------------------------------------------------------------
# Capture 2: traffic-dump.pcap  (Hard — hunt the periodic C2 beacon)
# ----------------------------------------------------------------------------
def cap_hunt():
    p = Pcap()
    HOST = "10.20.0.15"
    benign_hosts = ["93.184.216.34", "140.82.112.3", "151.101.1.140"]
    # scatter benign HTTP + DNS traffic
    for i in range(12):
        srv = benign_hosts[i % len(benign_hosts)]
        c = TcpConn(p, HOST, srv, 40000 + i, 443)
        c.client_says(b"GET / HTTP/1.1\r\nHost: cdn.example.net\r\n\r\n")
        c.server_says(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello")
        c.close()
        dnsq = b"\xaa\xbb\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00" \
               b"\x03cdn\x07example\x03net\x00\x00\x01\x00\x01"
        p.add(eth() + ipv4(HOST, "10.20.0.53", 17, udp(52000 + i, 53, dnsq)), 0.4)

    # The C2 beacon: same external IP, same port, ~30s apart, 3 fragments.
    C2 = "185.220.101.44"
    frags = [b"BEACON seq=001 payload=KGSP{",
             b"BEACON seq=002 payload=b34con_",
             b"BEACON seq=003 payload=c2_f0und}"]
    for i, fr in enumerate(frags):
        # jump the clock ~30s so the periodicity is visible in the timeline
        p.t += 30.0
        c = TcpConn(p, HOST, C2, 55550, 8443)
        c.client_says(fr)
        c.server_says(b"ACK")
        c.close()
    p.write(f"{OUT}/traffic-dump.pcap")
    print("traffic-dump.pcap", os.path.getsize(f"{OUT}/traffic-dump.pcap"), "bytes")

# ----------------------------------------------------------------------------
# network-diagram.png  (Medium — valid PNG with a ZIP carved onto the end)
# ----------------------------------------------------------------------------
def carved_png():
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (640, 360), (11, 15, 20))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 620, 340], outline=(46, 204, 113))
    for (x, label) in [(70, "WAN"), (290, "DMZ"), (470, "LAN")]:
        d.rectangle([x, 150, x + 100, 210], outline=(52, 152, 219))
        d.text((x + 30, 175), label, fill=(236, 240, 241))
    d.line([170, 180, 290, 180], fill=(149, 165, 166))
    d.line([390, 180, 470, 180], fill=(149, 165, 166))
    d.text((40, 300), "edge-rtr-04 topology export", fill=(127, 140, 141))
    png_buf = io.BytesIO()
    img.save(png_buf, format="PNG")
    png_bytes = png_buf.getvalue()

    # build the zip to append
    zip_buf = io.BytesIO()
    import zipfile
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("recovered/secret.txt",
                   "Recovered from slack space of the topology export.\n\n"
                   "KGSP{h1dden_aft3r_iend}\n")
        z.writestr("recovered/note.txt",
                   "Data appended after a PNG's IEND chunk still renders as a\n"
                   "normal image, but a ZIP reader finds it by scanning from EOF.\n")
    with open(f"{OUT}/network-diagram.png", "wb") as f:
        f.write(png_bytes)
        f.write(zip_buf.getvalue())
    print("network-diagram.png", os.path.getsize(f"{OUT}/network-diagram.png"), "bytes")

# ----------------------------------------------------------------------------
# recon-photo.jpg  (Medium — real EXIF GPS -> Statue of Liberty)
# ----------------------------------------------------------------------------
def exif_jpg():
    from PIL import Image, ImageDraw
    import piexif, piexif.helper
    img = Image.new("RGB", (800, 500), (23, 32, 42))
    d = ImageDraw.Draw(img)
    for y in range(500):
        d.line([(0, y), (800, y)], fill=(23, 32 + y // 12, 42 + y // 20))
    d.text((40, 40), "FIELD RECON 07", fill=(236, 240, 241))
    d.text((40, 440), "coordinates embedded in file metadata", fill=(180, 190, 200))

    def deg(v):
        v = abs(v); dd = int(v); mm = int((v - dd) * 60); ss = round((v - dd - mm/60) * 3600 * 100)
        return ((dd, 1), (mm, 1), (ss, 100))
    lat, lon = 40.689247, -74.044502  # Statue of Liberty
    gps = {
        piexif.GPSIFD.GPSLatitudeRef: "N",
        piexif.GPSIFD.GPSLatitude: deg(lat),
        piexif.GPSIFD.GPSLongitudeRef: "W",
        piexif.GPSIFD.GPSLongitude: deg(lon),
    }
    exif = {
        "0th": {
            piexif.ImageIFD.Make: "ReconCam",
            piexif.ImageIFD.Model: "RC-9",
            piexif.ImageIFD.Artist: "SOC field team",
        },
        "Exif": {
            piexif.ExifIFD.UserComment: piexif.helper.UserComment.dump(
                "Adversary HQ photographed on site. Identify the monument at "
                "these GPS coordinates. Flag = its common English name, "
                "lowercase, words joined by underscores, e.g. KGSP{golden_gate_bridge}."),
        },
        "GPS": gps,
    }
    img.save(f"{OUT}/recon-photo.jpg", exif=piexif.dump(exif), quality=88)
    print("recon-photo.jpg", os.path.getsize(f"{OUT}/recon-photo.jpg"), "bytes")

# ----------------------------------------------------------------------------
# snmp-backup.txt  (Medium live — the RW community string, buried in config)
# ----------------------------------------------------------------------------
def snmp_notes():
    txt = textwrap.dedent("""\
        ! edge-rtr-04 — SNMP subsystem backup (partial)
        ! Exported for the maintenance window. Do NOT commit to the repo.

        snmp-server contact soc@corp.internal
        snmp-server location rack-B7

        ! Read-only monitoring community (safe to share with the NOC):
        snmp-server community public ro

        ! ----------------------------------------------------------------
        ! Read-WRITE community — rotate after the audit. Grants config OIDs.
        ! Used by the live router console at /challenge/router-console
        snmp-server community n0c_m0nit0r! rw
        ! ----------------------------------------------------------------

        snmp-server enable traps
        snmp-server host 10.40.0.20 version 2c public
        ! end
        """)
    with open(f"{OUT}/snmp-backup.txt", "w") as f:
        f.write(txt)
    print("snmp-backup.txt", os.path.getsize(f"{OUT}/snmp-backup.txt"), "bytes")

# ----------------------------------------------------------------------------
# intercepted.txt  (Hard — CyberChef: From Base64 -> Gunzip -> XOR)
# ----------------------------------------------------------------------------
def cyberchef_blob():
    flag = b"KGSP{mult1_layer_r3cipe}"
    key = bytes.fromhex("4b3379523074")  # "K3yR0t"
    xored = bytes(b ^ key[i % len(key)] for i, b in enumerate(flag))
    gz = gzip.compress(xored)
    b64 = base64.b64encode(gz).decode()
    body = textwrap.dedent(f"""\
        Intercepted beacon payload (SOC capture 0x41).
        The C2 wraps its command in three layers. Peel them in CyberChef:

          Layer 1: Base64
          Layer 2: Gzip (raw DEFLATE with gzip header)
          Layer 3: XOR with repeating key (HEX): 4b3379523074

        Recommended CyberChef recipe:
          From Base64  ->  Gunzip  ->  XOR (key 4b3379523074, HEX)

        PAYLOAD:
        {b64}
        """)
    with open(f"{OUT}/intercepted.txt", "w") as f:
        f.write(body)
    print("intercepted.txt", os.path.getsize(f"{OUT}/intercepted.txt"), "bytes")

# ----------------------------------------------------------------------------
# breach-kit.zip  (Danger — base64 stage -> AES-256-CBC payload)
# ----------------------------------------------------------------------------
def danger_zip():
    import zipfile
    flag = b"KGSP{d33p_breach_ch41n}"
    key_hex = "6b6579666f727468656272656163686b6579666f72746865627231323334ffee"  # 32 bytes
    iv_hex = "aabbccddeeff00112233445566778899"  # 16 bytes
    key = bytes.fromhex(key_hex); iv = bytes.fromhex(iv_hex)
    # PKCS#7 pad + AES-256-CBC via openssl (no salt, raw key/iv)
    plain_path = "/tmp/_p.bin"; enc_path = "/tmp/_c.bin"
    with open(plain_path, "wb") as f:
        f.write(flag)
    subprocess.run(["openssl", "enc", "-aes-256-cbc", "-nosalt",
                    "-K", key_hex, "-iv", iv_hex,
                    "-in", plain_path, "-out", enc_path], check=True)
    ct_hex = open(enc_path, "rb").read().hex()

    stage1 = base64.b64encode(
        f"AES-256-CBC key (hex): {key_hex}\nIV (hex): {iv_hex}\n".encode()).decode()
    readme = textwrap.dedent(f"""\
        DEEP BREACH KIT
        ===============
        Two stages. Use any tools you like (browser or desktop).

        STAGE 1 — recover the key material
          stage1.b64 is Base64. Decode it (CyberChef 'From Base64', or
          `base64 -d`) to reveal the AES-256-CBC KEY and IV (both hex).

        STAGE 2 — decrypt the payload
          payload.enc.hex is the ciphertext as hex. Decrypt with AES-256-CBC.

          CyberChef:  From Hex -> AES Decrypt (Key HEX, IV HEX, mode CBC, input Raw)
          openssl:    xxd -r -p payload.enc.hex | \\
                        openssl enc -d -aes-256-cbc -nosalt -K <KEY> -iv <IV>

        The plaintext is the flag.
        """)
    with zipfile.ZipFile(f"{OUT}/breach-kit.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", readme)
        z.writestr("stage1.b64", stage1 + "\n")
        z.writestr("payload.enc.hex", ct_hex + "\n")
    print("breach-kit.zip", os.path.getsize(f"{OUT}/breach-kit.zip"), "bytes")

for fn in (cap_login, cap_hunt, carved_png, exif_jpg, snmp_notes,
           cyberchef_blob, danger_zip):
    fn()
print("DONE")
