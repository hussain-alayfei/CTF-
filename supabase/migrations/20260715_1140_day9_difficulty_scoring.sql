-- Correct Day 9 scoring to reflect challenge difficulty.
--
-- Researched CTF ranges commonly place Easy around 100–200, Medium around
-- 200–400, Hard around 400–600, with the top tier at roughly 500+.
-- Hussain's 500 → 525 first-blood example therefore belongs to Danger, not
-- every challenge.
--
-- Day 9 is locked and has zero solves. Existing solve rows are not touched.

update public.challenges as c
set points = v.points,
    first_blood_bonus = 25,
    score_decay_step = v.decay_step,
    score_minimum = v.minimum
from (
  values
    ('d9_block_autopsy',       100,  5,  50),
    ('d9_chain_stitch',        100,  5,  50),
    ('d9_honest_weight',       100,  5,  50),
    ('d9_nonce_forge',         250, 15, 125),
    ('d9_merkle_freight',      250, 15, 125),
    ('d9_utxo_change',         250, 15, 125),
    ('d9_replay_window',       250, 15, 125),
    ('d9_stake_jury',          250, 15, 125),
    ('d9_cold_chain',          250, 15, 125),
    ('d9_nonce_reuse',         400, 20, 200),
    ('d9_mempool_block',       400, 20, 200),
    ('d9_multisig_quorum',     400, 20, 200),
    ('d9_reorg_room',          500, 25, 250),
    ('d9_signature_siege',     500, 25, 250),
    ('d9_provenance_blackout', 500, 25, 250)
) as v(id, points, decay_step, minimum)
where c.id = v.id
  and c.day = 9;

