import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_method_gate';

export default function MethodGateChallenge() {
  const { player } = useApp();
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    unlockAudio();
    playClick();
    const method = (e.currentTarget.getAttribute('method') || 'get').toUpperCase();
    if (method !== 'POST') {
      setNote('');
      setMsg('405 Method Not Allowed — this gate refuses that style of request.');
      return;
    }
    setMsg('200 OK');
    if (!player) return;
    try {
      const mat = await fetchChallengeLiveMaterial(player, ID);
      if (!mat.ok || !mat.material) return;
      const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'POST');
      if (looksLikeToken(txt)) setNote(txt);
    } catch {
      setMsg('Gate error');
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Method Gate"
      blurb="A sealed note sits behind a picky gate. Ordinary page loads are not enough — the gate cares how you ask."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        {/* Intentionally GET — students must change the form method to POST */}
        <form method="get" onSubmit={(e) => void onSubmit(e)} className="space-y-2">
          <p className="text-terminal-dim">Request a sealed note from the gate.</p>
          <button
            type="submit"
            className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
          >
            Request note
          </button>
        </form>
        {msg && <p className="text-xs text-terminal-amber">{msg}</p>}
        {note && (
          <p className="text-sm text-terminal-green">
            Note: <code className="font-mono text-terminal-amber">{note}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
