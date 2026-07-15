export type DayNineLab = {
  id: string;
  title: string;
  blurb: string;
  mode: 'chain' | 'network' | 'miner' | 'tree' | 'wallet' | 'jury' | 'freight' | 'incident';
  eyebrow: string;
};

export const DAY_NINE_LABS: Record<string, DayNineLab> = {
  d9_block_autopsy: {
    id: 'd9_block_autopsy',
    title: 'Block Autopsy',
    blurb:
      'A classroom ledger and its photographed receipt disagree. Find the first damaged block, restore the transaction, and prove the repaired link.',
    mode: 'chain',
    eyebrow: 'Integrity bench',
  },
  d9_chain_stitch: {
    id: 'd9_chain_stitch',
    title: 'Chain Stitch',
    blurb:
      'Four recovered blocks arrived out of order. Use their links and the live genesis anchor to rebuild the only valid history.',
    mode: 'chain',
    eyebrow: 'Recovery desk',
  },
  d9_honest_weight: {
    id: 'd9_honest_weight',
    title: 'Honest Weight',
    blurb:
      'Three forks claim to be the network truth. Length, identities, and actual committed work tell different stories.',
    mode: 'network',
    eyebrow: 'Consensus room',
  },
  d9_nonce_forge: {
    id: 'd9_nonce_forge',
    title: 'Nonce Forge',
    blurb:
      'Your personal block header needs a nonce whose fingerprint clears the live target. The instance changes for every player.',
    mode: 'miner',
    eyebrow: 'Mining bay',
  },
  d9_merkle_freight: {
    id: 'd9_merkle_freight',
    title: 'Merkle Freight',
    blurb:
      'A shipment receipt is missing from the full ledger export. Build the short branch that proves it belongs beneath the announced root.',
    mode: 'tree',
    eyebrow: 'Proof terminal',
  },
  d9_utxo_change: {
    id: 'd9_utxo_change',
    title: 'Change Address',
    blurb:
      'The explorer hides labels, but outputs still reveal what was spent, what remains, and which payment can actually be made.',
    mode: 'wallet',
    eyebrow: 'Transaction explorer',
  },
  d9_replay_window: {
    id: 'd9_replay_window',
    title: 'Replay Window',
    blurb:
      'A signed voucher should be accepted once. The relay remembers the envelope instead of the authorization inside it.',
    mode: 'wallet',
    eyebrow: 'Relay console',
  },
  d9_stake_jury: {
    id: 'd9_stake_jury',
    title: 'Stake Jury',
    blurb:
      'A validator signed both sides of the same checkpoint. Remove the dishonest weight, then rebuild a valid quorum.',
    mode: 'jury',
    eyebrow: 'Validator court',
  },
  d9_cold_chain: {
    id: 'd9_cold_chain',
    title: 'Cold Chain',
    blurb:
      'A vaccine shipment crossed four sensors. One reading was rewritten after signing and broke the provenance trail.',
    mode: 'freight',
    eyebrow: 'Supply-chain monitor',
  },
  d9_nonce_reuse: {
    id: 'd9_nonce_reuse',
    title: 'Twin Signature',
    blurb:
      'Two different transfers carry signatures with the same temporary fingerprint. Recover the wallet secret before the attacker does.',
    mode: 'wallet',
    eyebrow: 'Signature laboratory',
  },
  d9_mempool_block: {
    id: 'd9_mempool_block',
    title: 'Mempool Architect',
    blurb:
      'The next block has a strict weight limit. Dependencies, conflicts, and package fees decide the most valuable valid selection.',
    mode: 'miner',
    eyebrow: 'Block builder',
  },
  d9_multisig_quorum: {
    id: 'd9_multisig_quorum',
    title: 'Quorum Vault',
    blurb:
      'A shared treasury needs three approvals. One envelope is forged and the valid signatures must follow the vault’s key order.',
    mode: 'wallet',
    eyebrow: 'Multisignature desk',
  },
  d9_reorg_room: {
    id: 'd9_reorg_room',
    title: 'Reorg Room',
    blurb:
      'Three node snapshots captured a fork, a double spend, and a late heavier branch. Reconstruct what the network finally accepts.',
    mode: 'incident',
    eyebrow: 'Chain incident response',
  },
  d9_signature_siege: {
    id: 'd9_signature_siege',
    title: 'Signature Siege',
    blurb:
      'A bridge relay mixes a reused signing secret with weak replay tracking. Recover, forge, and close the unauthorized transfer path.',
    mode: 'incident',
    eyebrow: 'Bridge war room',
  },
  d9_provenance_blackout: {
    id: 'd9_provenance_blackout',
    title: 'Provenance Blackout',
    blurb:
      'A cold-chain ledger, validator map, and customs photo disagree after an outage. Recover the shipment’s defensible history.',
    mode: 'incident',
    eyebrow: 'Final investigation',
  },
};

