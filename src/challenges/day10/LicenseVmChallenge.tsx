import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_license_vm';

/**
 * Tiny VM: bytecode checks that each key char XORed with 0x1b equals target.
 * Targets encode "LATTICE9" — any key that satisfies the checker unlocks the plaque.
 */
const BYTECODE = [
  // LOAD_CHAR i, XOR 0x1b, CMP target[i], JNE fail — unrolled as data
  0x4c ^ 0x1b,
  0x41 ^ 0x1b,
  0x54 ^ 0x1b,
  0x54 ^ 0x1b,
  0x49 ^ 0x1b,
  0x43 ^ 0x1b,
  0x45 ^ 0x1b,
  0x39 ^ 0x1b,
];

function runVm(key: string): boolean {
  if (key.length !== BYTECODE.length) return false;
  for (let i = 0; i < BYTECODE.length; i++) {
    const got = key.charCodeAt(i) ^ 0x1b;
    if (got !== BYTECODE[i]) return false;
  }
  return true;
}

/** Hard: reverse a tiny license VM. */
export default function LicenseVmChallenge() {
  const { player } = useApp();
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [plaque, setPlaque] = useState('');

  useEffect(() => {
    /* noop */
  }, []);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    playClick();
    setPlaque('');
    if (!runVm(key)) {
      setMsg('Activation rejected by lattice checker.');
      return;
    }
    setMsg('License accepted.');
    if (!player) return;
    const r = await fetchChallengeLiveMaterial(player, ID);
    if (r.ok && r.material?.reveal_hex) {
      const txt = await xorDecryptHex(String(r.material.reveal_hex), 'lattice');
      if (looksLikeToken(txt)) setPlaque(txt);
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="License Lattice"
      blurb="The activation desk does not compare your key as plain text. A tiny instruction lattice transforms each character before checking. Recover a key the lattice accepts, then read the plaque."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-xs text-terminal-dim">Checker dump (targets after mixing each char with 0x1b):</p>
        <code className="mt-1 block break-all font-mono text-xs text-terminal-amber">
          [{BYTECODE.join(', ')}]
        </code>
        <p className="mt-2 text-xs text-terminal-dim">Length must match. Reverse the mix to recover each character.</p>
        <form onSubmit={activate} className="mt-3 flex gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
            placeholder="activation key"
          />
          <button
            type="submit"
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green"
          >
            Activate
          </button>
        </form>
        {msg && <p className="mt-2 text-sm text-terminal-dim">{msg}</p>}
        {plaque && (
          <p className="mt-2 text-sm text-terminal-green">
            Plaque: <code className="font-mono text-terminal-amber">{plaque}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
