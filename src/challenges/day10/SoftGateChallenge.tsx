import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_loose_equals';
/** Stored "hash" that PHP-style loose compare treats as numeric zero. */
const STORED = '0e830482052480';

function looseEquals(a: string, b: string): boolean {
  // Emulate weak numeric-string compare: 0e… digit strings both become 0.
  const weak = (s: string) => /^0e\d+$/i.test(s.trim());
  if (weak(a) && weak(b)) return true;
  return a == b;
}

/** Easy: soft login gate (type juggling style). */
export default function SoftGateChallenge() {
  const { player } = useApp();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [plaque, setPlaque] = useState('');

  async function tryLogin(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    playClick();
    setPlaque('');
    if (!looseEquals(pw, STORED)) {
      setMsg('Access denied.');
      return;
    }
    setMsg('Gate accepted a soft match.');
    if (!player) return;
    const r = await fetchChallengeLiveMaterial(player, ID);
    if (r.ok && r.material?.reveal_hex) {
      const txt = await xorDecryptHex(String(r.material.reveal_hex), '0e');
      if (looksLikeToken(txt)) setPlaque(txt);
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Soft Gate"
      blurb="The admin desk login compares your password with a stored mark using a loose rule. You do not need the real password — only a value the gate treats as the same."
    >
      <form onSubmit={tryLogin} className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
        <p className="text-xs text-terminal-dim">
          Stored verifier (debug leak): <code className="text-terminal-amber">{STORED}</code>
        </p>
        <label className="block text-xs font-bold uppercase tracking-widest text-terminal-dim">Password</label>
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-sm text-terminal-green outline-none focus:border-terminal-green"
          placeholder="try a soft twin"
        />
        <button
          type="submit"
          className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green"
        >
          Sign in
        </button>
        {msg && <p className="text-sm text-terminal-dim">{msg}</p>}
        {plaque && (
          <p className="text-sm text-terminal-green">
            Desk plaque: <code className="font-mono text-terminal-amber">{plaque}</code>
          </p>
        )}
      </form>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
