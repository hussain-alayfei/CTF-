import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial, verifyChallengeAnswer } from '@/lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '@/lib/sounds';
import { looksLikeToken, xorDecryptHex } from './dayfive';

const CHALLENGE_ID = 'p5_entropy_portal';

type Env = {
  timezone: string;
  locale: string;
  screen: string;
  scheme: string;
  dpr: string;
};

function readEnv(): Env {
  const opts = Intl.DateTimeFormat().resolvedOptions();
  return {
    timezone: opts.timeZone ?? '',
    locale: opts.locale ?? '',
    screen: `${window.screen.width}x${window.screen.height}`,
    scheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    dpr: String(window.devicePixelRatio),
  };
}

function canonical(e: Env): string {
  return `${e.timezone}|${e.locale}|${e.screen}|${e.scheme}|${e.dpr}`;
}

const FIELD_LABEL: Record<keyof Env, string> = {
  timezone: 'Time zone',
  locale: 'Locale',
  screen: 'Screen size',
  scheme: 'Colour scheme',
  dpr: 'Pixel ratio',
};

export default function EntropyPortalChallenge() {
  const { player } = useApp();
  const [target, setTarget] = useState<Env | null>(null);
  const [revealHex, setRevealHex] = useState('');
  const [live, setLive] = useState<Env>(readEnv);
  const [revealed, setRevealed] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, CHALLENGE_ID)
      .then((r) => {
        if (r.ok && r.material) {
          setTarget({
            timezone: String(r.material.timezone ?? ''),
            locale: String(r.material.locale ?? ''),
            screen: String(r.material.screen ?? ''),
            scheme: String(r.material.scheme ?? ''),
            dpr: String(r.material.dpr ?? ''),
          });
          setRevealHex(String(r.material.reveal_hex ?? ''));
        }
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    const id = window.setInterval(() => setLive(readEnv()), 1000);
    return () => clearInterval(id);
  }, []);

  const matches = useMemo(() => {
    const keys = Object.keys(FIELD_LABEL) as (keyof Env)[];
    const m = {} as Record<keyof Env, boolean>;
    for (const k of keys) m[k] = !!target && live[k] === target[k];
    return m;
  }, [live, target]);

  const matched = Object.values(matches).filter(Boolean).length;
  const total = Object.keys(FIELD_LABEL).length;
  const aligned = !!target && matched === total;

  useEffect(() => {
    let alive = true;
    if (!aligned || !revealHex) {
      setRevealed('');
      return;
    }
    xorDecryptHex(revealHex, canonical(live))
      .then((txt) => {
        if (alive && looksLikeToken(txt)) setRevealed(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [aligned, revealHex, live]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, CHALLENGE_ID, answer.trim());
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

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-terminal-dim">Log in from the arena first, then reopen this challenge.</p>
        <Link to={`/?c=${CHALLENGE_ID}`} className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted">
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to={`/?c=${CHALLENGE_ID}`} className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🌫️ Entropy Portal</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          This whistleblower drop only opens for a visitor who is impossible to single out — one who looks like
          everybody else. Right now your session is too distinctive on several traits. Blend in: make each trait as
          ordinary as the crowd baseline below, all at once, and the drop unseals.
        </p>

        {target && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/5 p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">Crowd baseline</div>
              <table className="mt-2 w-full font-mono text-xs">
                <tbody>
                  {(Object.keys(FIELD_LABEL) as (keyof Env)[]).map((k) => (
                    <tr key={k}>
                      <td className="py-0.5 pr-3 text-terminal-dim">{FIELD_LABEL[k]}</td>
                      <td className="py-0.5 text-terminal-green">{target[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-dim">You stand out at</div>
              <table className="mt-2 w-full font-mono text-xs">
                <tbody>
                  {(Object.keys(FIELD_LABEL) as (keyof Env)[]).map((k) => (
                    <tr key={k}>
                      <td className="py-0.5 pr-3 text-terminal-dim">{FIELD_LABEL[k]}</td>
                      <td className={`py-0.5 ${matches[k] ? 'text-terminal-green' : 'text-terminal-red'}`}>
                        {matches[k] ? '✓ ' : '✗ '}
                        {live[k]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-3 h-2 overflow-hidden rounded bg-terminal-border">
          <div className="h-full bg-terminal-green transition-all" style={{ width: `${(matched / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-terminal-dim">Blended {matched}/{total} traits.</p>

        {aligned && revealed ? (
          <div className="mt-4 animate-pop rounded-lg border border-terminal-green/50 bg-terminal-green/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-green">Drop unsealed — access token</div>
            <div className="mt-1 select-all break-all font-mono text-lg text-terminal-green">{revealed}</div>
            <p className="mt-1 text-xs text-terminal-dim">Submit this token below to claim your flag.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-xs text-terminal-dim">
            The access token is withheld until every trait matches the crowd baseline. It never reaches your browser
            before then.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="access token"
            disabled={busy}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green outline-none focus:border-terminal-green disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20 disabled:opacity-40"
          >
            {busy ? '…' : 'Verify ▸'}
          </button>
        </form>

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
