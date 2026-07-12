#!/usr/bin/env python3
"""
Day 7 (Web Applications) generator.

Builds a 15-challenge pack and emits an idempotent, UPSERT-ONLY migration:

  * 4 EASY   — fun logic / CS / math puzzles (browser + a few lines of script)
  * 4 MEDIUM — heavier logic: LCG breaking, cycle-collapse, parser games, bit ops
  * 4 HARD   — serious web-app security: blind SQLi, request smuggling, SSTI,
               prototype pollution
  * 3 DANGER — brutal: custom-VM reversing, many-time-pad cryptanalysis, and a
               unique-solution constraint system (Z3-shaped)

Design rules (same as Day 4/5/6, see CLAUDE.md):
  * No flag string (KGSP{...}) ships in any artifact, the client bundle, or the
    database. The recovered ANSWER is checked server-side by
    verify_challenge_answer, which mints a per-PLAYER HMAC flag on success — so
    pasting a prompt into an AI yields nothing submittable, and flags can't be
    shared.
  * The answer is only recoverable by doing the actual work on the artifact; it
    never appears in the prompt.
  * EVERY builder asserts that the intended solution reproduces the stored
    answer. If any assert fails the migration is NOT written. That assertion is
    the guarantee against a corrupt / unsolvable challenge.
  * The migration is upsert-only: it never deletes a challenge row (see rule #1
    in supabase/migrations/README.md). Re-applying it is safe and preserves the
    per-deploy `secret` (so already-minted flags keep validating).

Answers are checked with lower(btrim(...)) == lower(btrim(...)), so every
canonical answer here is lowercase and space-trimmed, and every prompt states
the exact submission format.

Run:  python scripts/gen-day7-webapps.py
Then apply the emitted migration (Supabase MCP), verify the rows, then deploy.
"""
import base64
import hashlib
import os
import random
import re
import textwrap
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DAY_DIR = os.path.join(ROOT, "public", "challenges", "day7")
MIG_DIR = os.path.join(ROOT, "supabase", "migrations")
os.makedirs(DAY_DIR, exist_ok=True)

# Deterministic output across runs (stable artifacts, stable diffs).
random.seed(20260712)

MASK32 = 0xFFFFFFFF

ANS = {}          # challenge_id -> canonical answer string
PROMPT = {}       # challenge_id -> prompt text
HINT = {}         # challenge_id -> hint text
META = {}         # challenge_id -> (title, category, difficulty, points, sort, is_extra, asset_file)


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def b64d(s: str) -> bytes:
    return base64.b64decode(s)


def b32(b: bytes) -> str:
    return base64.b32encode(b).decode()


def b32d(s: str) -> bytes:
    return base64.b32decode(s)


def rot13(s: str) -> str:
    out = []
    for ch in s:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - 97 + 13) % 26 + 97))
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - 65 + 13) % 26 + 65))
        else:
            out.append(ch)
    return "".join(out)


def write(fname: str, body: str):
    path = os.path.join(DAY_DIR, fname)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    print(f"  {fname:26s} {os.path.getsize(path):>7d} bytes")


def writeb(fname: str, data: bytes):
    path = os.path.join(DAY_DIR, fname)
    with open(path, "wb") as f:
        f.write(data)
    print(f"  {fname:26s} {os.path.getsize(path):>7d} bytes")


def register(cid, title, category, difficulty, points, sort, is_extra, asset_file, prompt, hint):
    META[cid] = (title, category, difficulty, points, sort, is_extra, asset_file)
    PROMPT[cid] = prompt
    HINT[cid] = hint


# ============================================================================
# EASY (4)
# ============================================================================

def e1_redirect_chain():
    cid = "d7_redirect_chain"
    ANS[cid] = "follow_the_redirects"
    payload = b64(ANS[cid].encode())

    # Build a redirect linked-list from /entry to a terminal 200, with decoy
    # routes (dead 404s) and one off-path loop. Only the true chain reaches 200.
    chain = ["/entry", "/a7", "/hop", "/q2", "/next", "/z9", "/step", "/k4",
             "/onward", "/m1", "/near", "/p8", "/almost", "/w3", "/final"]
    routes = {}
    for i in range(len(chain) - 1):
        routes[chain[i]] = ("302", chain[i + 1])
    routes[chain[-1]] = ("200", payload)
    # decoys
    routes["/trap"] = ("302", "/void")
    routes["/void"] = ("404", None)
    routes["/loopA"] = ("302", "/loopB")
    routes["/loopB"] = ("302", "/loopA")
    routes["/old"] = ("302", "/trap")
    routes["/mirror"] = ("302", "/old")

    order = list(routes.items())
    random.shuffle(order)
    lines = [
        "=====================================================================",
        " HTTP REDIRECT MAP  —  captured from a curl -sI crawl of api.acme.test",
        "=====================================================================",
        " Each line is one route's response. A 302 sends you to its Location;",
        " a 200 is the end of the road. Start at /entry, follow the Location",
        " headers, and read the body where you finally get a 200 OK.",
        " (Some routes are decoys — dead ends or loops. Ignore them.)",
        "",
        "  PATH            STATUS   LOCATION / BODY",
        "  --------------  ------   -----------------------------------------",
    ]
    for path, (status, target) in order:
        if status == "302":
            lines.append(f"  {path:14s}  302      Location: {target}")
        elif status == "404":
            lines.append(f"  {path:14s}  404      Not Found")
        else:
            lines.append(f"  {path:14s}  200      X-Flag-Data: {target}")
    lines += [
        "",
        "TASK: walk the redirect chain from /entry to the single 200 OK, then",
        "base64-decode its X-Flag-Data body. Submit the decoded plaintext.",
        "Answer format: lowercase, words joined by underscores.",
        "",
    ]
    write("redirect-map.txt", "\n".join(lines))

    # assert: follow the chain
    cur, seen = "/entry", set()
    while True:
        assert cur not in seen, "redirect loop on the intended path!"
        seen.add(cur)
        status, target = routes[cur]
        if status == "200":
            assert b64d(target).decode() == ANS[cid]
            break
        assert status == "302", "intended path hit a non-redirect"
        cur = target

    register(cid, "Redirect Roulette", "Web Logic", "easy", 150, 701, False,
             "redirect-map.txt",
             "[Logic puzzle — reading + a little scripting] A crawl of a web API dumped every route's "
             "response. Each 302 points to the next route via its Location header; exactly one route "
             "returns 200 OK and carries the prize in an X-Flag-Data header. Some routes are decoys "
             "(dead ends, loops). Start at /entry, follow the chain of redirects to the single 200, and "
             "base64-decode its body. Submit the decoded plaintext (lowercase, underscores).",
             "Treat it as a linked list: /entry -> its Location -> that route's Location -> ... until a "
             "200. Ignore /trap, /loop*, /old, /mirror. The 200 body is base64.")


