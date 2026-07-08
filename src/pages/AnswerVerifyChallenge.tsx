import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { fetchChallengeLiveMaterial, fetchChallenges, verifyChallengeAnswer } from '../lib/api';
import type { Challenge } from '../lib/types';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

const MATERIAL_LABELS: Record<string, string> = {
  key_hex: 'Key (hex)',
  iv_hex: 'IV (hex)',
  session_key_hex: 'Session key (hex)',
};

// Generic Day 4 challenge page: the player recovers an "answer" from a
// downloadable artifact (and, for some challenges, live-only material shown
// below) and submits it here. Nothing flag-shaped exists in this file, the
// artifact, or the database as a static string — verify_challenge_answer
// checks the answer server-side and mints a personal flag (HMAC of the
// player's own id) only on success, so it validates for no one else.
export default function AnswerVerifyChallenge() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const { player } = useApp();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [material, setMaterial] = useState<Record<string, string> | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  useEffect(() => {
    if (!challengeId) return;
    fetchChallenges()
      .then((list) => setChallenge(list.find((c) => c.id === challengeId) ?? null))
      .catch(() => setChallenge(null));
  }, [challengeId]);

  useEffect(() => {
    if (!challengeId || !player) return;
    fetchChallengeLiveMaterial(player, challengeId)
      .then((r) => {
        if (r.ok && r.material && Object.keys(r.material).length > 0) setMaterial(r.material);
      })
      .catch(() => {});
  }, [challengeId, player]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player || !challengeId) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, challengeId, answer.trim());
      setResult({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) playCorrect();
      else playWrong();
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Verification failed.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-terminal-dim">Log in from the arena first, then reopen this challenge.</p>
        <Link
          to={challengeId ? `/?c=${challengeId}` : '/'}
          className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted"
        >
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to={challengeId ? `/?c=${challengeId}` : '/'}
        className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
      >
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">{challenge?.title ?? 'Verify answer'}</h1>
        {challenge && (
          <p className="mt-1 text-[11px] uppercase tracking-widest text-terminal-dim">
            {challenge.category} · {challenge.difficulty} · {challenge.points} pts
          </p>
        )}

        {material && (
          <div className="mt-4 rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">
              Session material — not included in the download
            </div>
            <table className="mt-2 w-full text-left font-mono text-xs">
              <tbody>
                {Object.entries(material).map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-0.5 pr-3 text-terminal-dim">{MATERIAL_LABELS[k] ?? k}</td>
                    <td className="py-0.5 select-all text-terminal-green break-all">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="what you recovered"
            disabled={busy}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
          >
            {busy ? '…' : 'Verify ▸'}
          </button>
        </form>

        {result?.ok && result.flag && (
          <div className="mt-6 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Correct</div>
            <div className="mt-2 text-terminal-green">This flag is personal to your account:</div>
            <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
              {result.flag}
            </code>
            <p className="mt-3 text-xs text-terminal-dim">Paste it into the arena flag box to score.</p>
          </div>
        )}

        {result && !result.ok && (
          <div className="mt-6 rounded-lg border border-terminal-red/50 bg-terminal-red/10 p-4 text-center text-sm text-terminal-red">
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
