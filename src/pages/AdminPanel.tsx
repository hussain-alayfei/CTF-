import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminReset, adminStartEvent, adminStopEvent, fetchEventConfig } from '../lib/api';
import { getEventState } from '../lib/time';
import type { EventConfig } from '../lib/types';

export default function AdminPanel() {
  const [secret, setSecret] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<EventConfig | null>(null);

  async function reloadEvent() {
    try {
      setEvent(await fetchEventConfig());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void reloadEvent();
    const id = setInterval(reloadEvent, 5000);
    return () => clearInterval(id);
  }, []);

  async function run(action: () => Promise<{ error?: string; message?: string }>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    if (!secret.trim()) {
      setMsg({ ok: false, text: 'Enter the admin secret first.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await action();
      if (res.error) setMsg({ ok: false, text: res.message ?? 'Failed.' });
      else setMsg({ ok: true, text: res.message ?? 'Done.' });
      await reloadEvent();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error.' });
    } finally {
      setBusy(false);
    }
  }

  const state = getEventState(event);
  const statusLabel =
    state.status === 'running' ? 'RUNNING' : state.status === 'ended' ? 'ENDED' : 'NOT STARTED';

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link to="/" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🛠 Instructor Panel</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          Start the timed event, stop it early, or reset scores for a new run.
        </p>

        <div className="mt-5 flex items-center justify-between rounded-lg border border-terminal-border bg-black/40 px-4 py-3">
          <span className="text-sm text-terminal-dim">Event status</span>
          <span
            className={`font-bold ${
              state.status === 'running'
                ? 'text-terminal-green'
                : state.status === 'ended'
                  ? 'text-terminal-red'
                  : 'text-terminal-amber'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
              Admin secret
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="meras-••••••••"
              className="w-full rounded-lg border border-terminal-border bg-black/50 px-4 py-3 text-terminal-green outline-none focus:border-terminal-green focus:shadow-neon"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-terminal-border bg-black/50 px-4 py-3 text-terminal-green outline-none focus:border-terminal-green focus:shadow-neon"
            />
          </div>

          <button
            disabled={busy}
            onClick={() => run(() => adminStartEvent(secret, minutes))}
            className="w-full rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 hover:shadow-neon disabled:opacity-50"
          >
            ▶ Start / restart {minutes}-minute event
          </button>

          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={() => run(() => adminStopEvent(secret), 'Stop the event now for everyone?')}
              className="flex-1 rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-50"
            >
              ⏹ Stop now
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () => adminReset(secret),
                  'Reset ALL scores and clear the timer? Players keep their names but lose all solves.',
                )
              }
              className="flex-1 rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20 disabled:opacity-50"
            >
              ⟲ Reset game
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`mt-5 rounded-lg px-4 py-3 text-center text-sm font-semibold ${
              msg.ok
                ? 'border border-terminal-green/60 bg-terminal-green/10 text-terminal-green'
                : 'border border-terminal-red/60 bg-terminal-red/10 text-terminal-red'
            }`}
          >
            {msg.text}
          </div>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-terminal-dim">
          The admin secret was generated when the database was set up. Keep it private — anyone with
          it can start/stop/reset the game. You can change it in the Supabase dashboard
          (table <code className="text-terminal-green">admin_config</code>).
        </p>
      </div>
    </div>
  );
}