def e2_base_soup():
    cid = "d7_base_soup"
    ANS[cid] = "layers_all_the_way_down"
    # ENCODE order (student peels in reverse): b64 -> rot13 -> b32 -> hex
    s = b64(ANS[cid].encode())
    s = rot13(s)
    s = b32(s.encode())
    blob = s.encode().hex()

    body = textwrap.dedent(f"""\
        =====================================================================
         ENCODING SOUP  —  one value, several wrappers, order unknown
        =====================================================================
        A support tool logged this "obfuscated" token:

            {blob}

        It was wrapped in FOUR layers, applied one after another:
            - base64
            - ROT13
            - base32
            - hexadecimal

        You are NOT told the order they were applied in — but each layer's
        alphabet gives it away as you peel:
            hex     = only 0-9 a-f
            base32  = only A-Z and 2-7 (often '=' padded)
            base64  = mixed case + / and '=' padding
            ROT13   = still looks like text, just letter-shifted

        TASK: peel all four layers to recover the plaintext underneath and
        submit it. Answer format: lowercase, words joined by underscores.
        """)
    write("encoding-soup.txt", body)

    # assert: peel hex -> b32 -> rot13 -> b64
    t = bytes.fromhex(blob).decode()
    t = b32d(t).decode()
    t = rot13(t)
    t = b64d(t).decode()
    assert t == ANS[cid]

    register(cid, "Encoding Soup", "Encoding", "easy", 150, 702, False,
             "encoding-soup.txt",
             "[Logic puzzle — encoding] A token was wrapped in four stacked encodings — base64, ROT13, "
             "base32 and hex — but the order isn't given. Each layer's alphabet reveals what it is, so "
             "peel them one at a time (a tool like CyberChef helps) until readable text falls out. Submit "
             "the plaintext (lowercase, underscores).",
             "The outermost layer here is hex (only 0-9a-f). Under it is base32 (A-Z, 2-7). Keep peeling: "
             "the next looks like shifted text (ROT13), and the last is base64.")


def e3_checksum_key():
    cid = "d7_checksum_key"
    # Rule: a key is authentic iff the sum of its 16 hex digits (each 0..15) is
    # divisible by 13. Generate 12 keys, exactly one valid; that key is the answer.
    def digit_sum(k):
        return sum(int(ch, 16) for ch in k)

    keys, valid = [], []
    while len(keys) < 12:
        k = "".join(random.choice("0123456789abcdef") for _ in range(16))
        ok = digit_sum(k) % 13 == 0
        if ok and len(valid) >= 1:
            continue  # keep exactly one valid
        if not ok and (len(keys) - len(valid)) >= 11:
            continue  # keep room for the single valid one
        keys.append(k)
        if ok:
            valid.append(k)
    # ensure exactly one valid exists
    if len(valid) == 0:
        # force one: tweak a key to hit sum % 13 == 0
        base = list(keys[0])
        while digit_sum("".join(base)) % 13 != 0:
            i = random.randrange(16)
            base[i] = random.choice("0123456789abcdef")
        keys[0] = "".join(base)
        valid = [keys[0]]
    random.shuffle(keys)
    ANS[cid] = valid[0]

    lines = [
        "=====================================================================",
        " API KEY VAULT  —  which key is authentic?",
        "=====================================================================",
        " A backup leaked 12 candidate API keys, but only ONE is genuine. The",
        " vendor's docs describe the integrity rule for a genuine key:",
        "",
        '     "A key is authentic if and only if the SUM of its 16 hexadecimal',
        '      digits — each digit read as a number 0-15 (a=10 ... f=15) — is',
        '      an exact multiple of 13."',
        "",
        "  #    candidate key",
        "  ---  ----------------",
    ]
    for i, k in enumerate(keys, 1):
        lines.append(f"  {i:>2}   {k}")
    lines += [
        "",
        "TASK: find the ONE key whose hex-digit sum is divisible by 13 and",
        "submit that key exactly as written (lowercase, 16 hex chars).",
        "",
    ]
    write("api-keys.txt", "\n".join(lines))

    passing = [k for k in keys if digit_sum(k) % 13 == 0]
    assert passing == [ANS[cid]], f"expected exactly one valid key, got {passing}"

    register(cid, "The Real Key", "Logic", "easy", 175, 703, False,
             "api-keys.txt",
             "[Logic puzzle — math] Twelve leaked API keys, exactly one authentic. The rule: a key is "
             "genuine iff the sum of its 16 hex digits (a=10 ... f=15) is divisible by 13. Compute the "
             "digit-sum of each key, find the single one that passes, and submit it exactly (lowercase, "
             "16 hex chars).",
             "For each key, map every character to a number (0-9, then a=10 ... f=15), add all 16 up, and "
             "check sum %% 13 == 0. Only one key satisfies it.")


def e4_regex_lock():
    cid = "d7_regex_lock"
    ANS[cid] = "d4rk_f0e_2026"
    rules = [
        (r"^[a-z0-9_]+$", "only lowercase letters, digits and underscores"),
        (r"^.{13}$", "exactly 13 characters long"),
        (r"[0-9].*[0-9].*[0-9].*[0-9]", "contains at least four digits"),
        (r"_.*_", "contains at least two underscores"),
        (r"^[^aeiou]*[aeiou][^aeiou]*$", "contains exactly one vowel (a,e,i,o,u)"),
    ]
    # candidates — each decoy breaks at least one rule; only the answer passes all
    candidates = [
        "d4rk_f0e_2026",   # answer: 13 chars, 6 digits, 2 underscores, exactly one vowel 'e'
        "d4rk_f0x_2026",   # zero vowels
        "dark_f0e_2026",   # two vowels (a,e)
        "d4rk_f0e_202",    # 12 chars
        "d4rk_f0e_20268",  # 14 chars
        "D4RK_F0E_2026",   # uppercase
        "d4rkf0e2026zz",   # no underscores
        "d4rk_f0e_2zzz",   # only 3 digits
        "d4rk_foe_2026",   # two vowels (o,e)
        "n1te_c0e_2026",   # two vowels (e,e)
    ]

    def matches_all(s):
        return all(re.search(p, s) for p, _ in rules)

    winners = [c for c in candidates if matches_all(c)]
    assert winners == [ANS[cid]], f"regex lock not unique: {winners}"

    lines = [
        "=====================================================================",
        " PASSWORD LOCK  —  five rules, one password",
        "=====================================================================",
        " Recovered password policy (ALL rules must hold). Exactly one of the",
        " candidates below satisfies every rule at once. Find it.",
        "",
        " RULES:",
    ]
    for i, (_, desc) in enumerate(rules, 1):
        lines.append(f"   {i}. {desc}")
    lines += ["", " CANDIDATES:"]
    for c in candidates:
        lines.append(f"   - {c}")
    lines += [
        "",
        "TASK: submit the single candidate that satisfies ALL five rules,",
        "exactly as written.",
        "",
    ]
    write("password-lock.txt", "\n".join(lines))

    register(cid, "Regex Lock", "Logic", "easy", 200, 704, False,
             "password-lock.txt",
             "[Logic puzzle — pattern matching] A password policy lists five rules; exactly one of the ten "
             "candidate passwords satisfies all of them simultaneously. Check each candidate against every "
             "rule (length, character classes, digit count, underscores, exactly one vowel) and submit the "
             "single one that passes them all.",
             "Go rule by rule and eliminate. Watch the two strict ones: exactly 13 characters, and exactly "
             "ONE vowel (a/e/i/o/u) in the whole string — those knock out almost everything.")


