import { useState } from 'react';
import { Link } from 'react-router-dom';

const FLAG = 'KGSP{Pr0t0col_S3cur3}';
const LEAKED_PASSWORD = 'Pr0t0col_S3cur3';

// A VPN login portal served over plain HTTP. Its debug build leaks the admin
// password inside the page itself — discoverable by viewing the page source /
// DevTools Elements, exactly the skill this challenge teaches. Entering the
// recovered password reveals the flag. No download required.
export default function VpnPortalChallenge() {
  const [pw, setPw] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'bad'>('idle');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(pw.trim() === LEAKED_PASSWORD ? 'ok' : 'bad');
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      {/* A genuine HTML comment node injected into the live DOM. It does NOT
          appear on screen, but DevTools -> Elements reveals it — this is the
          intended, non-download solve path (a careless debug build leaking
          credentials in the delivered markup). */}
      <div
        aria-hidden="true"
        style={{ display: 'none' }}
        dangerouslySetInnerHTML={{
          __html:
            '<!-- DEBUG BUILD v2.3.1 | TODO: strip before prod | default admin login  vpn_admin : Pr0t0col_S3cur3 -->',
        }}
      />
      <Link to="/" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-terminal-green">🔓 corp-vpn.internal</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-terminal-red">
            ⚠ connection: http (not secure)
          </p>
        </div>

        <p className="mt-4 text-sm text-terminal-dim">
          This VPN portal is served over plain <strong className="text-terminal-strong">HTTP</strong>.
          Anything the page contains — or sends — travels unprotected. Sign in as the administrator.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            value="vpn_admin"
            readOnly
            className="w-full rounded-lg border border-terminal-border bg-terminal-input/40 px-4 py-3 text-terminal-dim outline-none"
            data-field="username"
          />
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="administrator password"
            className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon"
          />
          <button
            type="submit"
            className="w-full rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 hover:shadow-neon"
          >
            Sign in ▸
          </button>
        </form>

        {status === 'ok' && (
          <div className="mt-5 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-5 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Access granted</div>
            <div className="mt-2 text-terminal-green">You recovered the leaked credentials. Flag:</div>
            <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
              {FLAG}
            </code>
          </div>
        )}
        {status === 'bad' && (
          <p className="mt-4 text-center text-sm text-terminal-red">
            Wrong password. The real one is hidden in this page — this is a debug build. Try inspecting it.
          </p>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-terminal-dim">
          Hint: a careless debug build can leave secrets inside the delivered page. Open
          DevTools (F12) → <strong className="text-terminal-amber">Elements</strong> and read
          through the markup near the top of this page.
        </p>
      </div>
    </div>
  );
}
