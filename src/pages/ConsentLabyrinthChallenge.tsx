import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

type Panel = { id: string; label: string; required: boolean };

const PANELS: { title: string; panels: Panel[] }[] = [
  {
    title: 'Essential services',
    panels: [
      { id: 'functional', label: 'Functional cookies (required for login)', required: true },
      { id: 'marketing', label: 'Marketing & retargeting', required: false },
    ],
  },
  {
    title: 'Analytics & security',
    panels: [
      { id: 'analytics', label: 'Cross-site analytics', required: false },
      { id: 'security', label: 'Fraud & abuse monitoring', required: true },
    ],
  },
  {
    title: 'Data sharing',
    panels: [
      { id: 'thirdparty', label: 'Sell data to partners', required: false },
      { id: 'essential', label: 'Strictly necessary storage', required: true },
    ],
  },
];

function computeToken(choices: Record<string, boolean>) {
  const ok =
    choices.functional === true &&
    choices.marketing === false &&
    choices.analytics === false &&
    choices.security === true &&
    choices.thirdparty === false &&
    choices.essential === true;
  if (!ok) return null;
  // Stored masked — recover from session storage, not from this UI.
  const bytes = [110, 97, 114, 114, 111, 119, 95, 112, 97, 116, 104];
  return btoa(String.fromCharCode(...bytes));
}

export default function ConsentLabyrinthChallenge() {
  const { player } = useApp();
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  const token = useMemo(() => computeToken(choices), [choices]);
  const done = step >= PANELS.length;

  function toggle(id: string, on: boolean) {
    unlockAudio();
    playClick();
    setChoices((c) => ({ ...c, [id]: on }));
  }

  function next() {
    unlockAudio();
    playClick();
    if (step < PANELS.length - 1) setStep((s) => s + 1);
    else setStep(PANELS.length);
    if (token) sessionStorage.setItem('_cl_recovery', token);
    else sessionStorage.removeItem('_cl_recovery');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const stored = sessionStorage.getItem('_cl_recovery');
    if (!stored || busy || !player) return;
    let ans = stored;
    try {
      ans = atob(stored);
    } catch {
      /* student may paste decoded value */
    }
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, 'p5_consent_labyrinth', ans.trim());
      setResult({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) playCorrect();
      else playWrong();
    } catch {
      setResult({ ok: false, message: 'Verification failed.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-terminal-dim">Log in from the arena first, then reopen this challenge.</p>
        <Link to="/?c=p5_consent_labyrinth" className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted">
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  const panel = PANELS[Math.min(step, PANELS.length - 1)];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/?c=p5_consent_labyrinth" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🧩 Consent Labyrinth</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          This CMP hides the recovery value behind a exact privacy posture. Walk every step, deny what should
          stay off, keep only what is truly required — then read what the page stored for your session.
        </p>

        {!done ? (
          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">
              Step {step + 1} / {PANELS.length} — {panel.title}
            </div>
            <ul className="mt-3 space-y-3">
              {panel.panels.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-input/40 px-4 py-3">
                  <span className="text-sm text-terminal-strong">{p.label}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(p.id, true)}
                      className={`rounded px-3 py-1 text-xs font-bold uppercase ${choices[p.id] === true ? 'bg-terminal-green/20 text-terminal-green' : 'text-terminal-dim'}`}
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(p.id, false)}
                      className={`rounded px-3 py-1 text-xs font-bold uppercase ${choices[p.id] === false ? 'bg-terminal-red/20 text-terminal-red' : 'text-terminal-dim'}`}
                    >
                      Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={next}
              className="mt-4 rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-2 text-sm font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20"
            >
              {step < PANELS.length - 1 ? 'Continue ▸' : 'Finish wizard'}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-sm text-terminal-dim">
              Wizard complete. If your posture was correct, a recovery value was written to session storage for
              this origin. Wrong combinations leave decoy banners only.
            </p>
            {!token && (
              <p className="mt-3 rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 px-4 py-3 text-sm text-terminal-amber">
                Preferences rejected — marketing partners still enabled. Try again.
              </p>
            )}
            {token && (
              <form onSubmit={submit} className="mt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20 disabled:opacity-50"
                >
                  {busy ? '…' : 'Submit recovered value ▸'}
                </button>
              </form>
            )}
          </div>
        )}

        {result?.ok && result.flag && (
          <div className="mt-6 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
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
