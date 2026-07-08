import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { fetchChallengeLiveMaterial, verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

type Target = { timezone: string; language: string; screen: string };

function readFingerprint() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language;
  const screen = `${window.screen.width}x${window.screen.height}`;
  return { timezone: tz, language: lang, screen };
}

function score(actual: ReturnType<typeof readFingerprint>, target: Target | null) {
  if (!target) return 0;
  let n = 0;
  if (actual.timezone === target.timezone) n += 34;
  if (actual.language === target.language) n += 33;
  if (actual.screen === target.screen) n += 33;
  return n;
}

export default function MaskMatchChallenge() {
  const { player } = useApp();
  const [target, setTarget] = useState<Target | null>(null);
  const [sessionKey, setSessionKey] = useState('');
  const [actual, setActual] = useState(readFingerprint);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  const pct = useMemo(() => score(actual, target), [actual, target]);
  const aligned = pct >= 100;

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, 'p5_mask_match')
      .then((r) => {
        if (r.ok && r.material) {
          setTarget({
            timezone: String(r.material.timezone ?? ''),
            language: String(r.material.language ?? ''),
            screen: String(r.material.screen ?? ''),
          });
          setSessionKey(String(r.material.session_key_hex ?? ''));
        }
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    const id = window.setInterval(() => setActual(readFingerprint()), 1200);
    return () => clearInterval(id);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player || !aligned) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, 'p5_mask_match', answer.trim());
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
        <Link to="/?c=p5_mask_match" className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted">
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/?c=p5_mask_match" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🎭 Mask Match</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          A surveillance export captured several workstation masks. One belongs to the target session below. The
          record only makes sense once your own browser genuinely looks like the target — the session material
          unlocks at full alignment.
        </p>

        {target && (
          <div className="mt-4 rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">Session brief</div>
            <table className="mt-2 w-full font-mono text-xs">
              <tbody>
                {Object.entries(target).map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-0.5 pr-3 text-terminal-dim">{k}</td>
                    <td className="py-0.5 text-terminal-green">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-dim">Your live mask</div>
          <table className="mt-2 w-full font-mono text-xs">
            <tbody>
              {Object.entries(actual).map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-3 text-terminal-dim">{k}</td>
                  <td className={`py-0.5 ${target && actual[k as keyof typeof actual] === target[k as keyof Target] ? 'text-terminal-green' : 'text-terminal-dim'}`}>
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 h-2 overflow-hidden rounded bg-terminal-border">
            <div className="h-full bg-terminal-green transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-terminal-dim">Alignment: {pct}% — adjust locale, timezone, or viewport until the capture row applies.</p>
        </div>

        {aligned && sessionKey ? (
          <div className="mt-4 rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">
              Session material — unlocked, not included in the download
            </div>
            <div className="mt-2 font-mono text-xs">
              <span className="text-terminal-dim">session key (hex)</span>
              <div className="mt-1 select-all break-all text-terminal-green">{sessionKey}</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-xs text-terminal-dim">
            Session material stays locked until your live mask fully matches the target.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="decoded token from matching row"
            disabled={busy || !aligned}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green outline-none focus:border-terminal-green disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={busy || !aligned}
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
