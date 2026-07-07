import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Challenge, HintResult, Player } from '../lib/types';
import type { EventStatus } from '../lib/time';
import { submitFlag, unlockHint } from '../lib/api';
import { playClick, playCorrect, playHint, playWrong, unlockAudio } from '../lib/sounds';
import Prompt from './Prompt';

// Keep unlocked hints for the session so re-opening a challenge keeps them.
const hintCache = new Map<string, Map<number, HintResult>>();

function getCache(id: string): Map<number, HintResult> {
  let m = hintCache.get(id);
  if (!m) {
    m = new Map();
    hintCache.set(id, m);
  }
  return m;
}

type Feedback = { kind: 'ok' | 'bad' | 'info'; text: string } | null;

export default function ChallengeModal({
  challenge,
  player,
  solved,
  firstBloodBy,
  eventStatus,
  onClose,
  onSolved,
}: {
  challenge: Challenge;
  player: Player;
  solved: boolean;
  firstBloodBy?: string;
  eventStatus: EventStatus;
  onClose: () => void;
  onSolved: () => void;
}) {
  const [flag, setFlag] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hints, setHints] = useState<Map<number, HintResult>>(() => new Map(getCache(challenge.id)));

  const running = eventStatus === 'running';

  async function onUnlock(n: number) {
    unlockAudio();
    playClick();
    try {
      const res = await unlockHint(player, challenge.id, n);
      if (res.error) {
        setFeedback({ kind: 'info', text: res.message ?? 'Could not unlock hint.' });
        return;
      }
      const cache = getCache(challenge.id);
      cache.set(n, res);
      setHints(new Map(cache));
      playHint();
    } catch (e) {
      setFeedback({ kind: 'bad', text: e instanceof Error ? e.message : 'Error unlocking hint.' });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    if (!flag.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await submitFlag(player, challenge.id, flag);
      if (res.error) {
        setFeedback({ kind: 'info', text: res.message ?? 'Submission blocked.' });
        playWrong();
      } else if (res.correct && res.already_solved) {
        setFeedback({ kind: 'info', text: 'You already solved this one ✅' });
        onSolved();
      } else if (res.correct) {
        setFeedback({ kind: 'ok', text: res.message ?? 'Correct!' });
        setFlag('');
        // First-blood siren is played by the live announcement feed for everyone.
        if (!res.first_blood) playCorrect();
        onSolved();
      } else {
        setFeedback({ kind: 'bad', text: res.message ?? 'Not quite — try again.' });
        playWrong();
      }
    } catch (err) {
      setFeedback({ kind: 'bad', text: err instanceof Error ? err.message : 'Submit failed.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl animate-pop rounded-xl border border-terminal-border bg-terminal-panel shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-terminal-border p-5">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-widest text-terminal-dim">
              <span>{challenge.category}</span>
              <span>•</span>
              <span>{challenge.difficulty}</span>
              <span>•</span>
              <span className="text-terminal-amber">{challenge.points} pts</span>
              {challenge.first_blood_bonus > 0 && (
                <span className="text-terminal-red">🩸 +{challenge.first_blood_bonus}</span>
              )}
              {challenge.is_extra && (
                <span className="rounded border border-terminal-cyan/40 px-1.5 py-0.5 text-terminal-cyan">
                  🎁 extra
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-terminal-green">{challenge.title}</h2>
            {firstBloodBy && (
              <p className="mt-1 text-xs text-terminal-red">First blood claimed by {firstBloodBy}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded border border-terminal-border px-2 py-1 text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          <Prompt text={challenge.prompt} className="text-sm text-terminal-green/90" />

          {/* Beginner-friendly nudge toward the right kind of tool (not the answer) */}
          {challenge.suggested_tool && (
            <div className="flex items-start gap-2 rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/5 px-3 py-2 text-xs text-terminal-cyan">
              <span>🧰</span>
              <span>
                <strong className="font-bold">Tool to try:</strong> {challenge.suggested_tool}
              </span>
            </div>
          )}

          {/* Asset / action buttons */}
          <div className="flex flex-wrap gap-3">
            {challenge.asset_url && (
              <a
                href={challenge.asset_url}
                download
                className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan transition hover:bg-terminal-cyan/20"
              >
                ⬇ Download file
              </a>
            )}
            {challenge.action_url && (
              <Link
                to={challenge.action_url}
                className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan transition hover:bg-terminal-cyan/20"
              >
                ▸ Open challenge
              </Link>
            )}
          </div>

          {/* Hints */}
          {challenge.num_hints > 0 && (
            <div className="rounded-lg border border-terminal-border bg-terminal-input/60 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-terminal-amber">
                {solved ? 'Hints (free — you solved this)' : 'Hints (cost points on this challenge)'}
              </h4>
              <div className="space-y-2">
                {Array.from({ length: challenge.num_hints }, (_, i) => i + 1).map((n) => {
                  const unlocked = hints.get(n);
                  return unlocked ? (
                    <div key={n} className="rounded border border-terminal-amber/30 bg-terminal-amber/5 p-3 text-sm">
                      <span className="mr-2 text-[10px] font-bold uppercase text-terminal-amber">
                        Hint {n} {unlocked.penalty ? `(−${unlocked.penalty})` : '(free)'}
                      </span>
                      <span className="text-terminal-green/90">{unlocked.body}</span>
                    </div>
                  ) : (
                    <button
                      key={n}
                      onClick={() => onUnlock(n)}
                      disabled={!running}
                      className="flex w-full items-center justify-between rounded border border-terminal-border px-3 py-2 text-sm text-terminal-dim transition hover:border-terminal-amber/50 hover:text-terminal-amber disabled:opacity-40"
                    >
                      <span>{solved ? '💡' : '🔒'} Reveal hint {n}</span>
                      <span className="text-xs">{solved ? 'free' : 'costs points'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flag submit */}
          {solved ? (
            <div className="rounded-lg border border-terminal-green/60 bg-terminal-green/10 px-4 py-3 text-center font-bold text-terminal-green shadow-neon">
              ✓ SOLVED — nice work!
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {!running && (
                <p className="text-center text-sm text-terminal-amber">
                  {eventStatus === 'idle'
                    ? '◷ The event has not started yet. Get ready!'
                    : "⏱ Time's up — submissions are closed."}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder="KGSP{...}"
                  disabled={!running || busy}
                  className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!running || busy}
                  className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
                >
                  {busy ? '…' : 'Submit'}
                </button>
              </div>
            </form>
          )}

          {feedback && (
            <div
              className={`animate-pop rounded-lg px-4 py-3 text-center text-sm font-semibold ${
                feedback.kind === 'ok'
                  ? 'border border-terminal-green/60 bg-terminal-green/10 text-terminal-green'
                  : feedback.kind === 'bad'
                    ? 'border border-terminal-red/60 bg-terminal-red/10 text-terminal-red'
                    : 'border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
