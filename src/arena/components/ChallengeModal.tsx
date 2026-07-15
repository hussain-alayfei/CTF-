import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Challenge, HintResult, Player } from '@/lib/types';
import type { EventStatus } from '@/lib/time';
import { submitFlag, unlockHint } from '@/lib/api';
import { playClick, playCorrect, playHint, playWrong, unlockAudio } from '@/lib/sounds';
import useLockBodyScroll from '@/lib/useLockBodyScroll';
import Prompt from '@/challenges/shared/Prompt';
import ConfirmDialog from '@/admin/ConfirmDialog';

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
  hidden = false,
  onClose,
  onSolved,
}: {
  challenge: Challenge;
  player: Player;
  solved: boolean;
  firstBloodBy?: string;
  eventStatus: EventStatus;
  /** Fairness blur for the LIVE day before its round starts. Practice/completed
   *  days pass false so they stay fully readable regardless of event status. */
  hidden?: boolean;
  onClose: () => void;
  onSolved: () => void;
}) {
  const [flag, setFlag] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hints, setHints] = useState<Map<number, HintResult>>(() => new Map(getCache(challenge.id)));
  const [hintConfirm, setHintConfirm] = useState<number | null>(null);
  useLockBodyScroll();

  const running = eventStatus === 'running';

  // Solved challenges unlock hints for free (no confirm). Otherwise pop the
  // in-app confirm first — it costs points.
  function requestUnlock(n: number) {
    if (solved) {
      void doUnlock(n);
      return;
    }
    setHintConfirm(n);
  }

  async function doUnlock(n: number) {
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
    <>
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-terminal-border bg-terminal-panel shadow-neon"
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
              <span className="text-terminal-amber">
                {challenge.points} {challenge.score_decay_step > 0 ? 'pts next' : 'pts'}
              </span>
              {challenge.first_blood_bonus > 0 && !firstBloodBy && (
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
            {challenge.score_decay_step > 0 && (
              <p className="mt-1 text-[10px] text-terminal-dim">
                Solve-order value · −{challenge.score_decay_step} after the second solver · floor{' '}
                {challenge.score_minimum}
              </p>
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
          {/* Prompt — hidden behind a clean, fixed-size panel only for the LIVE
              day before its round starts (fairness). Practice/completed days and
              solved challenges are always readable. No real text is rendered
              underneath, so nothing can bleed through — this is a swap. */}
          {hidden && !solved ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-terminal-amber/40 bg-terminal-amber/5 px-5 py-10 text-center">
              <span className="text-3xl">🔒</span>
              <span className="text-sm font-semibold text-terminal-amber">
                Challenge details hidden until the event starts
              </span>
            </div>
          ) : (
            <Prompt text={challenge.prompt} className="text-sm text-terminal-green/90" />
          )}

          {/* Asset / action buttons. During fairness-hide (live day, round not
              running) both download and "Open challenge" stay locked — otherwise
              students skip the blind and walk straight into the lab. */}
          {hidden && !solved && (challenge.asset_url || challenge.action_url) ? (
            <div className="rounded-lg border border-dashed border-terminal-border px-4 py-3 text-center text-xs text-terminal-dim">
              Download / lab unlock when the round starts
            </div>
          ) : (
            (challenge.asset_url || challenge.action_url) && (
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
            )
          )}

          {/* Hint — hidden when the event isn't running, unless the player already
              unlocked it this session (they paid for it) or already solved the challenge
              (hints become free). Showing a disabled locked-hint button when idle/ended
              just creates noise in an otherwise clean locked modal. */}
          {challenge.num_hints > 0 && (running || solved || hints.size > 0) && (
            <div className="rounded-lg border border-terminal-border bg-terminal-input/60 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-terminal-amber">
                {solved ? 'Hint (free — you solved this)' : '⚠ One hint available — costs points'}
              </h4>
              <div className="space-y-2">
                {(() => {
                  const n = 1;
                  const unlocked = hints.get(n);
                  return unlocked ? (
                    <div className="rounded border border-terminal-amber/30 bg-terminal-amber/5 p-3 text-sm">
                      <span className="mr-2 text-[10px] font-bold uppercase text-terminal-amber">
                        Hint {unlocked.penalty ? `(−${unlocked.penalty})` : '(free)'}
                      </span>
                      <span className="text-terminal-green/90">{unlocked.body}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => requestUnlock(n)}
                      disabled={!running}
                      className="flex w-full items-center justify-between rounded border border-terminal-border px-3 py-2 text-sm text-terminal-dim transition hover:border-terminal-amber/50 hover:text-terminal-amber disabled:opacity-40"
                    >
                      <span>{solved ? '💡' : '🔒'} Reveal the hint</span>
                      <span className="text-xs">{solved ? 'free' : 'costs points'}</span>
                    </button>
                  );
                })()}
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

      <ConfirmDialog
        open={hintConfirm !== null}
        title="Reveal the hint?"
        body="This hint costs points on this challenge. Reveal it anyway?"
        confirmLabel="Reveal"
        tone="default"
        onConfirm={() => {
          const n = hintConfirm;
          setHintConfirm(null);
          if (n !== null) void doUnlock(n);
        }}
        onCancel={() => setHintConfirm(null)}
      />
    </>
  );
}
