import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

// "Cookie Crumbs" (Day 5, Privacy). Teaches how sites fingerprint/track you by
// scattering an identifier across several browser stores. On consent we plant a
// tracking id split into three lightly-obfuscated fragments across a cookie,
// localStorage, and sessionStorage. The player recovers all three via DevTools,
// decodes each, and joins them. Nothing here is the plaintext answer or a flag:
// the fragments are stored encoded, and the real per-player flag is minted by
// verify_challenge_answer only once the recovered code is correct.
const COOKIE_NAME = '_utm_track';
const LS_KEY = '_ga_client';
const SS_KEY = '_sess_fp';

// Encoded fragments (base64 / hex / ROT13 of the three answer parts). The
// plaintext answer never appears in this bundle.
const FRAG_COOKIE = 'c3QwcF8=';          // base64 -> part 1
const FRAG_LOCAL = '7472346b316e675f';   // hex    -> part 2
const FRAG_SESSION = 'z3';               // ROT13  -> part 3

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function CookieCrumbsChallenge() {
  const { player } = useApp();
  const [planted, setPlanted] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  useEffect(() => {
    setPlanted(
      getCookie(COOKIE_NAME) === FRAG_COOKIE &&
        localStorage.getItem(LS_KEY) === FRAG_LOCAL &&
        sessionStorage.getItem(SS_KEY) === FRAG_SESSION,
    );
  }, []);

  function acceptTracking() {
    unlockAudio();
    playClick();
    document.cookie = `${COOKIE_NAME}=${FRAG_COOKIE}; path=/; SameSite=Lax`;
    localStorage.setItem(LS_KEY, FRAG_LOCAL);
    sessionStorage.setItem(SS_KEY, FRAG_SESSION);
    setPlanted(true);
  }

  function clearTracking() {
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(SS_KEY);
    setPlanted(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, 'p_cookies', answer.trim());
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/?c=p_cookies" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🍪 Cookie Crumbs</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          A demo of how a site tracks you — by scattering one identifier across several
          places in <strong className="text-terminal-green">your own browser</strong>.
        </p>

        {!planted ? (
          <div className="mt-6 rounded-lg border border-terminal-amber/40 bg-terminal-amber/5 p-5 text-center">
            <p className="text-sm text-terminal-green/90">
              This page wants to store analytics on your device.
            </p>
            <button
              onClick={acceptTracking}
              className="mt-4 rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20"
            >
              Accept tracking ▸
            </button>
            <p className="mt-3 text-[11px] text-terminal-dim">(You can clear it again afterwards.)</p>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-terminal-green/50 bg-terminal-green/5 p-5">
            <p className="text-sm text-terminal-green">
              ✓ Tracking enabled. We just planted a single tracking ID, but we split it into
              <strong> three fragments</strong> and hid them in three different stores:
            </p>
            <ul className="mt-3 space-y-1 text-xs text-terminal-dim">
              <li>▸ a <strong className="text-terminal-green">cookie</strong> named <code>{COOKIE_NAME}</code></li>
              <li>▸ a <strong className="text-terminal-green">localStorage</strong> key <code>{LS_KEY}</code></li>
              <li>▸ a <strong className="text-terminal-green">sessionStorage</strong> key <code>{SS_KEY}</code></li>
            </ul>
            <button
              onClick={clearTracking}
              className="mt-4 rounded border border-terminal-border px-3 py-1.5 text-[11px] text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
            >
              🧹 Clear planted data
            </button>
          </div>
        )}

        {!player && (
          <p className="mt-6 text-sm text-terminal-amber">
            Log in from the arena first, then come back to submit your answer.
          </p>
        )}

        {player && (
          <form onSubmit={submit} className="mt-6 flex gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="the reassembled tracking code"
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
        )}

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
