-- Day 9 — Blockchain (15 multi-stage, server-tracked labs) and solve-order scoring.
-- Safe rollout:
--   * Day 9 was empty and has no solves.
--   * Existing challenges default to score_decay_step=0, so Days 3–8 are unchanged.
--   * Existing solves.points_awarded are never updated.
--   * Day 9 remains locked until the matching frontend is deployed.

alter table public.challenges
  add column if not exists score_decay_step integer not null default 0,
  add column if not exists score_minimum integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'challenges_score_decay_step_nonnegative'
       and conrelid = 'public.challenges'::regclass
  ) then
    alter table public.challenges
      add constraint challenges_score_decay_step_nonnegative check (score_decay_step >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'challenges_score_minimum_nonnegative'
       and conrelid = 'public.challenges'::regclass
  ) then
    alter table public.challenges
      add constraint challenges_score_minimum_nonnegative check (score_minimum >= 0);
  end if;
end
$$;

create table if not exists public.day9_progress (
  player_id uuid not null references public.players(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  stage integer not null default 0 check (stage >= 0),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, challenge_id)
);

alter table public.day9_progress enable row level security;

create index if not exists idx_day9_progress_challenge
  on public.day9_progress (challenge_id);

update public.days
   set title = '⛓ Day 9 — Blockchain',
       subtitle = 'Repair ledgers · weigh consensus · mine blocks · trace signatures · investigate forks.',
       is_open = false,
       requires_code = true
 where day = 9;

insert into public.day_codes (day, code)
values (9, 'BLOCKCHAIN-2026')
on conflict (day) do update set code = excluded.code;

insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus,
   score_decay_step, score_minimum, sort_order, prompt, asset_url,
   action_url, num_hints, day, is_extra, is_dynamic)
values
('d9_block_autopsy', 'Block Autopsy', 'Blockchain', 'easy', 500, 25, 25, 100, 901,
 'As you know, one changed transaction changes a block fingerprint and breaks every link that follows.

The academy ledger still carries its recorded fingerprints, but a photographed clinic receipt disagrees with one transfer. Find the earliest damaged block, restore the original amount, and prove the repaired link.

Goal: complete all three integrity checks in the live bench and recover your personal receipt.',
 '/challenges/day9/block-autopsy-chain.json', '/challenge/block-autopsy', 1, 9, false, true),

('d9_chain_stitch', 'Chain Stitch', 'Blockchain', 'easy', 500, 25, 25, 100, 902,
 'As you know, each block remembers the fingerprint of the block immediately before it.

Four recovered blocks were copied in the wrong order. The live recovery desk holds the trusted genesis anchor, while the download holds the loose blocks.

Goal: rebuild the only valid history and confirm its final tip.',
 '/challenges/day9/loose-blocks.json', '/challenge/chain-stitch', 1, 9, false, true),

('d9_honest_weight', 'Honest Weight', 'Blockchain', 'easy', 500, 25, 25, 100, 903,
 'As you know, a distributed network accepts the history backed by real committed resources, not simply the loudest list of identities.

Three forks arrived after a classroom partition. One is longest, one has the most names, and one carries the strongest commitment.

Goal: choose the defensible fork and expose the identities sharing one resource.',
 '/challenges/day9/fork-room.json', '/challenge/honest-weight', 1, 9, false, true),

('d9_nonce_forge', 'Nonce Forge', 'Blockchain', 'medium', 500, 25, 25, 100, 904,
 'As you know, mining changes a nonce until a block fingerprint falls beneath the network target.

The live bay creates a different header for every player. Individual guesses are allowed, but the target is intended to reward a small piece of automation and careful verification.

Goal: find a valid nonce for your header and commit its exact fingerprint.',
 null, '/challenge/nonce-forge', 1, 9, false, true),

('d9_merkle_freight', 'Merkle Freight', 'Blockchain', 'medium', 500, 25, 25, 100, 905,
 'As you know, a compact branch can prove that one receipt belongs to a large block without copying every transaction.

The freight file contains eight receipt leaves. The live terminal names the disputed lot and announces the trusted root, but withholds the branch.

Goal: build the ordered sibling branch and reproduce the trusted root.',
 '/challenges/day9/freight-leaves.csv', '/challenge/merkle-freight', 1, 9, false, true),

('d9_utxo_change', 'Change Address', 'Blockchain', 'medium', 500, 25, 25, 100, 906,
 'As you know, a wallet spends earlier outputs completely and creates new outputs for the payment, change, and fee.

The explorer export has no friendly spent labels. Trace Mira''s history, identify what remains spendable, then satisfy the live payment request without inventing value.

Goal: name the usable output and construct the balanced spend plan.',
 '/challenges/day9/utxo-ledger.json', '/challenge/change-address', 1, 9, false, true),

('d9_replay_window', 'Replay Window', 'Blockchain', 'medium', 500, 25, 25, 100, 907,
 'As you know, a valid digital signature proves authorization, but a service must also remember whether that authorization was already used.

This relay remembers the outer envelope instead of the signed voucher inside it. The live console lets you deliver the same authorization through more than one wrapper.

Goal: make the voucher settle twice and recover the relay receipt.',
 null, '/challenge/replay-window', 1, 9, false, true),

('d9_stake_jury', 'Stake Jury', 'Blockchain', 'medium', 500, 25, 25, 100, 908,
 'As you know, stake-backed consensus gives voting weight to locked value and punishes validators that sign conflicting histories.

The vote export captures one checkpoint dispute. Find the validator that supported both sides, remove its weight, and assemble an honest quorum from what remains.

Goal: submit the offender and the smallest accepted validator set.',
 '/challenges/day9/validator-votes.csv', '/challenge/stake-jury', 1, 9, false, true),

