import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

// "Trust No Cookie" — now per-player. There is NO flag string in this file
// anymore (it used to be hardcoded, so anyone reading the JS bundle had it for
// free). The lesson is unchanged — the page trusts a client-side cookie for
// auth — but once the visitor has forged the `role=admin` cookie, the flag is
// minted server-side by verify_challenge_answer and is unique to them.
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function CookieChallenge() {
  const { player } = useApp();
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  function refresh() {
    setRole(getCookie('role'));
    setClaim(null);
  }

  useEffect(() => {
    if (!getCookie('role')) {
      document.cookie = 'role=guest; path=/; SameSite=Lax';
    }
    refresh();
  }, []);

  const isAdmin = role === 'admin';

  async function claimFlag() {
    if (!player || busy) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      // Submit whatever role the browser cookie currently claims — the whole
      // point is that the server was never the one deciding it.
      const r = await verifyChallengeAnswer(player, 'cookie', role ?? '');
      setClaim({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) playCorrect();
      else playWrong();
    } catch {
      setClaim({ ok: false, message: 'Could not reach the server — try again.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to="/"
        className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
      >
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🔐 Secret Admin Panel</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          Internal tool — authorised administrators only.
        </p>

        <div className="mt-6 rounded-lg border border-terminal-border bg-terminal-input/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-terminal-dim">Your current role:</span>
            <span className={isAdmin ? 'font-bold text-terminal-green' : 'font-bold text-terminal-amber'}>
              {role ?? 'unknown'}
            </span>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-6 rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Access granted</div>
            <p className="mt-2 text-terminal-green">
              The page believed your cookie. Claim your personal flag from the server:
            </p>
            {!player && (
              <p className="mt-3 text-sm text-terminal-amber">
                Log in from the arena first, then come back and re-check.
              </p>
            )}
            {player && !claim?.ok && (
              <button
                onClick={claimFlag}
                disabled={busy}
                className="mt-4 rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
              >
                {busy ? '…' : 'Claim flag ▸'}
              </button>
            )}
            {claim?.ok && claim.flag && (
              <div className="mt-4 animate-pop">
                <div className="text-terminal-green">This flag is personal to your account:</div>
                <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
                  {claim.flag}
                </code>
                <p className="mt-3 text-xs text-terminal-dim">Paste it into the arena flag box to score.</p>
              </div>
            )}
            {claim && !claim.ok && (
              <p className="mt-3 text-sm text-terminal-red">{claim.message}</p>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-terminal-red/50 bg-terminal-red/10 p-6 text-center">
            <div className="text-lg font-bold text-terminal-red">⛔ Access Denied</div>
            <p className="mt-2 text-sm text-terminal-green/90">
              You are signed in as <strong className="text-terminal-strong">{role ?? 'guest'}</strong>.
              This page is for <strong className="text-terminal-strong">admins</strong> only.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-terminal-dim">
              But wait… how does this page decide who is an admin? It only checks something stored in{' '}
              <strong className="text-terminal-amber">your own browser</strong>. Open DevTools (F12) →
              Application → Cookies, or run this in the Console:
            </p>
            <code className="mt-2 inline-block rounded bg-terminal-input px-3 py-1 text-xs text-terminal-cyan">
              document.cookie = "role=admin"
            </code>
          </div>
        )}

        <button
          onClick={refresh}
          className="mt-6 w-full rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 hover:shadow-neon"
        >
          ⟳ Re-check my access
        </button>
        <p className="mt-2 text-center text-[11px] text-terminal-dim">
          (After editing the cookie, click this or reload the page.)
        </p>
      </div>
    </div>
  );
}
