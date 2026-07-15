# Day 9 — Blockchain: Instructor guide

> **Instructor / tester only. Do not share with students.**  
> Day code: **`BLOCKCHAIN-2026`** · **15 server-tracked labs** · all flags are personal.

## Scoring

Day 9 uses solve-order decay, not retroactive CTFd repricing:

- Every challenge starts at **500** base points.
- First solver: **500 + 25 first blood = 525**.
- Second solver: **500**.
- Third: **475**; fourth: **450**; then −25 per solver.
- Floor: **100** base points.
- A hint is deducted from that solver’s current base award; first blood remains a separate +25.
- Previous solves never change. Days 3–8 also stay on their existing static values.

This exactly matches Hussain’s `525 → 500 → 475 → 450` example. Standard CTFd
instead lowers the value for *everyone* whenever another player solves; that makes
scores move backwards during the event, so it is intentionally not used here.

## Quick key

| # | Challenge | Level | Stages | Final recovery receipt |
|---|-----------|-------|--------|------------------------|
| 1 | Block Autopsy | Easy | 3 | personal server receipt |
| 2 | Chain Stitch | Easy | 2 | personal server receipt |
| 3 | Honest Weight | Easy | 2 | personal server receipt |
| 4 | Nonce Forge | Medium | 2 | personal server receipt |
| 5 | Merkle Freight | Medium | 2 | personal server receipt |
| 6 | Change Address | Medium | 2 | personal server receipt |
| 7 | Replay Window | Medium | 3 | personal server receipt |
| 8 | Stake Jury | Medium | 2 | personal server receipt |
| 9 | Cold Chain | Medium | 3 | personal server receipt |
| 10 | Twin Signature | Hard | 2 | personal server receipt |
| 11 | Mempool Architect | Hard | 3 | personal server receipt |
| 12 | Quorum Vault | Hard | 3 | personal server receipt |
| 13 | Reorg Room | Danger | 3 | personal server receipt |
| 14 | Signature Siege | Danger | 3 | personal server receipt |
| 15 | Provenance Blackout | Danger | 4 | personal server receipt |

The lab returns a per-player receipt only after all stages pass. Submit that receipt
in the lab’s Answer box to mint the personal `KGSP{…}` flag, then submit the flag
in the arena modal.

## Easy

### 1 · Block Autopsy · `d9_block_autopsy`

Evidence: `block-autopsy-chain.json` + `block-autopsy-receipt.png`.

1. Recalculate each block’s recorded core. The first mismatch is block **`2`**.
2. The photographed receipt restores amount **`42`**, not the altered `420`.
3. Recalculate block 2 with amount 42, then seal the repaired fingerprint with
   the live `audit-9c` stamp (`fingerprint|audit-9c`). Prefix:
   **`407e7ea5be`**.

### 2 · Chain Stitch · `d9_chain_stitch`

Evidence: `loose-blocks.json`; live genesis anchor `d9-genesis-anchor-71`.

1. Correct order: **`G9>A3>K8>R2`**.
2. Seal the full R2 tip with the live genesis anchor
   (`tip fingerprint|d9-genesis-anchor-71`). Prefix: **`054447dcec`**.

### 3 · Honest Weight · `d9_honest_weight`

Evidence: `fork-room.json`.

1. Compare cumulative work, not block count: **`borealis`** wins with 18.
2. The fake identities share one resource commitment:
   **`P04,P07,P09`**.

## Medium

### 4 · Nonce Forge · `d9_nonce_forge`

1. The page gives a per-player header and a target prefix of `000`.
2. Search nonce values until the fingerprint of `header:nonce` begins with the
   target; submit the nonce, then its full fingerprint.

This is different for every player and is validated from the live header.

### 5 · Merkle Freight · `d9_merkle_freight`

Evidence: `freight-leaves.csv`; page identifies `LOT-7` and the live root.

1. Build the three-sibling branch for LOT-7:

   `R:a7f1fa9de192a734347ae94a1ea9100c0eeb124dd0be1d92221b3aa85836ddac|L:3901c4952d76e2a6e27893631c279e95b08f5fd271bdd31c3f0b90719f4fd0bc|L:2b8ed4184cdc4861ca6c1a27ee69037062c7b95c03db9d7a452794d72bcb789b`

2. Seal `root|LOT-7|freight-9a`; prefix: **`fe1b7289e2af`**.

### 6 · Change Address · `d9_utxo_change`

