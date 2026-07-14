import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';

const ID = 'd8_hashed_dossier';

/** Lab-only opaque map (not MD5 of 0/1). Shown partially on the live page. */
const PREFIX = 'd8r-';
function opaque(n: number) {
  // simple reversible lab encoding — looks opaque, not a famous hash of small ints
  const raw = `${n * 17 + 3}-kgsp`;
  return PREFIX + btoa(raw).replace(/=+$/, '');
}

const ME = 42;
const COUNSELOR = 7;

export default function HashedDossierChallenge() {
  const { player } = useApp();
  const [params, setParams] = useSearchParams();
  const myId = useMemo(() => opaque(ME), []);
  const counselorId = useMemo(() => opaque(COUNSELOR), []);
  const current = params.get('id') || myId;
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!params.get('id')) {
      setParams({ id: myId }, { replace: true });
    }
  }, [myId, params, setParams]);

  useEffect(() => {
    let alive = true;
    setNote('');
    if (current !== counselorId || !player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material) return;
        const txt = await xorDecryptHex(String(r.material.reveal_hex ?? ''), 'counselor');
        if (alive && looksLikeToken(txt)) setNote(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [current, counselorId, player]);

  const isMine = current === myId;
  const isCounselor = current === counselorId;

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Hashed Dossier"
      blurb="Your dossier opens with an opaque id. The portal only checks that you are logged in. Open the counselor’s dossier — not your own."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          Logged in as student #{ME}. My dossier id:{' '}
          <code className="break-all text-terminal-amber">{myId}</code>
        </p>
        <p className="text-xs text-terminal-dim">
          Staff roster leak (debug): counselor uses seat number <strong>{COUNSELOR}</strong> with
          the same desk encoder as students (prefix <code>d8r-</code>, then the packed seat
          formula <code>seat×17+3</code> tagged <code>-kgsp</code>).
        </p>
        <p>
          Viewing:{' '}
          <code className="break-all text-terminal-cyan">{current}</code>
        </p>
        {isMine && <p className="text-terminal-dim">Your own file · grades ordinary · nothing sealed.</p>}
        {isCounselor && note && (
          <p className="text-terminal-green">
            Counselor sealed note: <code className="font-mono text-terminal-amber">{note}</code>
          </p>
        )}
        {isCounselor && !note && <p className="text-xs text-terminal-dim">Loading sealed note…</p>}
        {!isMine && !isCounselor && (
          <p className="text-terminal-amber">Unknown dossier id · empty file.</p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
