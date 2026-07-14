import { useMemo, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_desk_wizard';

type Step = { title: string; options: { id: string; label: string; ok: boolean }[] };

const STEPS: Step[] = [
  {
    title: 'How did you arrive?',
    options: [
      { id: 'vip', label: 'VIP escort', ok: false },
      { id: 'walk', label: 'Walk-in', ok: true },
      { id: 'drone', label: 'Drone drop', ok: false },
    ],
  },
  {
    title: 'What do you need?',
    options: [
      { id: 'badge', label: 'Replacement badge', ok: false },
      { id: 'quiet', label: 'Quiet-room access', ok: true },
      { id: 'keys', label: 'Master keys', ok: false },
    ],
  },
  {
    title: 'Who should be notified?',
    options: [
      { id: 'press', label: 'Press office', ok: false },
      { id: 'none', label: 'Nobody — keep it internal', ok: true },
      { id: 'all', label: 'Entire floor', ok: false },
    ],
  },
];

export default function DeskWizardChallenge() {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const done = picks.length === STEPS.length;

  const token = useMemo(() => {
    if (!done) return null;
    const ok =
      picks[0] === 'walk' && picks[1] === 'quiet' && picks[2] === 'none';
    if (!ok) return null;
    const bytes = [113, 117, 105, 101, 116, 95, 112, 97, 116, 104];
    return btoa(String.fromCharCode(...bytes));
  }, [done, picks]);

  if (token) {
    try {
      sessionStorage.setItem('d7_desk_recovery', token);
    } catch {
      /* ignore */
    }
  }

  function choose(id: string) {
    unlockAudio();
    playClick();
    const next = [...picks, id];
    setPicks(next);
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function reset() {
    setPicks([]);
    setStep(0);
    try {
      sessionStorage.removeItem('d7_desk_recovery');
    } catch {
      /* ignore */
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Desk Wizard"
      blurb="A three-screen intake form decides whether you get a quiet path through the building. Pick carefully — the wrong combination leaves nothing to recover. When the path is right, the desk stores the recovery out of sight of this form."
    >
      {!done ? (
        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
          <p className="text-xs uppercase tracking-widest text-terminal-dim">
            Step {step + 1} / {STEPS.length}
          </p>
          <h2 className="mt-2 font-bold text-terminal-green">{STEPS[step].title}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {STEPS[step].options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                className="rounded-lg border border-terminal-border px-3 py-2 text-left text-sm text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
          <p>Intake filed.</p>
          <p className="mt-2">
            {token
              ? 'A recovery slip was filed in this browser’s short-term desk drawer — not on this card.'
              : 'No recovery was filed for those choices.'}
          </p>
          <button type="button" onClick={reset} className="mt-3 text-xs underline decoration-dotted">
            Restart intake
          </button>
        </div>
      )}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