Evidence: `utxo-ledger.json`; live request asks Mira to pay vendor-9 eleven units.

1. Mira’s remaining unspent output is **`tx-c:1`** (value 15).
2. Valid spend plan with one-unit fee:
   **`vendor-9:11|change-7:3|fee:1`**.

### 7 · Replay Window · `d9_replay_window`

1. Issue the live voucher; record permit **`PERMIT-71`** and envelope **`ENV-A`**.
2. Submit `PERMIT-71@ENV-A` once.
3. Reuse the same permit inside a new envelope:
   **`PERMIT-71@ENV-B`**.

The relay incorrectly tracks envelope identity instead of the signed permit.

### 8 · Stake Jury · `d9_stake_jury`

Evidence: `validator-votes.csv`.

1. Validator **`V4`** signs both checkpoint values at one height.
2. Remove V4’s 17 stake. `V1,V2` provide 60 of the remaining 83, enough for the
   displayed two-thirds threshold. Submit **`V1,V2`**.

### 9 · Cold Chain · `d9_cold_chain`

Evidence: `cold-chain-telemetry.csv` + `container-seal.png`.

1. First broken reading: **`S3`**.
2. The photo/adjacent link restores **`4.8`**.
3. Seal `repaired row fingerprint|CX-204`; prefix: **`c570499b45`**.

## Hard

### 10 · Twin Signature · `d9_nonce_reuse`

Evidence A: `twin-signature-a.json`; signature B arrives on the live page.

1. Confirm the repeated `r`:
   **`000000000000000000000000000000000000009a3d77e18c4bfa22910d8e347a`**.
2. With curve order `n`, message integers `z1,z2`, and signatures `(r,s1)` /
   `(r,s2)`, recover:

   `k = (z1-z2) * (s1-s2)^-1 mod n`  
   `d = (s1*k-z1) * r^-1 mod n`

   Private scalar:
   **`0000000000000000000000000000000018d9c7112a47f3b65e44a81920b7d349`**.

### 11 · Mempool Architect · `d9_mempool_block`

Evidence: `mempool.csv`; live limit 1000 weight.

1. Best valid set: **`A,B,F,G`**.
2. One accepted dependency order: **`A>F>B>G`**.
3. Total fee and weight: **`5000:970`**.

The tempting standalone transaction C conflicts with F; B requires A and G
requires F.

### 12 · Quorum Vault · `d9_multisig_quorum`

Evidence: `quorum-envelopes.json` + `quorum-board.png`; live envelope `S-e`
belongs to K3 and is valid.

1. Forged envelope: **`S-c`**.
2. Three valid, non-revoked envelopes in key order:
   **`S-b>S-e>S-d`**.
3. Corresponding signers: **`K2,K3,K5`**.

## Danger

### 13 · Reorg Room · `d9_reorg_room`

Evidence: `reorg-room.zip`.

1. Accepted heavier branch: **`blue`**.
2. Rejected double-spend transaction from amber: **`tx-red`**.
3. Seal `b77e04f9a1|blue|reorg-9d`; prefix: **`de985b6eb0`**.

### 14 · Signature Siege · `d9_signature_siege`

Evidence: `bridge-envelope.json`; the second signature is live.

1. Recover the reused signing scalar:
   **`00000000000000000000000000000000000000029d9aa781fc642e31b780c119`**.
2. Identify the wrong replay-cache field: **`envelope_id`**.
3. Keep the authorization and change the wrapper to **`ENV-101`**.

### 15 · Provenance Blackout · `d9_provenance_blackout`

Evidence: `provenance-blackout.zip`; final customs nonce is personal/live.

1. Container from the photo: **`BX-771`**.
2. Impossible telemetry row: **`T3`**.
3. Honest weighted checkpoint: **`CP-B`**.
4. Final incident seal is the fingerprint of:
   `BX-771|T3|CP-B|<live personal nonce>`.

The fourth value cannot be prepared from the bundle or shared between players.

## Operations

- Keep Day 9 locked until the frontend and database migration are both live.
- Access code: `BLOCKCHAIN-2026`.
- Frontend: `src/challenges/day9/`.
- Artifacts: `public/challenges/day9/`.
- Generator: `scripts/gen-day9-blockchain.py`.
- Progress table is private (`day9_progress`, RLS on, no client SELECT policy).
- Resetting Day 9 through Admin also clears Day 9 progress; it never touches
  another day’s solves.