# ============================================================================
# MEDIUM (4)
# ============================================================================

def m1_cookie_lcg():
    cid = "d7_cookie_lcg"
    m = 1 << 32
    a = 1664525          # Numerical Recipes LCG (odd -> invertible mod 2^32)
    c = 1013904223
    # any seed works: with a odd and c odd, consecutive output diffs are always
    # odd (hence invertible mod 2^32). Chosen so the answer isn't a placeholder.
    seed = 0x9E3779B1
    def nxt(s):
        return (a * s + c) & MASK32
    # captured tokens = s1..s5 ; hidden previous token = s0 (the "admin" session)
    s0 = seed
    s1 = nxt(s0)
    toks = [s1]
    for _ in range(4):
        toks.append(nxt(toks[-1]))
    # ensure invertibility of (toks[1]-toks[0]) mod 2^32
    assert (toks[1] - toks[0]) & 1 == 1, "captured diff not odd; pick another seed"
    ANS[cid] = format(s0, "08x")

    body = textwrap.dedent(f"""\
        =====================================================================
         SESSION TOKEN ORACLE  —  a predictable "random" generator
        =====================================================================
        A web app issues each session a 32-bit token from a Linear Congruential
        Generator (LCG):

            token_next = (A * token_prev + C) mod 2^32

        The constants A and C are secret. You captured FIVE tokens that were
        handed out back-to-back, in order:

            t1 = {toks[0]}
            t2 = {toks[1]}
            t3 = {toks[2]}
            t4 = {toks[3]}
            t5 = {toks[4]}

        The administrator's session was the token issued IMMEDIATELY BEFORE t1
        (call it t0). Recover it.

        Method: with three consecutive outputs you can solve for A and C
            A = (t3 - t2) * inverse(t2 - t1)   (mod 2^32)
            C =  t2 - A * t1                    (mod 2^32)
        then step the generator BACKWARD once:
            t0 = (t1 - C) * inverse(A)          (mod 2^32)
        ("inverse" is the modular inverse mod 2^32; it exists because the
         numbers involved are odd.)

        TASK: submit t0 as 8 lowercase hexadecimal digits (no 0x prefix).
        """)
    write("session-tokens.txt", body)

    # assert full recovery from the public outputs only
    inv = lambda x: pow(x, -1, m)
    A = ((toks[2] - toks[1]) * inv((toks[1] - toks[0]) % m)) % m
    C = (toks[1] - A * toks[0]) % m
    assert A == a and C == c, "LCG params not recoverable as intended"
    t0 = ((toks[0] - C) * inv(A)) % m
    assert format(t0, "08x") == ANS[cid]

    register(cid, "Predictable Sessions", "Crypto / Logic", "medium", 275, 705, False,
             "session-tokens.txt",
             "[Logic puzzle — modular arithmetic] A site mints 32-bit session tokens with a Linear "
             "Congruential Generator, token_next = (A*token_prev + C) mod 2^32, with A and C secret. From "
             "five consecutive captured tokens, solve for A and C (modular inverse mod 2^32), then step the "
             "generator one step BACKWARD to recover the admin's previous token t0. Submit t0 as 8 lowercase "
             "hex digits.",
             "A = (t3-t2)*inv(t2-t1) mod 2^32, then C = t2 - A*t1. Step back: t0 = (t1-C)*inv(A) mod 2^32. "
             "In Python, inv(x) is pow(x,-1,2**32).")


def m2_state_cycle():
    cid = "d7_state_cycle"
    P = 65521            # prime modulus -> small state space (rho-shaped map)
    seed = 12345
    N = 10 ** 12

    def f(s):
        return (s * s + s + 1) % P

    def state_after(n, start):
        # cycle-collapse: find tail + cycle from `start`, then jump n steps.
        seen = {}
        s = start
        i = 0
        while s not in seen:
            seen[s] = i
            s = f(s)
            i += 1
        mu = seen[s]          # start of cycle (tail length)
        lam = i - mu          # cycle length
        if n < mu:
            # small n: just iterate (won't happen for N=10^12, kept for correctness)
            s = start
            for _ in range(n):
                s = f(s)
            return s
        # steps after entering the cycle
        rem = (n - mu) % lam
        s = start
        for _ in range(mu + rem):
            s = f(s)
        return s

    # method validation: for a modest N', formula must equal a direct simulation
    def direct(n, start):
        s = start
        for _ in range(n):
            s = f(s)
        return s
    for Np in (0, 1, 7, 5000, 200000):
        assert state_after(Np, seed) == direct(Np, seed), f"cycle method wrong at N={Np}"

    final = state_after(N, seed)
    ANS[cid] = str(final)

    body = textwrap.dedent(f"""\
        =====================================================================
         THE LONG LOOP  —  one trillion iterations (don't brute it)
        =====================================================================
        A device holds a 'register' updated by this deterministic step:

            register = (register*register + register + 1) mod 65521

        It starts at register = {seed} and the step is applied EXACTLY

            1,000,000,000,000   (one trillion) times.

        Simulating a trillion steps is hopeless. But the register can only ever
        hold one of 65521 values, so the sequence MUST eventually repeat — it
        falls into a cycle. Find the tail length and the cycle length starting
        from {seed}, then use modular arithmetic to jump a trillion steps in a
        fraction of a second.

        TASK: submit the register's value after exactly one trillion steps, as
        a plain decimal number.
        """)
    write("long-loop.txt", body)

    register(cid, "The Long Loop", "CS Logic", "medium", 300, 706, False,
             "long-loop.txt",
             "[Logic puzzle — cycle detection] A register is updated by register = (register^2 + register "
             "+ 1) mod 65521, starting at 12345, exactly one TRILLION times. Brute force is impossible, but "
             "the state space is only 65521 values, so the walk enters a cycle. Detect the tail length mu "
             "and cycle length lambda from the seed, then compute the state after (10^12) steps with "
             "modular arithmetic. Submit the final value as a decimal number.",
             "Iterate from the seed, recording the step index each state is first seen, until a state "
             "repeats: that gives mu (tail) and lambda (cycle). The answer state = iterate mu + ((10^12 - "
             "mu) mod lambda) steps from the seed.")


