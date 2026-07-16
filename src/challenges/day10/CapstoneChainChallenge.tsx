import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { d10LabStep, fetchChallengeLiveMaterial } from '@/lib/api';
import { artifactHref, looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_capstone_chain';

const STAGES = [
  { n: 0, title: 'Path', prompt: 'Name the leftover backup folder mark from the map drill.' },
  { n: 1, title: 'Album', prompt: 'Name the admin album seal.' },
  { n: 2, title: 'Stream', prompt: 'Name the overnight transfer tag.' },
  { n: 3, title: 'Gate', prompt: 'Submit the live gate mark from this desk.' },
];

/** Danger: 4 server-gated stages, evidence inside the lab. */
export default function CapstoneChainChallenge() {
  const { player } = useApp();
  const [stage, setStage] = useState(0);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [gate, setGate] = useState('');
  const [revealed, setRevealed] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setGate(String(r.material.gate ?? ''));
      })
      .catch(() => {});
    d10LabStep(player, ID, 'begin')
      .then((r) => {
        if (typeof r.stage === 'number') setStage(r.stage);
      })
      .catch(() => {});
  }, [player]);

  async function submitStage(e: React.FormEvent) {
    e.preventDefault();
    if (!player || busy) return;
    unlockAudio();
    playClick();
    setBusy(true);
    setMsg('');
    try {
      const r = await d10LabStep(player, ID, 'submit', input.trim());
      if (r.ok) {
        const next = typeof r.stage === 'number' ? r.stage : stage + 1;
        setStage(next);
        setInput('');
        setMsg(String(r.message ?? 'Stage cleared.'));
        if (r.done && r.material && typeof (r.material as { reveal_hex?: string }).reveal_hex === 'string') {
          const txt = await xorDecryptHex(String((r.material as { reveal_hex: string }).reveal_hex), 'closed');
          if (looksLikeToken(txt)) setRevealed(txt);
        } else if (next >= 4) {
          const mat = await fetchChallengeLiveMaterial(player, ID);
          if (mat.ok && mat.material?.reveal_hex) {
            const txt = await xorDecryptHex(String(mat.material.reveal_hex), 'closed');
            if (looksLikeToken(txt)) setRevealed(txt);
          }
        }
      } else {
        setMsg(String(r.message ?? 'Rejected.'));
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Step failed.');
    } finally {
      setBusy(false);
    }
  }

  const meta = STAGES[Math.min(stage, STAGES.length - 1)];
  const done = stage >= 4;

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Final Desk"
      blurb="Close the NovaTech incident in four gated steps. Evidence for early stages lives in today's other desks and the map file inside this lab. The last gate mark is only on this page."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <a
          href={artifactHref('capstone-map.txt')}
          download
          className="inline-block text-terminal-green underline decoration-dotted"
        >
          Download desk map
        </a>
        <p className="text-xs text-terminal-dim">
          Progress: stage {Math.min(stage, 4)} / 4
          {gate && stage >= 3 ? (
            <>
              {' · '}
              Live gate: <code className="text-terminal-amber">{gate}</code>
            </>
          ) : null}
        </p>
        {!done ? (
          <form onSubmit={submitStage} className="space-y-2">
            <p className="font-semibold text-terminal-green">
              {meta.title}: {meta.prompt}
            </p>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
                placeholder="stage answer"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green disabled:opacity-50"
              >
                {busy ? '…' : 'Advance'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-terminal-green">All four gates cleared.</p>
        )}
        {msg && <p className="text-xs text-terminal-dim">{msg}</p>}
        {revealed && (
          <p className="text-terminal-green">
            Final plaque: <code className="font-mono text-terminal-amber">{revealed}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
