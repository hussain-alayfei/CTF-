import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_verb_smuggle';

type LockFn = (method: string, override?: string) => Promise<void>;

export default function VerbSmuggleChallenge() {
  const { player } = useApp();
  const [msg, setMsg] = useState('Lock is engaged. Clear control is disabled in the UI.');
  const [word, setWord] = useState('');

  useEffect(() => {
    const callLock: LockFn = async (method, override) => {
      unlockAudio();
      playClick();
      const effective = (override || method).toUpperCase();
      if (effective === 'GET' || effective === 'POST') {
        setWord('');
        setMsg(`${method} → 403 Forbidden · clear not allowed with this verb.`);
        return;
      }
      if (effective !== 'DELETE') {
        setWord('');
        setMsg(`${effective} → 405 Method Not Allowed.`);
        return;
      }
      setMsg('DELETE → 200 · lock cleared.');
      if (!player) return;
      try {
        const mat = await fetchChallengeLiveMaterial(player, ID);
        if (!mat.ok || !mat.material) return;
        const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'DELETE');
        if (looksLikeToken(txt)) setWord(txt);
      } catch {
        setMsg('API error');
      }
    };

    (window as unknown as { __d8Lock: LockFn }).__d8Lock = callLock;
    return () => {
      delete (window as unknown as { __d8Lock?: LockFn }).__d8Lock;
    };
  }, [player]);

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Verb Smuggle"
      blurb="Clear Lock is disabled on the page. The API behind it accepts a different request style than the button uses. Clear the lock anyway."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-terminal-border px-4 py-2 text-sm opacity-40"
        >
          Clear lock (disabled)
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void (window as unknown as { __d8Lock: LockFn }).__d8Lock('GET')}
            className="rounded border border-terminal-border px-2 py-1 text-xs text-terminal-dim"
          >
            Probe GET /lock
          </button>
          <button
            type="button"
            onClick={() => void (window as unknown as { __d8Lock: LockFn }).__d8Lock('POST')}
            className="rounded border border-terminal-border px-2 py-1 text-xs text-terminal-dim"
          >
            Probe POST /lock
          </button>
        </div>
        <p className="text-xs text-terminal-dim">
          The page wires <code>window.__d8Lock(method, override?)</code> for manual probes. Try a
          DELETE, or POST with an override of DELETE.
        </p>
        {msg && <p className="text-xs text-terminal-amber">{msg}</p>}
        {word && (
          <p className="text-sm text-terminal-green">
            Opened: <code className="font-mono text-terminal-amber">{word}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
