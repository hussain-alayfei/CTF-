import { useCallback, useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { d9LabStep } from '@/lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '@/lib/sounds';
import { DAY_NINE_LABS, type DayNineLab } from './daynine';

type LabResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  stage?: number;
  stage_count?: number;
  task?: string;
  placeholder?: string;
  evidence?: Record<string, unknown>;
  complete?: boolean;
  token?: string;
};

const modeStyle: Record<DayNineLab['mode'], { icon: string; accent: string }> = {
  chain: { icon: '⛓', accent: 'border-terminal-cyan/40 bg-terminal-cyan/5' },
  network: { icon: '◉', accent: 'border-indigo-400/40 bg-indigo-400/5' },
  miner: { icon: '⛏', accent: 'border-terminal-amber/40 bg-terminal-amber/5' },
  tree: { icon: '⌘', accent: 'border-emerald-400/40 bg-emerald-400/5' },
  wallet: { icon: '◈', accent: 'border-violet-400/40 bg-violet-400/5' },
  jury: { icon: '⚖', accent: 'border-sky-400/40 bg-sky-400/5' },
  freight: { icon: '▣', accent: 'border-teal-400/40 bg-teal-400/5' },
  incident: { icon: '◇', accent: 'border-fuchsia-400/40 bg-fuchsia-400/5' },
};

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function EvidencePanel({ lab, evidence }: { lab: DayNineLab; evidence: Record<string, unknown> }) {
  const style = modeStyle[lab.mode];
  const entries = Object.entries(evidence);
  if (entries.length === 0) return null;

  return (
    <div className={`rounded-xl border p-4 ${style.accent}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl text-terminal-cyan">{style.icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-terminal-dim">
          Live evidence
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => {
          const text = displayValue(value);
          const wide = text.length > 42 || text.includes('\n');
          const isArtifact = typeof value === 'string' && value.startsWith('/challenges/day9/');
          return (
            <div
              key={key}
              className={`rounded-lg border border-terminal-border bg-black/25 p-3 ${wide ? 'sm:col-span-2' : ''}`}
            >
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-terminal-dim">
                {key.replace(/_/g, ' ')}
              </p>
              {isArtifact ? (
                <a
                  href={value}
                  download
                  className="font-mono text-xs text-terminal-cyan underline decoration-dotted"
                >
                  Download evidence
                </a>
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-terminal-green">
                  {text}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BlockchainChallenge({ challengeId }: { challengeId: string }) {
  const { player } = useApp();
  const lab = DAY_NINE_LABS[challengeId];
  const [state, setState] = useState<LabResponse | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const begin = useCallback(async () => {
    if (!player || !lab) return;
    setBusy(true);
    try {
      const next = (await d9LabStep(player, challengeId, 'begin')) as LabResponse;
      setState(next);
      setFeedback(next.message ?? '');
    } catch {
      setFeedback('The lab instance could not be loaded. Try again.');
    } finally {
      setBusy(false);
    }
  }, [challengeId, lab, player]);

  useEffect(() => {
    void begin();
  }, [begin]);

  if (!lab) return null;

  async function submitStage(e: React.FormEvent) {
    e.preventDefault();
    if (!player || !input.trim() || busy) return;
    unlockAudio();
    playClick();
    setBusy(true);
    setFeedback('');
    try {
      const next = (await d9LabStep(player, challengeId, 'submit', input.trim())) as LabResponse;
      setState((previous) =>
        next.ok
          ? next
          : {
              ...previous,
              ...next,
              task: previous?.task,
              placeholder: previous?.placeholder,
              evidence: previous?.evidence,
            },
      );
      setFeedback(next.message ?? '');
      if (next.ok) {
        setInput('');
        next.complete ? playCorrect() : playClick();
      } else {
        playWrong();
      }
    } catch {
      setFeedback('The validation desk did not answer. Try again.');
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!player || busy) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const next = (await d9LabStep(player, challengeId, 'reset')) as LabResponse;
      setState(next);
      setInput('');
      setFeedback(next.message ?? '');
    } finally {
      setBusy(false);
    }
  }

  const stage = Number(state?.stage ?? 0);
  const stageCount = Number(state?.stage_count ?? 1);
  const evidence = state?.evidence && typeof state.evidence === 'object' ? state.evidence : {};

  return (
    <ChallengeFrame challengeId={challengeId} title={lab.title} blurb={lab.blurb}>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-terminal-border bg-terminal-input/30 px-4 py-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-terminal-dim">
            {lab.eyebrow}
          </p>
          <p className="mt-1 text-xs text-terminal-green">
            Server-tracked instance · progress survives refresh
          </p>
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Stage ${stage + 1} of ${stageCount}`}>
          {Array.from({ length: stageCount }, (_, index) => (
            <span
              key={index}
              className={`h-2.5 w-7 rounded-full border ${
                state?.complete || index < stage
                  ? 'border-terminal-green bg-terminal-green/70'
                  : index === stage
                    ? 'border-terminal-amber bg-terminal-amber/50'
                    : 'border-terminal-border bg-terminal-input'
              }`}
            />
          ))}
        </div>
      </div>

      {busy && !state ? (
        <div className="mt-4 rounded-xl border border-dashed border-terminal-border p-8 text-center text-sm text-terminal-dim">
          Preparing your ledger instance…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <EvidencePanel lab={lab} evidence={evidence} />

          {state?.complete ? (
            <div className="rounded-xl border border-terminal-green/50 bg-terminal-green/10 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-terminal-green">
                Investigation complete
              </p>
              <p className="mt-2 text-sm text-terminal-dim">
                This receipt belongs only to your account. Submit it below to mint your personal flag.
              </p>
              <code className="mt-3 block break-all rounded border border-terminal-border bg-black/30 p-3 font-mono text-terminal-amber">
                {state.token}
              </code>
            </div>
          ) : (
            <form onSubmit={submitStage} className="rounded-xl border border-terminal-border p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-terminal-amber">
                    Stage {stage + 1} of {stageCount}
                  </p>
                  <p className="mt-1 text-sm text-terminal-green/90">{state?.task}</p>
                </div>
                {stage > 0 && (
                  <button
                    type="button"
                    onClick={() => void reset()}
                    className="shrink-0 text-[10px] text-terminal-dim underline decoration-dotted hover:text-terminal-amber"
                  >
                    restart
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={state?.placeholder ?? 'evidence'}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan disabled:opacity-50"
                >
                  {busy ? 'Checking…' : 'Commit'}
                </button>
              </div>
            </form>
          )}

          {feedback && (
            <p className={`text-xs ${state?.ok ? 'text-terminal-green' : 'text-terminal-amber'}`}>
              {feedback}
            </p>
          )}
        </div>
      )}

      {state?.complete && <AnswerBox challengeId={challengeId} />}
    </ChallengeFrame>
  );
}