def m3_json_smuggle():
    cid = "d7_json_smuggle"
    ANS[cid] = "last_key_wins"
    admin_token = b64(ANS[cid].encode())
    user_token = b64(b"ordinary_user_nothing_here")

    body = textwrap.dedent(f"""\
        =====================================================================
         PARSER GAMES  —  two JSON parsers, one request, different answers
        =====================================================================
        An API sits behind a security gateway. BOTH read the same JSON body,
        but they use different libraries that disagree on DUPLICATE keys:

            * The GATEWAY (front) uses a parser that keeps the FIRST value of a
              duplicated key.
            * The BACKEND (app) uses a parser that keeps the LAST value.

        The gateway only forwards a request if it believes role == "user".
        The backend then acts on whatever role IT parsed, and echoes a token
        for that role.

        --- Captured request body ---
            {{
              "user": "guest",
              "role": "user",
              "action": "issue_token",
              "role": "admin"
            }}

        --- Backend response ---
            200 OK
            {{
              "issued_for": "<the role the BACKEND parsed>",
              "user_token":  "{user_token}",
              "admin_token": "{admin_token}"
            }}

        The gateway saw role="user" (first value) and let it through; the
        backend saw role="admin" (last value) and issued the admin token.

        TASK: work out which role the BACKEND acted on, base64-decode the token
        that matches that role, and submit the plaintext.
        Answer format: lowercase, words joined by underscores.
        """)
    write("parser-games.txt", body)

    assert b64d(admin_token).decode() == ANS[cid]
    assert b64d(user_token).decode() != ANS[cid]

    register(cid, "Parser Games", "Web Logic", "medium", 275, 707, False,
             "parser-games.txt",
             "[Logic puzzle — parser differential] A gateway and a backend parse the same JSON body with "
             "libraries that disagree on duplicate keys: the gateway keeps the FIRST value of a repeated "
             "key, the backend keeps the LAST. A request sends role twice — 'user' then 'admin'. Reason out "
             "which role the BACKEND acts on, then base64-decode the matching token from the response. "
             "Submit the plaintext (lowercase, underscores).",
             "The gateway allowed it because the FIRST role is 'user'. The backend keeps the LAST duplicate, "
             "so it acted as 'admin' — decode the admin_token.")


def m4_bitwise_safe():
    cid = "d7_bitwise_safe"
    ANS_INPUT = 0xC0FFEE42

    def rotl(x, r):
        return ((x << r) | (x >> (32 - r))) & MASK32

    def rotr(x, r):
        return ((x >> r) | (x << (32 - r))) & MASK32

    # forward op chain (all reversible)
    def forward(x):
        x ^= 0xDEADBEEF
        x = rotl(x, 7)
        x = (x + 0x01234567) & MASK32
        x ^= 0xA5A5A5A5
        x = rotr(x, 11)
        x = (x - 0x0BADF00D) & MASK32
        x ^= 0x0F0F0F0F
        return x

    def backward(y):
        y ^= 0x0F0F0F0F
        y = (y + 0x0BADF00D) & MASK32
        y = rotl(y, 11)
        y ^= 0xA5A5A5A5
        y = (y - 0x01234567) & MASK32
        y = rotr(y, 7)
        y ^= 0xDEADBEEF
        return y

    target = forward(ANS_INPUT)
    assert backward(target) == ANS_INPUT
    ANS[cid] = format(ANS_INPUT, "08x")

    body = textwrap.dedent(f"""\
        =====================================================================
         THE COMBINATION  —  reverse the bit-mixer to open the vault
        =====================================================================
        A vault takes a secret 32-bit INPUT, runs it through this fixed
        sequence of operations, and opens only if the result equals TARGET.
        All arithmetic is on unsigned 32-bit values (mask 0xffffffff).

            x = INPUT
            x = x XOR 0xDEADBEEF
            x = rotate_left(x, 7)
            x = (x + 0x01234567) mod 2^32
            x = x XOR 0xA5A5A5A5
            x = rotate_right(x, 11)
            x = (x - 0x0BADF00D) mod 2^32
            x = x XOR 0x0F0F0F0F
            OUTPUT = x

            TARGET = 0x{target:08x}

        Every step is reversible, so there is exactly ONE input that produces
        TARGET. Run the pipeline backwards (invert each op, in reverse order:
        XOR undoes itself, + undoes with -, rotate_left(r) undoes with
        rotate_right(r)).

        TASK: recover INPUT and submit it as 8 lowercase hexadecimal digits.
        """)
    write("bit-vault.txt", body)

    register(cid, "The Combination", "CS Logic", "medium", 300, 708, False,
             "bit-vault.txt",
             "[Logic puzzle — bitwise] A vault runs a secret 32-bit input through a fixed chain of "
             "reversible ops (XORs, 32-bit add/subtract, and bit rotations) and opens only when the result "
             "equals a given TARGET. Because every step is reversible there is exactly one input. Invert "
             "each operation and apply them in reverse order to recover it. Submit the input as 8 lowercase "
             "hex digits.",
             "Go bottom-up from TARGET: undo XOR with the same XOR, undo (+k) with (-k), and undo "
             "rotate_left(r) with rotate_right(r) (and vice-versa), all mod 2^32.")


# ============================================================================
# HARD (4) — serious web-app security
# ============================================================================

def h1_sqli_blind():
    cid = "d7_sqli_blind"
    ANS[cid] = "admin_db_pass_2026"
    secret = ANS[cid]

    # Generate a boolean-based blind SQLi transcript: for each char, binary
    # search over ASCII 32..126 using ASCII(substring) > N comparisons.
    lines = [
        "=====================================================================",
        " BLIND SQL INJECTION  —  boolean oracle transcript",
        "=====================================================================",
        " An attacker dumped a secret one character at a time through a",
        " boolean-blind injection. For each position they ran comparisons of",
        " the form:",
        "",
        "     ...' AND ASCII(SUBSTRING(secret,<pos>,1)) > <N> -- ",
        "",
        " and recorded whether the page came back TRUE (the injected condition",
        " held) or FALSE. Each position is a binary search over printable ASCII",
        " (32..126). Replay the search per position to nail each character, then",
        " read the secret across all positions.",
        "",
    ]

    def emit_char(pos, ch):
        target = ord(ch)
        lo, hi = 32, 126
        out = [f"  position {pos:>2}:"]
        # binary search using strictly-greater comparisons
        while lo < hi:
            mid = (lo + hi) // 2
            res = target > mid
            out.append(f"      ASCII(...) > {mid:>3}  ->  {'TRUE ' if res else 'FALSE'}")
            if res:
                lo = mid + 1
            else:
                hi = mid
        assert lo == target
        return out, lo

    recovered = []
    for i, ch in enumerate(secret, 1):
        block, val = emit_char(i, ch)
        recovered.append(chr(val))
        lines += block
        lines.append("")
    lines += [
        "TASK: reconstruct the secret from the per-position binary searches and",
        "submit it. Answer format: lowercase, words joined by underscores.",
        "",
    ]
    write("blind-sqli-log.txt", "\n".join(lines))

    assert "".join(recovered) == ANS[cid]

    register(cid, "Blind Oracle", "Web / SQLi", "hard", 375, 709, False,
             "blind-sqli-log.txt",
             "[Web exploitation — blind SQL injection] A boolean-blind SQL injection dumped a secret one "
             "character at a time. The transcript logs, per position, a binary search over printable ASCII "
             "using ASCII(SUBSTRING(secret,pos,1)) > N comparisons and their TRUE/FALSE results. Replay each "
             "position's binary search to pin down every character, then read the full secret. Submit it "
             "(lowercase, underscores).",
             "For one position: start with the range 32..126. TRUE for '> N' means the char is above N (set "
             "low = N+1); FALSE means it's N or below (set high = N). When the range collapses to a single "
             "value, that's the ASCII code of the character.")