('d9_cold_chain', 'Cold Chain', 'Blockchain', 'medium', 500, 25, 25, 100, 909,
 'As you know, blockchain provenance is useful only when each physical reading still agrees with its signed history.

A vaccine container crossed four sensors. One visible temperature was rewritten after the row was sealed. The inspection photo and neighboring links preserve enough evidence to repair it.

Goal: locate the altered sensor, restore its reading, and reseal that row.',
 '/challenges/day9/cold-chain-telemetry.csv', '/challenge/cold-chain', 1, 9, false, true),

('d9_nonce_reuse', 'Twin Signature', 'Blockchain', 'hard', 500, 25, 25, 100, 910,
 'As you know, a wallet signature depends on both its private key and a fresh temporary secret.

Two different transfers from the same wallet accidentally reused that temporary value. One signature is in the download; the other appears only in your live instance.

Goal: prove the repeated component and recover the endangered wallet secret.',
 '/challenges/day9/twin-signature-a.json', '/challenge/twin-signature', 1, 9, false, true),

('d9_mempool_block', 'Mempool Architect', 'Blockchain', 'hard', 500, 25, 25, 100, 911,
 'As you know, miners cannot judge pending transactions independently when children depend on parents or two transactions spend the same output.

The candidate pool includes dependencies, conflicts, fees, and weights. The next block has a strict live capacity.

Goal: choose the highest-fee valid package, order it legally, and prove its totals.',
 '/challenges/day9/mempool.csv', '/challenge/mempool-architect', 1, 9, false, true),

('d9_multisig_quorum', 'Quorum Vault', 'Blockchain', 'hard', 500, 25, 25, 100, 912,
 'As you know, a shared wallet can require several independent signatures and can demand that witnesses follow the wallet''s key order.

The treasury bundle mixes one forgery, one revoked signer, and one live envelope. Enough honest signatures remain, but only one ordered witness satisfies policy.

Goal: reject the forgery, assemble the witness, and name its signers.',
 '/challenges/day9/quorum-envelopes.json', '/challenge/quorum-vault', 1, 9, false, true),

('d9_reorg_room', 'Reorg Room', 'Blockchain', 'danger', 500, 25, 25, 100, 913,
 'As you know, a temporary fork can reorganize transaction history when a later branch accumulates stronger work.

Three node snapshots captured two conflicting spends of one output. Peer count alone is not enough, and one transaction disappears when the heavier branch wins.

Goal: reconstruct the accepted branch, rejected spend, and final checkpoint.',
 '/challenges/day9/reorg-room.zip', '/challenge/reorg-room', 1, 9, false, true),

('d9_signature_siege', 'Signature Siege', 'Blockchain', 'danger', 500, 25, 25, 100, 914,
 'As you know, cryptographic authorization and replay protection are separate promises; breaking either can release value twice.

A bridge reused a signing secret and also indexed its replay cache by the wrong wrapper field. The downloaded envelope and live companion expose both mistakes.

Goal: recover the signing secret, identify the weak cache key, and replay the authorization through a fresh wrapper.',
 '/challenges/day9/bridge-envelope.json', '/challenge/signature-siege', 1, 9, false, true),

('d9_provenance_blackout', 'Provenance Blackout', 'Blockchain', 'danger', 500, 25, 25, 100, 915,
 'As you know, a trustworthy supply-chain record needs physical identity, untampered telemetry, and a valid consensus checkpoint at the same time.

After a port outage, the customs photo, sensor export, and validator map disagree. The final customs nonce exists only in your live incident room.

Goal: recover the container, isolate the forged reading, select the honest checkpoint, and seal the complete incident record.',
 '/challenges/day9/provenance-blackout.zip', '/challenge/provenance-blackout', 1, 9, false, true)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  difficulty = excluded.difficulty,
  points = excluded.points,
  first_blood_bonus = excluded.first_blood_bonus,
  score_decay_step = excluded.score_decay_step,
  score_minimum = excluded.score_minimum,
  sort_order = excluded.sort_order,
  prompt = excluded.prompt,
  asset_url = excluded.asset_url,
  action_url = excluded.action_url,
  num_hints = excluded.num_hints,
  day = excluded.day,
  is_extra = excluded.is_extra,
  is_dynamic = excluded.is_dynamic;

insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material)
values
('d9_block_autopsy', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_chain_stitch', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_honest_weight', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_nonce_forge', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_merkle_freight', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_utxo_change', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_replay_window', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_stake_jury', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_cold_chain', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_nonce_reuse', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_mempool_block', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_multisig_quorum', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_reorg_room', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_signature_siege', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null),
('d9_provenance_blackout', 'server_progress_required', encode(extensions.gen_random_bytes(32), 'hex'), null)
on conflict (challenge_id) do update set
  answer = excluded.answer,
  live_material = excluded.live_material;
-- Secret deliberately preserved on conflict.

insert into public.challenge_hints (challenge_id, hint_number, body, penalty)
values
('d9_block_autopsy', 1, 'Trust the earliest broken fingerprint, then use the physical receipt.', 25),
('d9_chain_stitch', 1, 'Every previous field should name exactly one other recovered fingerprint.', 25),
('d9_honest_weight', 1, 'Count committed weight, then look for identities sharing one commitment.', 25),
('d9_nonce_forge', 1, 'A repeatable search beats isolated guesses.', 50),
('d9_merkle_freight', 1, 'Direction matters at every level of the branch.', 50),
('d9_utxo_change', 1, 'An output is available only if no later input already consumed it.', 50),
('d9_replay_window', 1, 'Keep the signed inside unchanged; vary what the relay remembers.', 50),
('d9_stake_jury', 1, 'One validator appears twice at the same height.', 50),
('d9_cold_chain', 1, 'The first bad row is more useful than every broken row after it.', 50),
('d9_nonce_reuse', 1, 'Compare the two signature components before attacking the messages.', 75),
('d9_mempool_block', 1, 'Judge parent and child as one package, then remove conflicts.', 75),
('d9_multisig_quorum', 1, 'Validity, revocation, threshold, and key order are four separate checks.', 75),
('d9_reorg_room', 1, 'The accepted history follows accumulated work, not the loudest snapshot.', 100),
('d9_signature_siege', 1, 'The cryptographic failure opens the door; the cache field lets you reuse it.', 100),
('d9_provenance_blackout', 1, 'Resolve physical identity, telemetry, and consensus before making the final seal.', 100)
on conflict (challenge_id, hint_number) do update set
  body = excluded.body,
  penalty = excluded.penalty;

create or replace function public.d9_lab_step(
  p_player_id uuid,
  p_token uuid,
  p_challenge_id text,
  p_action text,
  p_input text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_stage integer;
  v_stage_count integer;
  v_state jsonb;
  v_secret text;
  v_seed text;
  v_header text;
  v_digest text;
  v_expected text;
  v_match boolean := false;
  v_task text;
  v_placeholder text := 'evidence';
  v_evidence jsonb := '{}'::jsonb;
  v_receipt text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_order text[];
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'auth', 'message', 'Session invalid — log in again.');
  end if;

  if not exists (
    select 1 from public.challenges c
    join public.days d on d.day = c.day
    where c.id = p_challenge_id and c.day = 9 and d.is_open
  ) then
    return jsonb_build_object('ok', false, 'error', 'locked', 'message', 'This lab is locked.');
  end if;

  select starts_at, ends_at into v_starts, v_ends
    from public.event_config where id = 1;
  if v_starts is null or now() < v_starts or (v_ends is not null and now() > v_ends) then
    return jsonb_build_object('ok', false, 'error', 'clock', 'message', 'The live round is not running.');
  end if;

  select secret into v_secret
    from public.challenge_answer_keys where challenge_id = p_challenge_id;
  if v_secret is null then
    return jsonb_build_object('ok', false, 'error', 'unknown', 'message', 'Unknown lab.');
  end if;

  v_stage_count := case p_challenge_id
    when 'd9_block_autopsy' then 3
    when 'd9_chain_stitch' then 2
    when 'd9_honest_weight' then 2
    when 'd9_nonce_forge' then 2
    when 'd9_merkle_freight' then 2
    when 'd9_utxo_change' then 2
    when 'd9_replay_window' then 3
    when 'd9_stake_jury' then 2
    when 'd9_cold_chain' then 3
    when 'd9_nonce_reuse' then 2
    when 'd9_mempool_block' then 3
    when 'd9_multisig_quorum' then 3
    when 'd9_reorg_room' then 3
    when 'd9_signature_siege' then 3
    when 'd9_provenance_blackout' then 4
    else 0
  end;
  if v_stage_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'unknown', 'message', 'Unknown lab.');
  end if;

  if lower(coalesce(p_action, '')) = 'reset' then
    delete from public.day9_progress
     where player_id = p_player_id and challenge_id = p_challenge_id;
  end if;

  insert into public.day9_progress (player_id, challenge_id)
  values (p_player_id, p_challenge_id)
  on conflict (player_id, challenge_id) do nothing;

  select stage, state into v_stage, v_state
    from public.day9_progress
   where player_id = p_player_id and challenge_id = p_challenge_id
   for update;

  v_seed := substr(encode(extensions.hmac(p_player_id::text, v_secret, 'sha256'), 'hex'), 1, 16);
  v_header := 'academy-block|' || v_seed || '|height:9';

  if lower(coalesce(p_action, '')) = 'submit' and v_stage < v_stage_count then
    v_expected := case
      when p_challenge_id = 'd9_block_autopsy' and v_stage = 0 then '2'
      when p_challenge_id = 'd9_block_autopsy' and v_stage = 1 then '42'
      when p_challenge_id = 'd9_block_autopsy' and v_stage = 2 then '407e7ea5be'
      when p_challenge_id = 'd9_chain_stitch' and v_stage = 0 then 'g9>a3>k8>r2'
      when p_challenge_id = 'd9_chain_stitch' and v_stage = 1 then '054447dcec'
      when p_challenge_id = 'd9_honest_weight' and v_stage = 0 then 'borealis'
      when p_challenge_id = 'd9_honest_weight' and v_stage = 1 then 'p04,p07,p09'
      when p_challenge_id = 'd9_merkle_freight' and v_stage = 0 then
        'r:a7f1fa9de192a734347ae94a1ea9100c0eeb124dd0be1d92221b3aa85836ddac|l:3901c4952d76e2a6e27893631c279e95b08f5fd271bdd31c3f0b90719f4fd0bc|l:2b8ed4184cdc4861ca6c1a27ee69037062c7b95c03db9d7a452794d72bcb789b'
      when p_challenge_id = 'd9_merkle_freight' and v_stage = 1 then 'fe1b7289e2af'
      when p_challenge_id = 'd9_utxo_change' and v_stage = 0 then 'tx-c:1'
      when p_challenge_id = 'd9_utxo_change' and v_stage = 1 then 'vendor-9:11|change-7:3|fee:1'
      when p_challenge_id = 'd9_replay_window' and v_stage = 0 then 'permit-71'
      when p_challenge_id = 'd9_replay_window' and v_stage = 1 then 'permit-71@env-a'
      when p_challenge_id = 'd9_replay_window' and v_stage = 2 then 'permit-71@env-b'
      when p_challenge_id = 'd9_stake_jury' and v_stage = 0 then 'v4'
      when p_challenge_id = 'd9_stake_jury' and v_stage = 1 then 'v1,v2'
      when p_challenge_id = 'd9_cold_chain' and v_stage = 0 then 's3'
      when p_challenge_id = 'd9_cold_chain' and v_stage = 1 then '4.8'
      when p_challenge_id = 'd9_cold_chain' and v_stage = 2 then 'c570499b45'
      when p_challenge_id = 'd9_nonce_reuse' and v_stage = 0 then
        '000000000000000000000000000000000000009a3d77e18c4bfa22910d8e347a'
      when p_challenge_id = 'd9_nonce_reuse' and v_stage = 1 then
        '0000000000000000000000000000000018d9c7112a47f3b65e44a81920b7d349'
      when p_challenge_id = 'd9_mempool_block' and v_stage = 0 then 'a,b,f,g'
      when p_challenge_id = 'd9_mempool_block' and v_stage = 1 then 'a>f>b>g'
      when p_challenge_id = 'd9_mempool_block' and v_stage = 2 then '5000:970'
      when p_challenge_id = 'd9_multisig_quorum' and v_stage = 0 then 's-c'
      when p_challenge_id = 'd9_multisig_quorum' and v_stage = 1 then 's-b>s-e>s-d'
      when p_challenge_id = 'd9_multisig_quorum' and v_stage = 2 then 'k2,k3,k5'
      when p_challenge_id = 'd9_reorg_room' and v_stage = 0 then 'blue'
      when p_challenge_id = 'd9_reorg_room' and v_stage = 1 then 'tx-red'
      when p_challenge_id = 'd9_reorg_room' and v_stage = 2 then 'de985b6eb0'
      when p_challenge_id = 'd9_signature_siege' and v_stage = 0 then
        '00000000000000000000000000000000000000029d9aa781fc642e31b780c119'
      when p_challenge_id = 'd9_signature_siege' and v_stage = 1 then 'envelope_id'
      when p_challenge_id = 'd9_signature_siege' and v_stage = 2 then 'env-101'
      when p_challenge_id = 'd9_provenance_blackout' and v_stage = 0 then 'bx-771'
      when p_challenge_id = 'd9_provenance_blackout' and v_stage = 1 then 't3'
      when p_challenge_id = 'd9_provenance_blackout' and v_stage = 2 then 'cp-b'
      when p_challenge_id = 'd9_provenance_blackout' and v_stage = 3 then
        encode(extensions.digest('BX-771|T3|CP-B|' || v_seed, 'sha256'), 'hex')
      else null
    end;

    if p_challenge_id = 'd9_nonce_forge' and v_stage = 0 then
      if btrim(coalesce(p_input, '')) ~ '^[0-9]{1,12}$' then
        v_digest := encode(extensions.digest(v_header || ':' || btrim(p_input), 'sha256'), 'hex');
        v_match := left(v_digest, 3) = '000';
      end if;
      if v_match then
        v_state := jsonb_build_object('nonce', btrim(p_input), 'digest', v_digest);
      end if;
    elsif p_challenge_id = 'd9_nonce_forge' and v_stage = 1 then
      v_match := lower(btrim(coalesce(p_input, ''))) = lower(coalesce(v_state->>'digest', ''));
    elsif p_challenge_id = 'd9_mempool_block' and v_stage = 1 then
      v_order := regexp_split_to_array(lower(regexp_replace(btrim(coalesce(p_input, '')), '\s+', '', 'g')), '>');
      v_match := cardinality(v_order) = 4
        and v_order @> array['a', 'b', 'f', 'g']::text[]
        and array_position(v_order, 'a') < array_position(v_order, 'b')
        and array_position(v_order, 'f') < array_position(v_order, 'g');
    else
      v_match := v_expected is not null
        and lower(btrim(coalesce(p_input, ''))) = lower(v_expected);
    end if;

    if not v_match then
      return jsonb_build_object(
        'ok', false,
        'stage', v_stage,
        'stage_count', v_stage_count,
        'message', 'That evidence does not close this stage.'
      );
    end if;

    v_stage := v_stage + 1;
    update public.day9_progress
       set stage = v_stage, state = v_state, updated_at = now()
     where player_id = p_player_id and challenge_id = p_challenge_id;
  end if;

  if v_stage >= v_stage_count then
    v_receipt := 'd9-' || substr(
      encode(extensions.hmac(p_player_id::text || ':' || p_challenge_id, v_secret, 'sha256'), 'hex'),
      1, 24
    );
    return jsonb_build_object(
      'ok', true,
      'complete', true,
      'stage', v_stage_count,
      'stage_count', v_stage_count,
      'token', v_receipt,
      'evidence', jsonb_build_object('case', p_challenge_id),
      'message', 'All stages verified. Your personal recovery receipt is ready.'
    );
  end if;

  if p_challenge_id = 'd9_block_autopsy' then
    if v_stage = 0 then
      v_task := 'Name the earliest block whose recorded fingerprint no longer matches its visible core.';
      v_placeholder := 'block index';
      v_evidence := jsonb_build_object('chain', '/challenges/day9/block-autopsy-chain.json');
    elsif v_stage = 1 then
      v_task := 'Restore the amount proven by the physical receipt.';
      v_placeholder := 'original amount';
      v_evidence := jsonb_build_object('inspection_photo', '/challenges/day9/block-autopsy-receipt.png');
    else
      v_task := 'Seal the repaired fingerprint with the live audit stamp and commit the first ten characters.';
      v_placeholder := '10 characters';
      v_evidence := jsonb_build_object(
        'canonical_core', 'index, previous, time, transaction, nonce',
        'audit_stamp', 'audit-9c',
        'seal_shape', 'repaired fingerprint|audit stamp'
      );
    end if;
  elsif p_challenge_id = 'd9_chain_stitch' then
    if v_stage = 0 then
      v_task := 'Commit the recovered block ids from genesis to tip.';
      v_placeholder := 'ID>ID>ID>ID';
      v_evidence := jsonb_build_object('genesis_anchor', 'd9-genesis-anchor-71', 'blocks', '/challenges/day9/loose-blocks.json');
    else
      v_task := 'Seal the final tip with the live genesis anchor and commit the first ten characters.';
      v_placeholder := 'seal prefix';
      v_evidence := jsonb_build_object(
        'accepted_order', 'now locked in',
        'seal_shape', 'tip fingerprint|genesis anchor'
      );
    end if;
  elsif p_challenge_id = 'd9_honest_weight' then
    if v_stage = 0 then
      v_task := 'Choose the fork backed by the strongest accumulated commitment.';
      v_placeholder := 'fork name';
    else
      v_task := 'List the identities sharing one resource commitment in ascending order.';
      v_placeholder := 'P00,P00,P00';
    end if;
    v_evidence := jsonb_build_object('fork_export', '/challenges/day9/fork-room.json');
  elsif p_challenge_id = 'd9_nonce_forge' then
    if v_stage = 0 then
      v_task := 'Find a numeric nonce whose full fingerprint begins with the target.';
      v_placeholder := 'nonce';
      v_evidence := jsonb_build_object('header', v_header, 'target_prefix', '000');
    else
      v_task := 'Commit the complete fingerprint produced by your accepted nonce.';
      v_placeholder := '64 characters';
      v_evidence := jsonb_build_object('accepted_nonce', v_state->>'nonce', 'header', v_header);
    end if;
  elsif p_challenge_id = 'd9_merkle_freight' then
    if v_stage = 0 then
      v_task := 'Commit the ordered sibling branch for the disputed receipt, preserving each direction.';
      v_placeholder := 'R:fingerprint|L:fingerprint|...';
    else
      v_task := 'Seal the proven root, target receipt, and live freight stamp; commit the first twelve characters.';
      v_placeholder := 'seal prefix';
    end if;
    v_evidence := jsonb_build_object(
      'target_receipt', 'LOT-7',
      'trusted_root', '19cb80477b6a3d5b2852e526df40e8801ab0fb8fbd0c4a67fb47ab635201b355',
      'freight_stamp', 'freight-9a',
      'seal_shape', 'root|receipt|stamp',
      'leaves', '/challenges/day9/freight-leaves.csv'
    );
  elsif p_challenge_id = 'd9_utxo_change' then
    if v_stage = 0 then
      v_task := 'Name Mira''s remaining unspent output.';
      v_placeholder := 'transaction:output';
    else
      v_task := 'Balance the live payment, change, and one-unit fee in the requested format.';
      v_placeholder := 'vendor-9:value|change-7:value|fee:value';
    end if;
    v_evidence := jsonb_build_object('payment', 'vendor-9 requests 11', 'ledger', '/challenges/day9/utxo-ledger.json');
  elsif p_challenge_id = 'd9_replay_window' then
    if v_stage = 0 then
      v_task := 'Commit the signed permit identifier shown by the relay.';
      v_placeholder := 'permit id';
    elsif v_stage = 1 then
      v_task := 'Settle the permit through its original envelope.';
      v_placeholder := 'permit@envelope';
    else
      v_task := 'Settle the same signed permit again through a different envelope.';
      v_placeholder := 'permit@new-envelope';
    end if;
    v_evidence := jsonb_build_object('permit', 'PERMIT-71', 'signed_value', '25 credits', 'envelope', 'ENV-A', 'available_wrapper', 'ENV-B');
  elsif p_challenge_id = 'd9_stake_jury' then
    if v_stage = 0 then
      v_task := 'Name the validator that signed both checkpoint values at one height.';
      v_placeholder := 'validator';
    else
      v_task := 'Commit the smallest listed honest set that clears two-thirds of remaining stake.';
      v_placeholder := 'V0,V0';
    end if;
    v_evidence := jsonb_build_object('votes', '/challenges/day9/validator-votes.csv', 'rule', 'remove equivocation stake before quorum');
  elsif p_challenge_id = 'd9_cold_chain' then
    if v_stage = 0 then
      v_task := 'Name the first sensor row whose visible core no longer matches its seal.';
      v_placeholder := 'sensor';
      v_evidence := jsonb_build_object('telemetry', '/challenges/day9/cold-chain-telemetry.csv');
    elsif v_stage = 1 then
      v_task := 'Restore the original temperature from the surviving physical and linked evidence.';
      v_placeholder := 'temperature';
      v_evidence := jsonb_build_object('inspection_photo', '/challenges/day9/container-seal.png', 'container', 'CX-204');
    else
      v_task := 'Seal the repaired row fingerprint with the physical container id and commit the first ten characters.';
      v_placeholder := '10 characters';
      v_evidence := jsonb_build_object(
        'canonical_core', 'container, sensor, temperature, minute, previous',
        'seal_shape', 'repaired fingerprint|container id'
      );
    end if;
  elsif p_challenge_id = 'd9_nonce_reuse' then
    if v_stage = 0 then
      v_task := 'Commit the complete signature component repeated in both transfers.';
      v_placeholder := '64 characters';
    else
      v_task := 'Recover and commit the wallet private scalar as 64 characters.';
      v_placeholder := 'private scalar';
    end if;
    v_evidence := jsonb_build_object(
      'signature_a', '/challenges/day9/twin-signature-a.json',
      'signature_b_message', 'pay archive 29',
      'signature_b_r', '000000000000000000000000000000000000009a3d77e18c4bfa22910d8e347a',
      'signature_b_s', '87f395f68192de3e40b9d66b2a7bf69dd4074d3d673c914ef7d01cfbf63dcf65',
      'curve_order', 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
    );
  elsif p_challenge_id = 'd9_mempool_block' then
    if v_stage = 0 then
      v_task := 'Commit the ids in the highest-fee valid set, sorted by id.';
      v_placeholder := 'A,B,C';
    elsif v_stage = 1 then
      v_task := 'Commit a legal block order that respects every dependency.';
      v_placeholder := 'A>B>C';
    else
      v_task := 'Commit total fee and total weight for the selected block.';
      v_placeholder := 'fee:weight';
    end if;
    v_evidence := jsonb_build_object('capacity', 1000, 'candidate_pool', '/challenges/day9/mempool.csv');
  elsif p_challenge_id = 'd9_multisig_quorum' then
    if v_stage = 0 then
      v_task := 'Name the forged signature envelope.';
      v_placeholder := 'envelope';
    elsif v_stage = 1 then
      v_task := 'Commit three accepted envelopes in the vault''s public-key order.';
      v_placeholder := 'S-a>S-b>S-c';
    else
      v_task := 'Commit the corresponding signer ids in key order.';
      v_placeholder := 'K0,K0,K0';
    end if;
    v_evidence := jsonb_build_object(
      'bundle', '/challenges/day9/quorum-envelopes.json',
      'policy_photo', '/challenges/day9/quorum-board.png',
      'live_envelope', 'S-e',
      'live_signer', 'K3',
      'live_check', 'valid'
    );
  elsif p_challenge_id = 'd9_reorg_room' then
    if v_stage = 0 then
      v_task := 'Name the branch the network ultimately accepts.';
      v_placeholder := 'branch';
    elsif v_stage = 1 then
      v_task := 'Name the conflicting transaction removed by the reorganization.';
      v_placeholder := 'transaction';
    else
      v_task := 'Seal accepted tip, branch, and live incident stamp; commit the first ten characters.';
      v_placeholder := 'seal prefix';
    end if;
    v_evidence := jsonb_build_object(
      'incident_bundle', '/challenges/day9/reorg-room.zip',
      'decision', 'accumulated commitment',
      'incident_stamp', 'reorg-9d',
      'seal_shape', 'tip|branch|stamp'
    );
  elsif p_challenge_id = 'd9_signature_siege' then
    if v_stage = 0 then
      v_task := 'Recover and commit the bridge signing scalar as 64 characters.';
      v_placeholder := 'private scalar';
    elsif v_stage = 1 then
      v_task := 'Name the wrapper field incorrectly used as the replay-cache key.';
      v_placeholder := 'field';
    else
      v_task := 'Commit the unused envelope id that replays the authorization.';
      v_placeholder := 'envelope';
    end if;
    v_evidence := jsonb_build_object(
      'envelope_a', '/challenges/day9/bridge-envelope.json',
      'envelope_b_message', 'bridge release 70',
      'envelope_b_r', '000000000000000000000000000000000000000000000000c93a71e5d4b2981f',
      'envelope_b_s', 'e42b58672982a1c172dc8e235d4f51a00bc73f247a50b6fbdf0a990d71ac7585',
      'curve_order', 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
      'unused_envelope', 'ENV-101'
    );
  elsif p_challenge_id = 'd9_provenance_blackout' then
    if v_stage = 0 then
      v_task := 'Recover the physical container id from the outage evidence.';
      v_placeholder := 'container';
    elsif v_stage = 1 then
      v_task := 'Name the telemetry row that cannot belong to the shipment history.';
      v_placeholder := 'sensor';
    elsif v_stage = 2 then
      v_task := 'Choose the checkpoint backed by an honest quorum.';
      v_placeholder := 'checkpoint';
    else
      v_task := 'Seal container, bad row, checkpoint, and your live nonce as one pipe-separated record; commit its full fingerprint.';
      v_placeholder := '64 characters';
    end if;
    v_evidence := jsonb_build_object(
      'incident_bundle', '/challenges/day9/provenance-blackout.zip',
      'personal_customs_nonce', v_seed,
      'record_shape', 'container|row|checkpoint|nonce'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'stage', v_stage,
    'stage_count', v_stage_count,
    'task', v_task,
    'placeholder', v_placeholder,
    'evidence', v_evidence,
    'message', case when lower(coalesce(p_action, '')) = 'submit'
      then 'Stage accepted. The next evidence is unlocked.'
      else 'Your live instance is ready.'
    end
  );
