import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial, verifyChallengeAnswer } from '@/lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '@/lib/sounds';
import { looksLikeToken, xorDecryptHex } from './dayfive';

const CHALLENGE_ID = 'p5_ghost_profile';

type Profile = { timezone: string; locale: string; screen: string };

function readEnv(): Profile {
  const opts = Intl.DateTimeFormat().resolvedOptions();
  return {
    timezone: opts.timeZone ?? '',
    locale: opts.locale ?? '',
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}

// Canonical string whose SHA-256 is the decryption key. MUST match the string
// the generator used when it produced reveal_hex, byte for byte.
function canonical(p: Profile): string {
  return `${p.timezone}|${p.locale}|${p.screen}`;
}

const FIELD_LABEL: Record<keyof Profile, string> = {
  timezone: 'Time zone',
  locale: 'Locale',
  screen: 'Screen size',
};

export default function GhostProfileChallenge() {
  const { player } = useApp();
  const [target, setTarget] = useState<Profile | null>(null);
  const [revealHex, setRevealHex] = useState('');
  const [live, setLive] = useState<Profile>(readEnv);
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
    if (!target) return { timezone: false, locale: false, screen: false };
    return {
      timezone: live.timezone === target.timezone,
      locale: live.locale === target.locale,
      screen: live.screen === target.screen,
    };
  }, [live, target]);

  const aligned = matches.timezone && matches.locale && matches.screen;

  // When the live environment fully matches, the SHA-256 of the live canonical
  // string equals the key that encrypted the answer — so it decrypts here, in
  // the student's own browser, and nowhere else.
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
        <h1 className="text-2xl font-extrabold text-terminal-green">🕶️ Ghost Profile</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          A secure newsroom will only admit a visitor whose browser looks exactly like its shared kiosk. The intake
          badge below stays sealed until your session presents the same three traits it expects. Change your own
          browser — not this page — until every trait lines up.
        </p>

        {target && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/5 p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">Kiosk expects</div>
              <table className="mt-2 w-full font-mono text-xs">
                <tbody>
                  {(Object.keys(FIELD_LABEL) as (keyof Profile)[]).map((k) => (
                    <tr key={k}>
                      <td className="py-0.5 pr-3 text-terminal-dim">{FIELD_LABEL[k]}</td>
                      <td className="py-0.5 text-terminal-green">{target[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-dim">Your session now</div>
              <table className="mt-2 w-full font-mono text-xs">
                <tbody>
                  {(Object.keys(FIELD_LABEL) as (keyof Profile)[]).map((k) => (
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

        {aligned && revealed ? (
          <div className="mt-4 animate-pop rounded-lg border border-terminal-green/50 bg-terminal-green/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-green">Badge admitted — intake token</div>
            <div className="mt-1 select-all break-all font-mono text-lg text-terminal-green">{revealed}</div>
            <p className="mt-1 text-xs text-terminal-dim">Submit this token below to claim your flag.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-xs text-terminal-dim">
            The intake token stays sealed until all three traits show ✓. It is never sent to your browser before then.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="intake token"
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
