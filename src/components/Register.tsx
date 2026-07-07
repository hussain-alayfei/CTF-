import { useState } from 'react';
import { registerPlayer, loginPlayer } from '../lib/api';
import { useApp } from '../lib/app-context';
import { playCorrect, playWrong, unlockAudio } from '../lib/sounds';
import { AVATARS } from '../lib/constants';

type Mode = 'register' | 'login';

export default function Register() {
  const { setPlayer } = useApp();
  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Pick an alias with at least 2 characters.');
      playWrong();
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      playWrong();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const player =
        mode === 'register'
          ? await registerPlayer(trimmed, password, avatar)
          : await loginPlayer(trimmed, password);
      playCorrect();
      setPlayer(player);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-terminal-bg p-4">
      <div className="grid w-full max-w-4xl animate-pop overflow-hidden rounded-2xl border border-terminal-border bg-terminal-panel shadow-neon md:grid-cols-2">
        {/* Left: branding */}
        <div className="relative hidden flex-col justify-between border-r border-terminal-border bg-terminal-input/40 p-8 md:flex">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.3em] text-terminal-dim">
              KGSP // Cyber Range
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-terminal-green drop-shadow-[0_0_10px_rgb(var(--c-green)/0.5)]">
              CAPTURE
              <br />
              <span className="text-terminal-strong">THE</span> FLAG
            </h1>
            <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-terminal-dim">
              delivered by KUAST Academy
            </div>
          </div>

          <ul className="space-y-2 text-sm text-terminal-dim">
            <li>▸ Solve challenges, capture flags</li>
            <li>▸ Climb the live leaderboard</li>
            <li>▸ Race for first blood 🩸</li>
          </ul>

          <p className="text-[11px] leading-relaxed text-terminal-dim">
            Flags always look like{' '}
            <code className="text-terminal-green">KGSP&#123;...&#125;</code>
          </p>
        </div>

        {/* Right: form */}
        <div className="p-8">
          {/* Mobile branding */}
          <div className="mb-5 md:hidden">
            <h1 className="text-center text-3xl font-extrabold text-terminal-green drop-shadow-[0_0_10px_rgb(var(--c-green)/0.5)]">
              CAPTURE<span className="text-terminal-strong"> THE </span>FLAG
            </h1>
            <div className="text-center text-[10px] uppercase tracking-[0.25em] text-terminal-dim">
              delivered by KUAST Academy
            </div>
          </div>

          {/* Mode toggle */}
          <div className="mb-5 flex rounded-lg border border-terminal-border">
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 rounded-l-lg px-3 py-2 text-sm font-bold uppercase tracking-widest transition ${
                mode === 'register'
                  ? 'bg-terminal-green/15 text-terminal-green'
                  : 'text-terminal-dim hover:text-terminal-green'
              }`}
            >
              New player
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 rounded-r-lg px-3 py-2 text-sm font-bold uppercase tracking-widest transition ${
                mode === 'login'
                  ? 'bg-terminal-green/15 text-terminal-green'
                  : 'text-terminal-dim hover:text-terminal-green'
              }`}
            >
              Log in
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
                  &gt; alias
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  placeholder="n30_h4ck3r"
                  className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
                  &gt; password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon"
                />
              </div>
            </div>

            {/* Avatar picker (register only) */}
            {mode === 'register' && (
              <div>
                <label className="mb-2 block text-xs uppercase tracking-widest text-terminal-dim">
                  &gt; choose your avatar
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAvatar(a)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                        avatar === a
                          ? 'border-terminal-green bg-terminal-green/20 shadow-neon'
                          : 'border-terminal-border hover:border-terminal-green/50'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-terminal-red/50 bg-terminal-red/10 px-3 py-2 text-sm text-terminal-red">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-3 text-lg font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 hover:shadow-neon disabled:opacity-50"
            >
              {busy
                ? 'connecting…'
                : mode === 'register'
                  ? 'Enter the Arena ▸'
                  : 'Log in ▸'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