end;
$$;

create or replace function public.verify_challenge_answer(
  p_player_id uuid,
  p_token uuid,
  p_challenge_id text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_starts timestamptz;
  v_ends timestamptz;
  v_day integer;
  v_recent integer;
  v_answer text;
  v_secret text;
  v_flag text;
  v_correct boolean;
  v_stage integer;
  v_needed integer;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'message', 'Session invalid — please register again.');
  end if;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('ok', false, 'message', 'The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('ok', false, 'message', 'Time is up — the event has ended.');
  end if;
  select day into v_day from public.challenges where id = p_challenge_id;
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('ok', false, 'message', 'This challenge is locked right now.');
  end if;
  select count(*) into v_recent from public.submission_attempts
   where player_id = p_player_id and created_at > now() - interval '8 seconds';
  if v_recent >= 6 then
    return jsonb_build_object('ok', false, 'message', 'Too fast! Wait a moment and try again.');
  end if;

  select answer, secret into v_answer, v_secret
    from public.challenge_answer_keys where challenge_id = p_challenge_id;
  if v_answer is null then
    return jsonb_build_object('ok', false, 'message', 'Unknown challenge.');
  end if;

  if v_day = 9 then
    v_needed := case p_challenge_id
      when 'd9_block_autopsy' then 3 when 'd9_chain_stitch' then 2
      when 'd9_honest_weight' then 2 when 'd9_nonce_forge' then 2
      when 'd9_merkle_freight' then 2 when 'd9_utxo_change' then 2
      when 'd9_replay_window' then 3 when 'd9_stake_jury' then 2
      when 'd9_cold_chain' then 3 when 'd9_nonce_reuse' then 2
      when 'd9_mempool_block' then 3 when 'd9_multisig_quorum' then 3
      when 'd9_reorg_room' then 3 when 'd9_signature_siege' then 3
      when 'd9_provenance_blackout' then 4 else 999
    end;
    select stage into v_stage from public.day9_progress
     where player_id = p_player_id and challenge_id = p_challenge_id;
    v_answer := 'd9-' || substr(
      encode(extensions.hmac(p_player_id::text || ':' || p_challenge_id, v_secret, 'sha256'), 'hex'),
      1, 24
    );
    v_correct := coalesce(v_stage, 0) >= v_needed
      and lower(btrim(p_answer)) = lower(v_answer);
  else
    v_correct := lower(btrim(p_answer)) = lower(btrim(v_answer));
  end if;

  insert into public.submission_attempts (player_id, challenge_id, correct)
  values (p_player_id, p_challenge_id, v_correct);
  if not v_correct then
    return jsonb_build_object('ok', false, 'message', 'Not quite — check your work and try again.');
  end if;
  v_flag := 'KGSP{' || substr(
    encode(extensions.hmac(p_player_id::text, v_secret, 'sha256'), 'hex'),
    1, 12
  ) || '}';
  return jsonb_build_object(
    'ok', true,
    'message', 'Correct — here is your personal flag. Paste it into the arena flag box.',
    'flag', v_flag
  );
end;
$$;

create or replace function public.submit_flag(
  p_player_id uuid,
  p_token uuid,
  p_challenge_id text,
  p_flag text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_starts timestamptz;
  v_ends timestamptz;
  v_recent integer;
  v_flag text;
  v_day integer;
  v_points integer;
  v_bonus integer;
  v_decay integer;
  v_minimum integer;
  v_rank integer;
  v_base integer;
  v_correct boolean;
  v_first boolean;
  v_penalty integer;
  v_awarded integer;
  v_existing integer;
  v_total integer;
  v_ins integer;
  v_is_dynamic boolean;
  v_secret text;
  v_excluded boolean;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('error', 'auth', 'message', 'Session invalid - please register again.');
  end if;
  select coalesce(is_admin, false) or coalesce(exclude_from_board, false)
    into v_excluded from public.players where id = p_player_id;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('error', 'not_started', 'message', 'The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('error', 'ended', 'message', 'Time is up - the event has ended.');
  end if;
  select day, is_dynamic into v_day, v_is_dynamic
    from public.challenges where id = p_challenge_id;
  if v_day is null then
    return jsonb_build_object('error', 'no_challenge', 'message', 'Unknown challenge.');
  end if;
  if not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('error', 'locked', 'message', 'This challenge is locked right now.');
  end if;
  select count(*) into v_recent from public.submission_attempts
   where player_id = p_player_id and created_at > now() - interval '8 seconds';
  if v_recent >= 6 then
    return jsonb_build_object('error', 'rate_limited', 'message', 'Too fast! Wait a moment and try again.');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_challenge_id));

  if v_is_dynamic then
    select secret into v_secret
      from public.challenge_answer_keys where challenge_id = p_challenge_id;
    if v_secret is null then
      return jsonb_build_object('error', 'no_challenge', 'message', 'Unknown challenge.');
    end if;
    v_flag := 'KGSP{' || substr(
      encode(extensions.hmac(p_player_id::text, v_secret, 'sha256'), 'hex'),
      1, 12
    ) || '}';
  else
    select flag into v_flag from public.challenge_flags where challenge_id = p_challenge_id;
    if v_flag is null then
      return jsonb_build_object('error', 'no_challenge', 'message', 'Unknown challenge.');
    end if;
  end if;

  v_correct := lower(btrim(p_flag)) = lower(btrim(v_flag));
  insert into public.submission_attempts (player_id, challenge_id, correct)
  values (p_player_id, p_challenge_id, v_correct);

  if coalesce(v_excluded, false) then
    return jsonb_build_object(
      'correct', v_correct,
      'test_mode', true,
      'message', case when v_correct then 'Correct - test mode (not scored).'
                      else 'Not quite - check your work and try again.' end
    );
  end if;
  if not v_correct then
    return jsonb_build_object('correct', false, 'message', 'Not quite - check your work and try again.');
  end if;

  select points_awarded into v_existing from public.solves
   where player_id = p_player_id and challenge_id = p_challenge_id;
  if v_existing is not null then
    return jsonb_build_object(
      'correct', true, 'already_solved', true, 'points_awarded', v_existing,
      'message', 'You already solved this one'
    );
  end if;

  select points, first_blood_bonus, score_decay_step, score_minimum
    into v_points, v_bonus, v_decay, v_minimum
    from public.challenges where id = p_challenge_id;

  select count(*) + 1 into v_rank
    from public.solves s
    join public.players p on p.id = s.player_id
   where s.challenge_id = p_challenge_id
     and coalesce(p.is_admin, false) = false
     and coalesce(p.exclude_from_board, false) = false;

  v_first := not exists (
    select 1 from public.solves where challenge_id = p_challenge_id
  );
  if coalesce(v_decay, 0) > 0 then
    v_base := greatest(
      coalesce(v_minimum, 0),
      v_points - v_decay * greatest(v_rank - 2, 0)
    );
  else
    v_base := v_points;
  end if;

  select coalesce(sum(penalty), 0) into v_penalty
    from public.hint_unlocks
   where player_id = p_player_id and challenge_id = p_challenge_id;
  v_awarded := greatest(v_base - v_penalty, 0)
    + case when v_first then v_bonus else 0 end;

  insert into public.solves (player_id, challenge_id, points_awarded, is_first_blood)
  values (p_player_id, p_challenge_id, v_awarded, v_first)
  on conflict (player_id, challenge_id) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    select points_awarded into v_existing from public.solves
     where player_id = p_player_id and challenge_id = p_challenge_id;
    return jsonb_build_object(
      'correct', true, 'already_solved', true, 'points_awarded', coalesce(v_existing, 0)
    );
  end if;

  select coalesce(sum(points_awarded), 0) into v_total
    from public.solves where player_id = p_player_id;
  return jsonb_build_object(
    'correct', true,
    'first_blood', v_first,
    'solve_position', v_rank,
    'points_awarded', v_awarded,
    'total_points', v_total,
    'message', case when v_first then 'FIRST BLOOD! +' || v_awarded || ' points'
                    else 'Correct! +' || v_awarded || ' points' end
  );
end;
$$;

create or replace function public.admin_overview(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id = 1 and secret = p_secret) into v_ok;
  if not v_ok then
    return jsonb_build_object('error', 'auth', 'message', 'Wrong admin secret.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'event', (select to_jsonb(e) from (
      select name, starts_at, ends_at, duration_minutes, freeze_minutes, active_day, finale_stage
      from public.event_config where id = 1
    ) e),
    'players_count', (select count(*) from public.players where coalesce(is_admin, false) = false),
    'total_solves', (select count(*) from public.solves),
    'days', (
      select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order, d.day), '[]'::jsonb)
      from (
        select dd.day, dd.title, dd.subtitle, dd.is_open, dd.event_label, dd.sort_order,
               dd.is_rest, dd.requires_code, dd.is_completed, dc.code
        from public.days dd left join public.day_codes dc on dc.day = dd.day
      ) d
    ),
    'challenges', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.day, x.sort_order), '[]'::jsonb)
      from (
        select c.id, c.title, c.day, c.category, c.difficulty, c.points,
               c.first_blood_bonus, c.score_decay_step, c.score_minimum,
               c.sort_order, c.num_hints, c.prompt, c.asset_url, c.action_url,
               c.is_extra, c.suggested_tool, c.is_dynamic,
               coalesce(ak.answer, f.flag) as flag,
               (select count(*) from public.solves s where s.challenge_id = c.id) as solves_count,
               (select p.username
                  from public.solves s join public.players p on p.id = s.player_id
                 where s.challenge_id = c.id and s.is_first_blood limit 1) as first_blood_by,
               (select coalesce(
                  jsonb_agg(jsonb_build_object(
                    'n', h.hint_number, 'body', h.body, 'penalty', h.penalty
                  ) order by h.hint_number),
                  '[]'::jsonb
                ) from public.challenge_hints h where h.challenge_id = c.id) as hints
        from public.challenges c
        left join public.challenge_flags f on f.challenge_id = c.id
        left join public.challenge_answer_keys ak on ak.challenge_id = c.id
      ) x
    )
  );
end;
$$;

create or replace function public.admin_reset(p_secret text, p_day integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean;
begin
  select exists(select 1 from public.admin_config where id = 1 and secret = p_secret) into v_ok;
  if not v_ok then
    return jsonb_build_object('error', 'auth', 'message', 'Wrong admin secret.');
  end if;
  if p_day is null then
    return jsonb_build_object('error', 'no_day', 'message', 'No day specified — refusing to reset.');
  end if;
  delete from public.submission_attempts
   where challenge_id in (select id from public.challenges where day = p_day);
  delete from public.hint_unlocks
   where challenge_id in (select id from public.challenges where day = p_day);
  delete from public.solves
   where challenge_id in (select id from public.challenges where day = p_day);
  delete from public.day9_progress
   where challenge_id in (select id from public.challenges where day = p_day);
  update public.event_config
     set starts_at = null, ends_at = null, updated_at = now()
   where id = 1;
  return jsonb_build_object(
    'ok', true,
    'message', 'Day ' || p_day || ' reset. Players kept, other days'' scores untouched.'
  );
end;
$$;

