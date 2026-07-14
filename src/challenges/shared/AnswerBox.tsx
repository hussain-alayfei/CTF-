import { useState } from 'react';
import { useApp } from '@/lib/app-context';
import { verifyChallengeAnswer } from '@/lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '@/lib/sounds';

/** Shared answer submit box for Day 7 live pages. */
export default function AnswerBox({ challengeId }: { challengeId: string }) {
  const { player } = useApp();
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, challengeId, answer.trim());
      setResult({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) playCorrect();
      else playWrong();
    } catch {
      setResult({ ok: false, message: 'Verification failed — try again.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 border-t border-terminal-border pt-4">
      <label className="block text-xs font-bold uppercase tracking-widest text-terminal-dim">Recovery token</label>
      <div className="mt-2 flex gap-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="what you recovered"
          className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-sm text-terminal-green outline-none focus:border-terminal-green"
        />
        <button
          type="submit"
          disabled={busy || !answer.trim()}
          className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green disabled:opacity-50"
        >
          {busy ? '…' : 'Submit'}
        </button>
      </div>
      {result && (
        <p className={`mt-3 text-sm ${result.ok ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {result.message}
          {result.flag && (
            <code className="mt-1 block break-all font-mono text-terminal-amber">{result.flag}</code>
          )}
        </p>
      )}
    </form>
  );
}
