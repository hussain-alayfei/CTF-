import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const FLAG = 'MERAS{c00kies_can_be_edited}';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function CookieChallenge() {
  const [role, setRole] = useState<string | null>(null);

  function refresh() {
    setRole(getCookie('role'));
  }

  useEffect(() => {
    // Give every visitor a normal "guest" cookie to discover and tamper with.
    if (!getCookie('role')) {
      document.cookie = 'role=guest; path=/; SameSite=Lax';
    }
    refresh();
  }, []);

  const isAdmin = role === 'admin';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🔐 Secret Admin Panel</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          Internal tool — authorised administrators only.
        </p>

        <div className="mt-6 rounded-lg border border-terminal-border bg-black/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-terminal-dim">Your current role:</span>
            <span className={isAdmin ? 'font-bold text-terminal-green' : 'font-bold text-terminal-amber'}>
              {role ?? 'unknown'}
            </span>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-6 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Access granted</div>
            <div className="mt-2 text-lg text-terminal-green">Welcome, administrator. Here is the flag:</div>
            <code className="mt-3 inline-block select-all rounded bg-black/60 px-4 py-2 text-lg font-bold text-terminal-green">
              {FLAG}
            </code>
            <p className="mt-3 text-xs text-terminal-dim">
              Copy it and submit it back in the arena to score the points.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-terminal-red/50 bg-terminal-red/10 p-6 text-center">
            <div className="text-lg font-bold text-terminal-red">⛔ Access Denied</div>
            <p className="mt-2 text-sm text-terminal-green/90">
              You are signed in as <strong className="text-white">{role ?? 'guest'}</strong>. This
              page is for <strong className="text-white">admins</strong> only.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-terminal-dim">
              But wait… how does this page decide who is an admin? It only checks something stored in{' '}
              <strong className="text-terminal-amber">your own browser</strong>. Open DevTools
              (F12) → Application → Cookies, or run this in the Console:
            </p>
            <code className="mt-2 inline-block rounded bg-black/60 px-3 py-1 text-xs text-terminal-cyan">
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
