#!/usr/bin/env python3
"""KGSP CTF — Day 4 "target box".

A deliberately-noisy practice host for the three tool-based extra challenges.
It exposes THREE services so students must actually run real tools against a
live target an AI cannot reach or guess:

  * TCP banner  (port 8021) -> "Rogue Port"    -> found with nmap, read with nc
  * plain HTTP  (port 8080) -> "Tapped Wire"    -> sniffed with Wireshark
  * DNS  (UDP   port 5353)  -> "Rogue Resolver" -> queried with dig

Run it on any laptop/VM on the same network as the students:

    python3 server.py

Then tell students the machine's IP address (e.g. `ip addr` / `ipconfig`).
No dependencies, no root needed (all ports are unprivileged). Ctrl-C to stop.

Every answer token can be rotated with an env var (see DEFAULTS below); if you
change one, update the matching row in `public.challenge_answer_keys` so the
server and the grader agree.
"""
import os
import socket
import socketserver
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --- config (override with env vars; defaults MUST match challenge_answer_keys) ---
TCP_PORT = int(os.environ.get("KGSP_TCP_PORT", "8021"))
HTTP_PORT = int(os.environ.get("KGSP_HTTP_PORT", "8080"))
# 8053, not 5353: 5353 is mDNS/Bonjour and is already bound on most Win/Mac boxes.
DNS_PORT = int(os.environ.get("KGSP_DNS_PORT", "8053"))

ROGUE_PORT_CODE = os.environ.get("KGSP_ROGUE_CODE", "r0gue_p0rt_f0und")
SNIFF_CODE = os.environ.get("KGSP_SNIFF_CODE", "cl34rtext_sn1ff3d")
DNS_CODE = os.environ.get("KGSP_DNS_CODE", "dns_txt_l00kup")
DNS_NAME = os.environ.get("KGSP_DNS_NAME", "flag.kgsp.ctf")


# ---------------------------------------------------------------------------
# 1) TCP banner service  ->  "Rogue Port"
#    On connect it prints a banner. nmap -sV fingerprints it; nc reads it.
# ---------------------------------------------------------------------------
class BannerHandler(socketserver.BaseRequestHandler):
    def handle(self):
        banner = (
            "KGSP-RECOVERY-SERVICE v1.3\r\n"
            "This service should never have been exposed.\r\n"
            f"recovery-code: {ROGUE_PORT_CODE}\r\n"
        )
        try:
            self.request.sendall(banner.encode())
        except OSError:
            pass


class ThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


# ---------------------------------------------------------------------------
# 2) Plain-HTTP service  ->  "Tapped Wire"
#    Cleartext HTTP so a Wireshark capture reveals the leaked code.
# ---------------------------------------------------------------------------
class SniffHandler(BaseHTTPRequestHandler):
    def _serve(self):
        body = (
            "<!doctype html><html><head><title>internal status</title></head>"
            "<body style='font-family:monospace;background:#0a0e0a;color:#d7ffd0'>"
            "<h1>edge-rtr-04 // internal status page</h1>"
            "<p>This page is served over plain HTTP. Everything it sends — "
            "including the header below — travels unencrypted.</p>"
            f"<p>recovery-code: {SNIFF_CODE}</p>"
            "</body></html>"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("X-Recovery-Code", SNIFF_CODE)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._serve()

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("X-Recovery-Code", SNIFF_CODE)
        self.end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


# ---------------------------------------------------------------------------
# 3) DNS service  ->  "Rogue Resolver"
#    Answers any query with a TXT record holding the code. `dig` reads it.
# ---------------------------------------------------------------------------
def _parse_qname_end(data: bytes) -> int:
    """Return the offset just past the QNAME's terminating zero byte."""
    off = 12
    while off < len(data):
        length = data[off]
        if length == 0:
            return off + 1
        off += length + 1
    return off


def build_dns_response(query: bytes) -> bytes:
    txn_id = query[:2]
    q_end = _parse_qname_end(query)
    question = query[12:q_end + 4]  # QNAME + QTYPE(2) + QCLASS(2)

    header = (
        txn_id
        + b"\x81\x80"      # flags: standard query response, no error
        + b"\x00\x01"      # QDCOUNT = 1
        + b"\x00\x01"      # ANCOUNT = 1
        + b"\x00\x00"      # NSCOUNT
        + b"\x00\x00"      # ARCOUNT
    )
    txt = DNS_CODE.encode()
    rdata = bytes([len(txt)]) + txt
    answer = (
        b"\xc0\x0c"        # name -> pointer to the question's QNAME
        + b"\x00\x10"      # TYPE = TXT (16)
        + b"\x00\x01"      # CLASS = IN
        + b"\x00\x00\x00\x3c"  # TTL = 60s
        + len(rdata).to_bytes(2, "big")
        + rdata
    )
    return header + question + answer


def serve_dns():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", DNS_PORT))
    except OSError as e:
        print(f"  [Rogue Resolver] FAILED to bind udp/{DNS_PORT}: {e}", flush=True)
        return
    while True:
        try:
            data, addr = sock.recvfrom(512)
            if len(data) >= 12:
                sock.sendto(build_dns_response(data), addr)
        except OSError:
            break


def main():
    tcp = ThreadingTCPServer(("0.0.0.0", TCP_PORT), BannerHandler)
    http = ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), SniffHandler)
    threading.Thread(target=tcp.serve_forever, daemon=True).start()
    threading.Thread(target=http.serve_forever, daemon=True).start()
    threading.Thread(target=serve_dns, daemon=True).start()

    print("KGSP Day 4 target box is up. Share this machine's IP with students.", flush=True)
    print(f"  [Rogue Port]     TCP banner   on port {TCP_PORT}  (nmap -p- / nc)", flush=True)
    print(f"  [Tapped Wire]    plain HTTP    on port {HTTP_PORT} (Wireshark)", flush=True)
    print(f"  [Rogue Resolver] DNS TXT       on udp/{DNS_PORT}   (dig -p {DNS_PORT} @<ip> {DNS_NAME} TXT)", flush=True)
    print("Ctrl-C to stop.", flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        print("\nStopping.")


if __name__ == "__main__":
    main()