def h2_smuggle():
    cid = "d7_smuggle"
    ANS[cid] = "session_stolen_by_desync"
    victim_cookie = b64(ANS[cid].encode())

    body = textwrap.dedent(f"""\
        =====================================================================
         HTTP REQUEST SMUGGLING (CL.TE DESYNC)  —  capture
        =====================================================================
        A front-end proxy and a back-end server disagreed on where one request
        ends: the front-end used Content-Length, the back-end used
        Transfer-Encoding: chunked. The attacker abused that "desync" so that a
        prefix they smuggled got PREPENDED to the next visitor's request, and
        the victim's own headers (including their session cookie) spilled into a
        place the attacker could read back.

        --- Attacker's request as the FRONT-END (Content-Length) saw it -------
        POST /search HTTP/1.1
        Host: shop.acme.test
        Content-Length: 118
        Transfer-Encoding: chunked

        0

        POST /comment HTTP/1.1
        Host: shop.acme.test
        Content-Type: application/x-www-form-urlencoded
        Content-Length: 320
        comment=

        --- ...but the BACK-END (chunked) stopped at the "0" chunk, so it held
            everything from "POST /comment" onward as the START of the NEXT
            request. The next visitor's real request was then appended: --------
        GET /account HTTP/1.1
        Host: shop.acme.test
        Cookie: session={victim_cookie}
        User-Agent: Mozilla/5.0

        --- What the attacker later read back from the stored comment ----------
        stored comment body began with:
            "POST /comment ... comment=GET /account HTTP/1.1 Host: shop.acme.test
             Cookie: session={victim_cookie} User-Agent: Mozilla/5.0"

        The victim's session cookie got captured inside the attacker's stored
        comment because of the desync.

        TASK: extract the victim's session cookie value from the smuggled data,
        base64-decode it, and submit the plaintext.
        Answer format: lowercase, words joined by underscores.
        """)
    write("smuggle-capture.txt", body)

    assert b64d(victim_cookie).decode() == ANS[cid]

    register(cid, "Desync", "Web / Smuggling", "hard", 400, 710, False,
             "smuggle-capture.txt",
             "[Web exploitation — HTTP request smuggling] A CL.TE desync between a front-end proxy "
             "(Content-Length) and a back-end (chunked) let an attacker prepend a smuggled prefix to the "
             "next visitor's request, capturing that victim's headers into a stored comment. Read the "
             "capture, understand where the victim's request got glued on, extract their session cookie, "
             "base64-decode it, and submit the plaintext (lowercase, underscores).",
             "The back-end treated the chunked body as ending at '0', so 'POST /comment...' started the "
             "next request and the victim's real 'GET /account' (with Cookie: session=...) got appended and "
             "stored. That session value is base64.")


def h3_ssti():
    cid = "d7_ssti"
    ANS[cid] = "server_side_template_pwn"
    secret_b64 = b64(ANS[cid].encode())

    # A tiny expression sandbox with a substring blocklist. Candidate payloads;
    # exactly one both passes the blocklist AND resolves to the secret.
    blocklist = ["__class__", "__globals__", "os", "system", "import", "eval",
                 "subprocess", "popen", "..", "base", "mro"]
    # Precomputed "what each payload would output if it ran" (as the artifact
    # shows). Only the intended payload avoids every blocked substring.
    payloads = [
        ("{{ config['SECRET'] }}", secret_b64, "resolves to the app SECRET (base64)"),
        ("{{ ''.__class__.__mro__[1] }}", "<blocked>", "uses __class__/mro"),
        ("{{ self.__globals__ }}", "<blocked>", "uses __globals__"),
        ("{{ os.environ }}", "<blocked>", "uses os"),
        ("{{ cycler.__init__.__globals__['os'] }}", "<blocked>", "uses __globals__/os"),
        ("{{ request.application }}", "<runtime error: not exposed>", "allowed but no secret"),
    ]

    def blocked(p):
        return any(b in p for b in blocklist)

    lines = [
        "=====================================================================",
        " SERVER-SIDE TEMPLATE INJECTION  —  filtered sandbox",
        "=====================================================================",
        " A page renders user input as a template expression: {{ ... }}. There",
        " is a naive blocklist filter — if the raw payload text contains ANY of",
        " these substrings, it is rejected before rendering:",
        "",
        "     " + ", ".join(blocklist),
        "",
        " The template context exposes a `config` dict (Flask-style) whose",
        " 'SECRET' entry holds a base64 value. Below is a probe table: each",
        " candidate payload and what it WOULD output if it were allowed to run.",
        "",
        "  PAYLOAD                                    OUTPUT (if it ran)",
        "  -----------------------------------------  ------------------------",
    ]
    for p, out, note in payloads:
        lines.append(f"  {p:41s}  {out}")
    lines += [
        "",
        " Exactly ONE payload (a) survives the blocklist AND (b) actually",
        " resolves to the SECRET. Find it, take its base64 output, decode it,",
        " and submit the plaintext.",
        " Answer format: lowercase, words joined by underscores.",
        "",
    ]
    write("ssti-sandbox.txt", "\n".join(lines))

    # assert exactly one payload is allowed AND yields the secret
    winners = [p for (p, out, _) in payloads if (not blocked(p)) and out == secret_b64]
    assert winners == ["{{ config['SECRET'] }}"], f"ssti not unique: {winners}"
    assert b64d(secret_b64).decode() == ANS[cid]

    register(cid, "Template Injection", "Web / SSTI", "hard", 400, 711, False,
             "ssti-sandbox.txt",
             "[Web exploitation — SSTI] A template renders user input as {{ ... }} behind a naive substring "
             "blocklist (__class__, __globals__, os, system, mro, ...). The context exposes a Flask-style "
             "config dict whose SECRET is base64. From the probe table, find the ONE payload that both "
             "survives the blocklist and resolves to the SECRET, decode its base64 output, and submit the "
             "plaintext (lowercase, underscores).",
             "The classic gadget chains (__class__.__mro__, __globals__, os.environ) all contain blocked "
             "substrings, so they're rejected. The direct config['SECRET'] access contains none of the "
             "blocked words and reads the SECRET straight out.")


