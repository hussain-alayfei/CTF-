import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_step_skip';

export default function StepSkipChallenge() {
  const { player } = useApp();
  const [draft, setDraft] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [msg, setMsg] = useState('');

  function startDraft() {
    unlockAudio();
    playClick();
    const id = `draft-${Math.floor(Math.random() * 9000 + 1000)}`;
    setDraft(id);
    setConfirmed(false);
    setReceipt('');
    setMsg(`Draft ${id} created. Confirm is required before execute — or is it?`);
  }

  function confirm() {
    unlockAudio();
    playClick();
    if (!draft) return;
    setConfirmed(true);
    setMsg('Confirm recorded. You may execute.');
  }

  async function execute() {
    unlockAudio();
    playClick();
    if (!draft) {
      setMsg('No draft.');
      return;
    }
    // Context bug: execute does not require confirmed === true
    setMsg(`Executing ${draft}…`);
    if (!player) return;
    try {
      const mat = await fetchChallengeLiveMaterial(player, ID);
      if (!mat.ok || !mat.material) return;
      const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'execute');
      if (looksLikeToken(txt)) setReceipt(txt);
    } catch {
      setMsg('Execute failed');
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Step Skip"
      blurb="Transfers need Confirm, then Execute. The Confirm button is slow on purpose. Reach success without finishing Confirm if the execute door forgets to wait."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startDraft}
            className="rounded-lg border border-terminal-border px-3 py-2 text-xs font-bold text-terminal-green"
          >
            1 · Create draft
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!draft}
            className="rounded-lg border border-terminal-border px-3 py-2 text-xs font-bold text-terminal-green disabled:opacity-40"
          >
            2 · Confirm {confirmed ? '✓' : ''}
          </button>
          <button
            type="button"
            onClick={() => void execute()}
            disabled={!draft}
            className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-3 py-2 text-xs font-bold text-terminal-cyan disabled:opacity-40"
          >
            3 · Execute
          </button>
        </div>
        {msg && <p className="text-xs text-terminal-dim">{msg}</p>}
        {receipt && (
          <p className="text-sm text-terminal-green">
            Receipt: <code className="font-mono text-terminal-amber">{receipt}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
