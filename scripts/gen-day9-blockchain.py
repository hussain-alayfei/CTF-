"""Generate Day 9 mixed blockchain evidence.

Artifacts deliberately contain evidence, never recovery tokens or flags. The
live lab supplies missing context and validates each stage server-side.
"""

from __future__ import annotations

import csv
import hashlib
import itertools
import json
import random
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "challenges" / "day9"
OUT.mkdir(parents=True, exist_ok=True)


def compact(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def fingerprint(value: object) -> str:
    return hashlib.sha256(compact(value).encode()).hexdigest()


def write_json(name: str, value: object) -> None:
    (OUT / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def make_photo(name: str, heading: str, lines: list[str], seed: int) -> None:
    rng = random.Random(seed)
    image = Image.new("RGB", (1080, 650), (24, 31, 39))
    draw = ImageDraw.Draw(image)
    for _ in range(130):
        x = rng.randrange(image.width)
        y = rng.randrange(image.height)
        shade = rng.randrange(28, 58)
        draw.ellipse((x, y, x + rng.randrange(2, 12), y + rng.randrange(2, 12)), fill=(shade, shade, shade))

    card = (105, 82, 975, 570)
    draw.rounded_rectangle(card, radius=24, fill=(221, 219, 202), outline=(127, 143, 141), width=5)
    font_big = ImageFont.truetype("arial.ttf", 54)
    font_mid = ImageFont.truetype("consola.ttf", 34)
    font_small = ImageFont.truetype("consola.ttf", 26)
    draw.text((150, 125), heading, font=font_big, fill=(18, 53, 59))
    draw.line((150, 205, 925, 205), fill=(76, 101, 99), width=3)
    y = 245
    for index, line in enumerate(lines):
        draw.text((155, y), line, font=font_mid if index == 0 else font_small, fill=(29, 40, 43))
        y += 70
    draw.text((740, 515), "FIELD COPY", font=font_small, fill=(143, 64, 50))
    image = image.filter(ImageFilter.GaussianBlur(0.35))
    image.save(OUT / name, optimize=True)


expected: dict[str, list[str]] = {}

# 1. Block Autopsy: hash the original chain, then alter one visible transaction.
blocks: list[dict[str, object]] = []
previous = "0" * 64
transactions = [
    {"from": "mint", "to": "lab-a", "amount": 90},
    {"from": "lab-a", "to": "lab-b", "amount": 12},
    {"from": "lab-b", "to": "clinic", "amount": 42},
    {"from": "clinic", "to": "archive", "amount": 8},
]
for index, tx in enumerate(transactions):
    core = {"index": index, "previous": previous, "time": f"09:0{index}:00Z", "transaction": tx, "nonce": 100 + index}
    block_hash = fingerprint(core)
    blocks.append({**core, "hash": block_hash})
    previous = block_hash
repaired_hash = blocks[2]["hash"]
blocks[2]["transaction"] = {"from": "lab-b", "to": "clinic", "amount": 420}
write_json("block-autopsy-chain.json", {"network": "academy-ledger-9", "blocks": blocks})
make_photo("block-autopsy-receipt.png", "CLINIC TRANSFER", ["AMOUNT  42", "FROM    LAB-B", "STATUS  ACCEPTED"], 9042)
audit_seal = hashlib.sha256(f"{repaired_hash}|audit-9c".encode()).hexdigest()
expected["d9_block_autopsy"] = ["2", "42", audit_seal[:10]]

# 2. Chain Stitch: shuffled blocks linked to a live genesis anchor.
loose: list[dict[str, object]] = []
previous = "d9-genesis-anchor-71"
for block_id, payload in [("G9", "open"), ("A3", "alpha"), ("K8", "kilo"), ("R2", "restore")]:
    core = {"id": block_id, "previous": previous, "payload": payload, "nonce": len(payload) * 17}
    block_hash = fingerprint(core)
    loose.append({**core, "hash": block_hash})
    previous = block_hash
write_json("loose-blocks.json", {"blocks": [loose[2], loose[0], loose[3], loose[1]]})
tip_seal = hashlib.sha256(f"{loose[-1]['hash']}|d9-genesis-anchor-71".encode()).hexdigest()
expected["d9_chain_stitch"] = ["G9>A3>K8>R2", tip_seal[:10]]

# 3. Honest Weight: neither longest nor largest identity count wins.
forks = {
    "genesis_anchor": "71a9",
    "forks": [
        {"name": "atlas", "blocks": 6, "work": [2, 2, 2, 2, 2, 2], "supporters": ["P01", "P02"]},
        {"name": "borealis", "blocks": 4, "work": [5, 5, 4, 4], "supporters": ["P03", "P05"]},
        {"name": "cinder", "blocks": 7, "work": [1, 1, 1, 1, 1, 1, 1], "supporters": ["P04", "P07", "P09"]},
    ],
    "resource_commitments": {
        "P01": "iron-31",
        "P02": "lime-82",
        "P03": "cyan-44",
        "P04": "violet-00",
        "P05": "gold-26",
        "P07": "violet-00",
        "P09": "violet-00",
    },
}
write_json("fork-room.json", forks)
expected["d9_honest_weight"] = ["borealis", "P04,P07,P09"]

# 5. Merkle Freight: the root/target are supplied by the live page.
receipts = [
    ("LOT-1", "rice", 18),
    ("LOT-2", "glass", 11),
    ("LOT-3", "paper", 27),
    ("LOT-4", "copper", 9),
    ("LOT-5", "water", 31),
    ("LOT-6", "linen", 14),
    ("LOT-7", "insulin", 6),
    ("LOT-8", "silicon", 22),
]
leaf_hashes = [hashlib.sha256(f"{a}|{b}|{c}".encode()).hexdigest() for a, b, c in receipts]
levels = [leaf_hashes]
while len(levels[-1]) > 1:
    current = levels[-1]
    levels.append(
        [hashlib.sha256(bytes.fromhex(current[i]) + bytes.fromhex(current[i + 1])).hexdigest() for i in range(0, len(current), 2)]
    )
with (OUT / "freight-leaves.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["receipt", "cargo", "crates", "leaf_fingerprint"])
    for row, digest in zip(receipts, leaf_hashes):
        writer.writerow([*row, digest])
target_index = 6
proof: list[str] = []
index = target_index
for level in levels[:-1]:
    sibling = index - 1 if index % 2 else index + 1
    proof.append(("L:" if index % 2 else "R:") + level[sibling])
    index //= 2
freight_seal = hashlib.sha256(f"{levels[-1][0]}|LOT-7|freight-9a".encode()).hexdigest()
expected["d9_merkle_freight"] = ["|".join(proof), freight_seal[:12]]

# 6. UTXO Change.
utxo = {
    "transactions": [
        {"id": "tx-a", "inputs": ["mint:0"], "outputs": [{"n": 0, "owner": "Mira", "value": 50}, {"n": 1, "owner": "Nora", "value": 20}]},
        {"id": "tx-b", "inputs": ["tx-a:0"], "outputs": [{"n": 0, "owner": "shop-2", "value": 19}, {"n": 1, "owner": "Mira", "value": 30}]},
        {"id": "tx-c", "inputs": ["tx-b:1", "tx-a:1"], "outputs": [{"n": 0, "owner": "clinic-4", "value": 34}, {"n": 1, "owner": "Mira", "value": 15}]},
        {"id": "tx-d", "inputs": ["tx-c:0"], "outputs": [{"n": 0, "owner": "archive-1", "value": 33}]},
    ]
}
write_json("utxo-ledger.json", utxo)
expected["d9_utxo_change"] = ["tx-c:1", "vendor-9:11|change-7:3|fee:1"]

# 8. Stake Jury.
votes = [
    ("V1", 32, "CP-81", "north"),
    ("V2", 28, "CP-81", "north"),
    ("V3", 23, "CP-81", "south"),
    ("V4", 17, "CP-81", "north"),
    ("V4", 17, "CP-81", "south"),
]
with (OUT / "validator-votes.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["validator", "stake", "height", "checkpoint"])
    writer.writerows(votes)
expected["d9_stake_jury"] = ["V4", "V1,V2"]

# 9. Cold Chain: preserve original fingerprints, then alter one row.
cold_rows: list[dict[str, object]] = []
previous = "5eal-204"
for sensor, temperature, minute in [("S1", 4.1, 0), ("S2", 4.4, 18), ("S3", 4.8, 37), ("S4", 4.6, 56)]:
    core = {"container": "CX-204", "sensor": sensor, "temperature": temperature, "minute": minute, "previous": previous}
    row_hash = fingerprint(core)
    cold_rows.append({**core, "fingerprint": row_hash})
    previous = row_hash
cold_repaired = cold_rows[2]["fingerprint"]
cold_rows[2]["temperature"] = 18.4
with (OUT / "cold-chain-telemetry.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(cold_rows[0].keys()))
    writer.writeheader()
    writer.writerows(cold_rows)
make_photo("container-seal.png", "CUSTOMS SEAL", ["CONTAINER  CX-204", "ROUTE      JED-RUH", "BAND       SEALED"], 9204)
cold_seal = hashlib.sha256(f"{cold_repaired}|CX-204".encode()).hexdigest()
expected["d9_cold_chain"] = ["S3", "4.8", cold_seal[:10]]

# 10. Twin Signature: two equations share r and the same temporary scalar.
curve_order = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
private_key = int("18d9c7112a47f3b65e44a81920b7d349", 16)
temporary = int("6f4e93c2a019d875b34f11", 16)
r_value = int("9a3d77e18c4bfa22910d8e347a", 16)
z1 = int.from_bytes(hashlib.sha256(b"pay clinic 17").digest(), "big")
z2 = int.from_bytes(hashlib.sha256(b"pay archive 29").digest(), "big")
s1 = ((z1 + r_value * private_key) * pow(temporary, -1, curve_order)) % curve_order
s2 = ((z2 + r_value * private_key) * pow(temporary, -1, curve_order)) % curve_order
write_json(
    "twin-signature-a.json",
    {"message": "pay clinic 17", "r": f"{r_value:064x}", "s": f"{s1:064x}", "wallet": "W9-ALPHA"},
)
expected["d9_nonce_reuse"] = [f"{r_value:064x}", f"{private_key:064x}"]

# 11. Mempool Architect: brute force the unique best valid package.
mempool = [
    {"id": "A", "weight": 300, "fee": 900, "parent": "", "conflict": ""},
    {"id": "B", "weight": 200, "fee": 1600, "parent": "A", "conflict": "H"},
    {"id": "C", "weight": 400, "fee": 1800, "parent": "", "conflict": "F"},
    {"id": "D", "weight": 250, "fee": 1300, "parent": "", "conflict": ""},
    {"id": "E", "weight": 150, "fee": 900, "parent": "D", "conflict": ""},
    {"id": "F", "weight": 350, "fee": 2100, "parent": "", "conflict": "C"},
    {"id": "G", "weight": 120, "fee": 400, "parent": "F", "conflict": ""},
    {"id": "H", "weight": 180, "fee": 700, "parent": "", "conflict": "B"},
]
with (OUT / "mempool.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=mempool[0].keys())
    writer.writeheader()
    writer.writerows(mempool)
by_id = {row["id"]: row for row in mempool}
valid_sets: list[tuple[int, int, tuple[str, ...]]] = []
for size in range(len(mempool) + 1):
    for ids in itertools.combinations(by_id, size):
        chosen = set(ids)
        if any(by_id[item]["parent"] and by_id[item]["parent"] not in chosen for item in chosen):
            continue
        if any(by_id[item]["conflict"] in chosen for item in chosen if by_id[item]["conflict"]):
            continue
        weight = sum(int(by_id[item]["weight"]) for item in chosen)
        if weight > 1000:
            continue
        valid_sets.append((sum(int(by_id[item]["fee"]) for item in chosen), weight, tuple(sorted(chosen))))
best_fee, best_weight, best_ids = max(valid_sets)
order = sorted(best_ids, key=lambda item: (0 if not by_id[item]["parent"] else 1, item))
expected["d9_mempool_block"] = [",".join(best_ids), ">".join(order), f"{best_fee}:{best_weight}"]

# 12. Quorum Vault.
write_json(
    "quorum-envelopes.json",
    {
        "policy": {"threshold": 3, "key_order": ["K1", "K2", "K3", "K4", "K5"], "revoked": ["K4"]},
        "envelopes": [
            {"id": "S-a", "signer": "K4", "check": "valid"},
            {"id": "S-b", "signer": "K2", "check": "valid"},
            {"id": "S-c", "signer": "K1", "check": "invalid"},
            {"id": "S-d", "signer": "K5", "check": "valid"},
        ],
    },
)
make_photo("quorum-board.png", "TREASURY QUORUM", ["K1  K2  K3  K4  K5", "THRESHOLD  3", "K4  REVOKED"], 9312)
expected["d9_multisig_quorum"] = ["S-c", "S-b>S-e>S-d", "K2,K3,K5"]

# 13. Reorg Room bundle.
node_a = {"node": "A", "branch": "amber", "cumulative_work": 18, "tip": "a91d77c204", "transactions": ["tx-blue", "tx-red"]}
node_b = {"node": "B", "branch": "blue", "cumulative_work": 25, "tip": "b77e04f9a1", "transactions": ["tx-blue", "tx-green"]}
node_c = {"node": "C", "branch": "blue", "cumulative_work": 25, "tip": "b77e04f9a1", "transactions": ["tx-blue", "tx-green"]}
for name, value in [("node-a.json", node_a), ("node-b.json", node_b), ("node-c.json", node_c)]:
    write_json(name, value)
with zipfile.ZipFile(OUT / "reorg-room.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ("node-a.json", "node-b.json", "node-c.json"):
        archive.write(OUT / name, arcname=name)
        (OUT / name).unlink()
    archive.writestr("shared-output.txt", "tx-red and tx-green both spend output O7:1\n")
reorg_seal = hashlib.sha256(b"b77e04f9a1|blue|reorg-9d").hexdigest()
expected["d9_reorg_room"] = ["blue", "tx-red", reorg_seal[:10]]

# 14. Signature Siege evidence (one half remains live).
siege_key = int("29d9aa781fc642e31b780c119", 16)
siege_k = int("775ce0a913", 16)
siege_r = int("c93a71e5d4b2981f", 16)
siege_z1 = int.from_bytes(hashlib.sha256(b"bridge release 7").digest(), "big")
siege_z2 = int.from_bytes(hashlib.sha256(b"bridge release 70").digest(), "big")
siege_s1 = ((siege_z1 + siege_r * siege_key) * pow(siege_k, -1, curve_order)) % curve_order
siege_s2 = ((siege_z2 + siege_r * siege_key) * pow(siege_k, -1, curve_order)) % curve_order
write_json(
    "bridge-envelope.json",
    {
        "envelope_id": "ENV-100",
        "message": "bridge release 7",
        "r": f"{siege_r:064x}",
        "s": f"{siege_s1:064x}",
        "replay_cache_key": "envelope_id",
    },
)
expected["d9_signature_siege"] = [f"{siege_key:064x}", "envelope_id", "ENV-101"]

# 15. Provenance Blackout bundle.
make_photo("blackout-customs.png", "OUTAGE ARRIVAL", ["CONTAINER  BX-771", "DOCK       4C", "SEAL       71-OMEGA"], 9771)
blackout_telemetry = [
    ["T1", "BX-771", "4.2", "north", "e1"],
    ["T2", "BX-771", "4.5", "east", "e2"],
    ["T3", "BX-771", "19.7", "east", "e3"],
    ["T4", "BX-771", "4.7", "dock", "e4"],
]
with (OUT / "blackout-telemetry.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["sensor", "container", "temperature", "zone", "entry"])
    writer.writerows(blackout_telemetry)
write_json(
    "blackout-validators.json",
    {
        "checkpoints": [
            {"id": "CP-A", "signers": [{"id": "Q1", "stake": 31}, {"id": "Q4", "stake": 9}]},
            {"id": "CP-B", "signers": [{"id": "Q1", "stake": 31}, {"id": "Q2", "stake": 27}, {"id": "Q3", "stake": 24}]},
        ],
        "quorum_needed": 67,
        "notice": "Q4 signed both checkpoints and is removed before counting.",
    },
)
with zipfile.ZipFile(OUT / "provenance-blackout.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ("blackout-customs.png", "blackout-telemetry.csv", "blackout-validators.json"):
        archive.write(OUT / name, arcname=name)
        (OUT / name).unlink()
expected["d9_provenance_blackout"] = ["BX-771", "T3", "CP-B", "<personal digest>"]

print(json.dumps(expected, indent=2))