def h4_proto_pollution():
    cid = "d7_proto_pollution"
    ANS[cid] = "prototype_pollution_pwned"
    admin_token = b64(ANS[cid].encode())

    body = textwrap.dedent(f"""\
        =====================================================================
         PROTOTYPE POLLUTION  —  Node.js merge gadget
        =====================================================================
        Vulnerable server code (Express, simplified):

            function merge(target, src) {{
              for (const k in src) {{
                if (k === "__proto__") continue;         // naive blocklist
                if (typeof src[k] === "object" && src[k]) {{
                  if (!target[k]) target[k] = {{}};
                  merge(target[k], src[k]);              // recursive
                }} else {{
                  target[k] = src[k];
                }}
              }}
            }}

            app.post("/api/prefs", (req, res) => {{
              const prefs = {{}};
              merge(prefs, req.body);                    // user-controlled body
              const u = {{ name: "guest" }};
              // later, a DIFFERENT object is checked for admin rights:
              if (u.isAdmin) {{
                res.json({{ ok: true, admin_token: "{admin_token}" }});
              }} else {{
                res.json({{ ok: true }});
              }}
            }});

        Two captured attacker attempts:

          Attempt 1 (blocked):
            POST /api/prefs   {{"__proto__": {{"isAdmin": true}}}}
            -> merge() skips the "__proto__" key, nothing polluted
            -> 200 {{"ok": true}}

          Attempt 2 (worked):
            POST /api/prefs   {{"constructor": {{"prototype": {{"isAdmin": true}}}}}}
            -> merge recurses through constructor.prototype, setting
               Object.prototype.isAdmin = true for EVERY object
            -> now u.isAdmin is true even though u was never touched
            -> 200 {{"ok": true, "admin_token": "{admin_token}"}}

        The top-level "__proto__" blocklist is bypassed via
        constructor.prototype, polluting Object.prototype so the unrelated `u`
        object inherits isAdmin = true and the admin branch leaks a token.

        TASK: take the admin_token from the attempt that WORKED, base64-decode
        it, and submit the plaintext.
        Answer format: lowercase, words joined by underscores.
        """)
    write("proto-pollution.txt", body)

    assert b64d(admin_token).decode() == ANS[cid]

    register(cid, "Polluted", "Web / Prototype Pollution", "hard", 425, 712, False,
             "proto-pollution.txt",
             "[Web exploitation — prototype pollution] A recursive Node merge() blocklists the top-level "
             "'__proto__' key but not 'constructor'. An attacker sends constructor.prototype.isAdmin=true, "
             "polluting Object.prototype so an unrelated object's isAdmin check passes and an admin token "
             "leaks. Identify the attempt that WORKED, base64-decode its admin_token, and submit the "
             "plaintext (lowercase, underscores).",
             "Attempt 1's '__proto__' is skipped by the blocklist. Attempt 2 reaches the prototype via "
             "constructor.prototype, so it's the one that leaks admin_token — decode that base64 value.")


# ============================================================================
# DANGER (3)
# ============================================================================

def d1_vm():
    cid = "d7_vm"
    ANS[cid] = "cust0m_vm_pwn3d"       # 15 chars
    flag = ANS[cid].encode()
    n = len(flag)

    # Per-byte reversible check: c ^= ks[i]; c = rotl8(c, r[i]); assert == ct[i]
    ks = [((i * 37 + 11) & 0xFF) for i in range(n)]
    rr = [((i * 3 + 1) % 7 + 1) for i in range(n)]  # rotate amount 1..7

    def rotl8(x, r):
        return ((x << r) | (x >> (8 - r))) & 0xFF

    def rotr8(x, r):
        return ((x >> r) | (x << (8 - r))) & 0xFF

    ct = []
    for i, ch in enumerate(flag):
        t = ch ^ ks[i]
        t = rotl8(t, rr[i])
        ct.append(t)

    # A tiny stack-VM disassembly the student must emulate. We present the opcode
    # spec + a per-index "program" as an assembly listing (data-driven), plus the
    # constants. Difficulty = correctly emulating custom semantics, then inverting.
    asm_lines = []
    for i in range(n):
        asm_lines.append(
            f"  idx {i:>2}:  LOADIN {i}    ; push input[{i}]\n"
            f"           XOR   0x{ks[i]:02x}   ; c ^= keystream[{i}]\n"
            f"           ROL   {rr[i]}      ; rotate-left 8-bit by {rr[i]}\n"
            f"           CMP   0x{ct[i]:02x}   ; must equal ciphertext[{i}]"
        )

    body = textwrap.dedent(f"""\
        =====================================================================
         THE MACHINE  —  reverse the custom VM's serial check   [DANGER]
        =====================================================================
        A licensing binary embeds a tiny STACK VM that validates a {n}-character
        serial. Below is the opcode spec and the full program (one block per
        input character). ACCEPT only if every CMP matches.

        OPCODES (all values are unsigned 8-bit; rotates are 8-bit rotates):
          LOADIN k   push the k-th input byte onto the stack
          XOR   v    pop a, push (a XOR v)
          ROL   r    pop a, push rotate_left8(a, r)
          ROR   r    pop a, push rotate_right8(a, r)
          ADD   v    pop a, push (a + v) mod 256
          CMP   v    pop a; if a != v the whole check FAILS

        PROGRAM (disassembly):
        {chr(10).join(asm_lines)}

        Each block computes:  rotate_left8( input[i] XOR XORKEY[i], ROLAMT[i] )
        and requires it to equal the block's CMP constant. Every step is
        reversible, so exactly one input passes. Invert each block:
            input[i] = rotate_right8( CMP[i], ROLAMT[i] ) XOR XORKEY[i]

        TASK: recover the {n}-character serial the VM accepts and submit it
        (it is printable ASCII; submit exactly as recovered).
        """)
    write("vm-serial.txt", body)

    # assert: emulate forward on the answer -> accept; and inversion reproduces it
    def emulate_accept(inp):
        if len(inp) != n:
            return False
        for i, ch in enumerate(inp):
            a = ch ^ ks[i]
            a = rotl8(a, rr[i])
            if a != ct[i]:
                return False
        return True
    assert emulate_accept(flag.decode().encode() if isinstance(flag, bytes) else flag)
    recovered = "".join(chr(rotr8(ct[i], rr[i]) ^ ks[i]) for i in range(n))
    assert recovered == ANS[cid]
    assert emulate_accept(recovered.encode())

    register(cid, "The Machine", "Reverse Engineering", "danger", 500, 713, True,
             "vm-serial.txt",
             "[DANGER — custom VM reversing] A licensing check runs inside a tiny custom stack VM. Given the "
             "opcode spec and the full disassembly, emulate its semantics to understand the per-character "
             "check — rotate_left8(input[i] XOR key[i], amt[i]) == ct[i] — then invert every block to "
             "recover the printable serial the VM accepts. Submit the serial exactly as recovered.",
             "Each block is reversible: input[i] = rotate_right8(CMP_constant[i], ROL_amount[i]) XOR "
             "XOR_key[i]. Rebuild all 15 characters and you have the serial.")


