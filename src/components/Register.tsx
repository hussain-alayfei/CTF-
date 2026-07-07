import { useState } from 'react';
import { registerPlayer } from '../lib/api';
import { useApp } from '../lib/app-context';
import { playCorrect, playWrong, unlockAudio } from '../lib/sounds';

export default function Register() {
  const { setPlayer } = useApp();
  const [name, setName] = useState('');
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
    setBusy(true);
    setError(null);
    try {
      const player = await registerPlayer(trimmed);
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-terminal-bg/95 p-4">
      <div className="w-full max-w-md animate-pop rounded-xl border border-terminal-border bg-terminal-panel p-8 shadow-neon">
        <div className="mb-1 text-center text-xs uppercase tracking-[0.3em] text-terminal-dim">
          Meras // Cyber Range
        </div>
        <h1 className="mb-2 text-center text-4xl font-extrabold text-terminal-green drop-shadow-[0_0_10px_rgba(57,255,20,0.5)]">
          CAPTURE<span className="text-white"> THE </span>FLAG
        </h1>
        <p className="mb-6 text-center text-sm text-terminal-dim">
          Enter your hacker alias to join the arena. Solve challenges, grab
          flags, climb the leaderboard.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
              &gt; choose your alias
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="n30_h4ck3r"
              className="w-full rounded-lg border border-terminal-border bg-black/50 px-4 py-3 text-lg text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon"
            />
          </div>

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
            {busy ? 'connecting…' : 'Enter the Arena ▸'}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-terminal-dim">
          Your alias is saved on this device so you keep your score if you
          refresh. Flags look like <code className="text-terminal-green">MERAS&#123;...&#125;</code>
        </p>
      </div>
    </div>
  );
}