def d2_mtp():
    cid = "d7_mtp"
    ANS[cid] = "many_time_pad_broken"

    # Many-time pad: 12 English messages XOR'd with the SAME keystream. Recover
    # the keystream via the space-XOR statistical method, then read message 0
    # which contains the answer token.
    msgs = [
        "the quick brown fox jumps over the lazy dog while the sun sets slowly ok",
        "attack at dawn from the northern ridge and hold the line until reinforce",
        "never reuse a one time pad because key reuse leaks every message you send",
        "the secret phrase for tonight is many_time_pad_broken so do not tell them",
        "cryptography is only as strong as the discipline of the people using keyz",
        "meet me by the old clock tower at half past nine and bring the blue folder",
        "the password to the vault rotates weekly so memorize it and never write it",
        "our analyst confirmed the intercept was genuine and the source is reliable",
        "logistics reports the convoy departs monday morning via the coastal roadxx",
        "remember that xor is its own inverse which is exactly why this attack workz",
        "the weather over the channel is clearing so the flight window opens at sixx",
        "hold all transmissions until you receive the counter sign from headquarterz",
    ]
    L = min(len(m) for m in msgs)
    msgs = [m[:L] for m in msgs]
    target_idx = 3
    assert ANS[cid] in msgs[target_idx]

    # random keystream of length L
    ks = bytes(random.randrange(256) for _ in range(L))
    cts = []
    for m in msgs:
        ct = bytes(ord(m[i]) ^ ks[i] for i in range(L))
        cts.append(ct)

    lines = [
        "=====================================================================",
        " KEY REUSE  —  twelve messages, one keystream   [DANGER]",
        "=====================================================================",
        " Twelve plaintext messages (English, ASCII) were each XOR-encrypted",
        " with the SAME keystream — a many-time pad. That reuse is fatal:",
        " XOR-ing any two ciphertexts cancels the key and leaks the XOR of the",
        " two plaintexts. Because English is mostly lowercase letters and",
        " spaces, and (space XOR letter) flips a predictable bit, you can",
        " recover the keystream position-by-position (crib-dragging / the",
        " space-XOR method), then decrypt every message.",
        "",
        " Ciphertexts (hex), all the same length:",
        "",
    ]
    for i, ct in enumerate(cts):
        lines.append(f"  c{i:>2} = {ct.hex()}")
    lines += [
        "",
        " One of the decrypted messages contains a phrase of the form",
        " word_word_word_word. Recover the keystream, decrypt the messages,",
        " find that phrase, and submit it.",
        " Answer format: lowercase, words joined by underscores.",
        "",
    ]
    write("many-time-pad.txt", "\n".join(lines))

    # assert: recover the keystream by scoring ALL 256 candidate key bytes per
    # column (the robust crib-drag: the correct key makes every one of the 12
    # ciphertexts decrypt to text — space / lowercase / underscore — while any
    # wrong key produces non-text garbage in at least one message). This is what
    # a real solver does; it recovers the keystream exactly here.
    def col_ok(p):
        return p == 0x20 or 97 <= p <= 122 or p == ord("_")
    recovered_key = bytearray(L)
    for col in range(L):
        best_k, best_score = 0, -10 ** 9
        for k in range(256):
            score = 0
            for j in range(len(cts)):
                p = cts[j][col] ^ k
                if p == 0x20:
                    score += 3
                elif 97 <= p <= 122:
                    score += 2
                elif p == ord("_"):
                    score += 1
                else:
                    score -= 6
            if score > best_score:
                best_score, best_k = score, k
        recovered_key[col] = best_k
    dec = "".join(chr(cts[target_idx][i] ^ recovered_key[i]) for i in range(L))
    assert ANS[cid] in dec, f"MTP recovery failed; got: {dec!r}"

    register(cid, "Key Reuse", "Cryptanalysis", "danger", 525, 714, True,
             "many-time-pad.txt",
             "[DANGER — cryptanalysis] Twelve English messages were XOR-encrypted with the SAME keystream "
             "(a many-time pad). Key reuse is fatal: exploit it. Use the space-XOR / crib-dragging method "
             "across the twelve ciphertexts to recover the keystream column by column, decrypt the "
             "messages, and find the word_word_word_word phrase hidden in one of them. Submit that phrase "
             "(lowercase, underscores).",
             "Per column, try all 256 possible keystream bytes; keep the one that makes ALL twelve "
             "ciphertexts decrypt to plausible text (space / lowercase / underscore), scoring spaces "
             "highest. That reliably recovers the whole keystream; then XOR it into any ciphertext to read "
             "the message.")


def d3_z3():
    cid = "d7_z3"
    ANS[cid] = "z3_cracks_this!!"        # 16 chars, printable
    target = ANS[cid].encode()
    n = len(target)
    assert n == 16

    # Constraints, all satisfied by `target`, engineered so the solution is
    # unique. The XOR-chain pins bytes 1..15 given byte 0, collapsing the search
    # to 256 candidates for x0; extra constraints fix x0 to exactly one value.
    xk = [target[i] ^ target[i + 1] for i in range(n - 1)]     # chain deltas
    S = sum(target) & 0xFF                                      # byte sum mod 256
    prod = (target[2] * target[5]) & 0xFF                       # a nonlinear pin
    andc = (target[0] & 0x0F)                                   # low nibble of x0
    popc = bin(target[7]).count("1")                            # popcount pin

    lines = [
        "=====================================================================",
        " ONLY ONE SOLUTION  —  a 16-byte constraint system   [DANGER]",
        "=====================================================================",
        " Find the 16 unknown bytes x[0..15]. Every byte is printable ASCII",
        " (0x20..0x7e). The following constraints have exactly ONE solution;",
        " feed them to an SMT solver (Z3) — or notice that the XOR-chain pins",
        " every byte to x[0], leaving just 256 candidates to test.",
        "",
        " CONSTRAINTS (all arithmetic on bytes, mod 256 where relevant):",
        "",
    ]
    for i in range(n - 1):
        lines.append(f"   x[{i}] XOR x[{i+1}] == 0x{xk[i]:02x}")
    lines += [
        f"   (x[0] + x[1] + ... + x[15]) mod 256 == 0x{S:02x}",
        f"   (x[2] * x[5]) mod 256 == 0x{prod:02x}",
        f"   x[0] AND 0x0f == 0x{andc:02x}",
        f"   popcount(x[7]) == {popc}",
        "   every x[i] is printable ASCII (0x20 <= x[i] <= 0x7e)",
        "",
        " When solved, the 16 bytes are printable ASCII text. Submit that text",
        " exactly as recovered (it is the answer).",
        "",
    ]
    write("constraints.txt", "\n".join(lines))

    # assert uniqueness by brute-forcing x0 over all 256 values (the chain fixes
    # the rest), checking every constraint; exactly one printable solution.
    def solve():
        sols = []
        for x0 in range(256):
            xs = [x0]
            for i in range(n - 1):
                xs.append(xs[-1] ^ xk[i])
            if any(not (0x20 <= b <= 0x7e) for b in xs):
                continue
            if (sum(xs) & 0xFF) != S:
                continue
            if ((xs[2] * xs[5]) & 0xFF) != prod:
                continue
            if (xs[0] & 0x0F) != andc:
                continue
            if bin(xs[7]).count("1") != popc:
                continue
            sols.append(bytes(xs))
        return sols
    sols = solve()
    assert sols == [target], f"z3 constraint system not unique: {sols}"

    register(cid, "Only One Solution", "Constraint Solving", "danger", 550, 715, True,
             "constraints.txt",
             "[DANGER — constraint solving] A system of constraints over 16 unknown printable-ASCII bytes "
             "has exactly one solution: XOR-chain equalities linking consecutive bytes, a sum-mod-256 pin, "
             "a nonlinear product pin, an AND-mask on the low nibble, and a popcount pin. Model it in Z3 (or "
             "realize the XOR chain reduces it to 256 candidates for x[0]) to recover the 16 bytes, which "
             "spell printable text. Submit that text exactly.",
             "The XOR-chain fixes x[1..15] from x[0], so only 256 possibilities remain. Loop x[0] over "
             "0..255, derive the rest, keep the one that satisfies the sum, product, AND, popcount and "
             "printable constraints — its ASCII is the answer.")


# ============================================================================
# MIGRATION (upsert-only; never deletes a challenge row)
# ============================================================================

DAY = 7
DAY_TITLE = "🌐 Day 7 — Web Applications"
DAY_SUBTITLE = ("Logic & CS warm-ups (redirects, encodings, LCGs, cycle detection, bit ops) then serious "
                "web-app security: blind SQLi, request smuggling, SSTI, prototype pollution — and a DANGER "
                "zone (custom-VM reversing, many-time-pad cryptanalysis, a Z3 constraint system)")
DAY_CODE = "WEBHACK-2026"

ORDER = [
    "d7_redirect_chain", "d7_base_soup", "d7_checksum_key", "d7_regex_lock",
    "d7_cookie_lcg", "d7_state_cycle", "d7_json_smuggle", "d7_bitwise_safe",
    "d7_sqli_blind", "d7_smuggle", "d7_ssti", "d7_proto_pollution",
    "d7_vm", "d7_mtp", "d7_z3",
]


def build_migration():
    lines = []
    lines.append("-- Day 7 (Web Applications) — 15 per-player dynamic challenges.")
    lines.append("-- 4 easy + 4 medium logic/CS puzzles, 4 hard web-app-security challenges, and a")
    lines.append("-- 3-challenge DANGER zone (custom-VM reversing / many-time-pad / Z3 constraints).")
    lines.append("-- Generated by scripts/gen-day7-webapps.py. Artifacts live in public/challenges/day7/")
    lines.append("-- and contain NO flag string; verify_challenge_answer mints a per-player KGSP{...} flag")
    lines.append("-- only on a correct recovered answer, so pasting a prompt into an AI yields nothing.")
    lines.append("-- UPSERT-ONLY: never deletes a challenge row (see migrations/README.md rule #1), so")
    lines.append("-- re-applying is safe and preserves each row's per-deploy `secret`.")
    lines.append("-- Day 7 stays LOCKED (is_open=false) and code-gated (" + DAY_CODE + ") until go-live.")
    lines.append("begin;")
    lines.append("")
    lines.append("insert into public.days (day, title, subtitle, is_open, sort_order, is_rest, requires_code, is_completed)")
    lines.append(f"values ({DAY}, {sql_str(DAY_TITLE)},")
    lines.append(f"  {sql_str(DAY_SUBTITLE)},")
    lines.append(f"  false, {DAY}, false, true, false)")
    lines.append("on conflict (day) do update set title = excluded.title, subtitle = excluded.subtitle,")
    lines.append("  requires_code = true;")
    lines.append(f"insert into public.day_codes (day, code) values ({DAY}, {sql_str(DAY_CODE)}) on conflict (day) do nothing;")
    lines.append("")

    for cid in ORDER:
        title, cat, diff, pts, so, is_extra, asset_file = META[cid]
        bonus = 100 if diff == "danger" else 50
        penalty = 60 if diff == "danger" else 40
        asset_url = f"/challenges/day7/{asset_file}"
        action_url = f"/challenge/verify/{cid}"
        lines.append(
            "insert into public.challenges (id, title, category, difficulty, points, first_blood_bonus, "
            "sort_order, prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic) values (")
        lines.append(f"  {sql_str(cid)}, {sql_str(title)}, {sql_str(cat)}, {sql_str(diff)}, {pts}, {bonus}, {so},")
        lines.append(f"  {sql_str(PROMPT[cid])},")
        lines.append(f"  {sql_str(asset_url)}, {sql_str(action_url)}, 1, {DAY}, {str(is_extra).lower()}, true)")
        lines.append("on conflict (id) do update set title=excluded.title, category=excluded.category,")
        lines.append("  difficulty=excluded.difficulty, points=excluded.points, first_blood_bonus=excluded.first_blood_bonus,")
        lines.append("  sort_order=excluded.sort_order, prompt=excluded.prompt, asset_url=excluded.asset_url,")
        lines.append("  action_url=excluded.action_url, num_hints=excluded.num_hints, day=excluded.day,")
        lines.append("  is_extra=excluded.is_extra, is_dynamic=excluded.is_dynamic;")
        lines.append(
            "insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material) values ("
            f"{sql_str(cid)}, {sql_str(ANS[cid])}, encode(extensions.gen_random_bytes(16),'hex'), null)")
        lines.append("  on conflict (challenge_id) do update set answer = excluded.answer, live_material = excluded.live_material;")
        lines.append(
            "insert into public.challenge_hints (challenge_id, hint_number, body, penalty) values ("
            f"{sql_str(cid)}, 1, {sql_str(HINT[cid])}, {penalty})")
        lines.append("  on conflict (challenge_id, hint_number) do update set body = excluded.body, penalty = excluded.penalty;")
        lines.append("")

    lines.append("commit;")
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    path = os.path.join(MIG_DIR, f"{ts}_day7_webapps_challenges.sql")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    return path


if __name__ == "__main__":
    print("Building Day 7 artifacts:")
    e1_redirect_chain()
    e2_base_soup()
    e3_checksum_key()
    e4_regex_lock()
    m1_cookie_lcg()
    m2_state_cycle()
    m3_json_smuggle()
    m4_bitwise_safe()
    h1_sqli_blind()
    h2_smuggle()
    h3_ssti()
    h4_proto_pollution()
    d1_vm()
    d2_mtp()
    d3_z3()

    mig = build_migration()
    print("\nAll intended-solution asserts passed.")
    print("migration ->", os.path.relpath(mig, ROOT))
    print("\nAnswer map (instructor eyes only):")
    for cid in ORDER:
        t, cat, diff, pts, so, ie, af = META[cid]
        print(f"  {cid:22s} {diff:7s} {pts:>3}  {ANS[cid]}")
