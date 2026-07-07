import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminOverview,
  adminReset,
  adminSetDay,
  adminSetDayCode,
  adminSetFreeze,
  adminStartEvent,
  adminStopEvent,
} from '../lib/api';
import { getEventState } from '../lib/time';
import type { AdminChallenge, AdminDay, AdminOverview } from '../lib/types';
import { useApp } from '../lib/app-context';
import Prompt from '../components/Prompt';

const diffColor: Record<string, string> = {
  easy: 'text-terminal-green',
  medium: 'text-terminal-amber',
  hard: 'text-terminal-red',
};

export default function AdminPanel() {
  const { theme, toggleTheme } = useApp();
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [freeze, setFreeze] = useState(15);
  const [showFlags, setShowFlags] = useState(false);

  const load = useCallback(
    async (sec: string) => {
      const res = await adminOverview(sec);
      if (res.error) {
        setMsg({ ok: false, text: res.message ?? 'Wrong admin secret.' });
        setAuthed(false);
        return false;
      }
      setData(res);
      setAuthed(true);
      if (res.event) {
        setMinutes(res.event.duration_minutes ?? 60);
        setFreeze(res.event.freeze_minutes ?? 15);
      }
      return true;
    },
    [],
  );

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await load(secret);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error.' });
    } finally {
      setBusy(false);
    }
  }

  // Auto-refresh the dashboard while signed in.
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => {
      void load(secret).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [authed, secret, load]);

  async function run(
    action: () => Promise<{ error?: string; message?: string }>,
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await action();
      if (res.error) setMsg({ ok: false, text: res.message ?? 'Failed.' });
      else setMsg({ ok: true, text: res.message ?? 'Done.' });
      await load(secret);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error.' });
    } finally {
      setBusy(false);
    }
  }

  const state = getEventState(data?.event ?? null);
  const statusLabel =
    state.status === 'running' ? 'RUNNING' : state.status === 'ended' ? 'ENDED' : 'NOT STARTED';
  const statusColor =
    state.status === 'running'
      ? 'text-terminal-green'
      : state.status === 'ended'
        ? 'text-terminal-red'
        : 'text-terminal-amber';

  // ----- Not signed in: secret prompt -----
  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Link
          to="/"
          className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
        >
          ‹ back to the arena
        </Link>
        <form
          onSubmit={unlock}
          className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon"
        >
          <h1 className="text-2xl font-extrabold text-terminal-green">🛠 Instructor Panel</h1>
          <p className="mt-1 mb-5 text-sm text-terminal-dim">
            Enter your admin secret to manage the game.
          </p>
          <input
            type="password"
            autoFocus
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="admin secret"
            className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 text-terminal-green outline-none focus:border-terminal-green focus:shadow-neon"
          />
          {msg && !msg.ok && (
            <div className="mt-3 rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-3 py-2 text-sm text-terminal-red">
              {msg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
          >
            {busy ? 'checking…' : 'Unlock dashboard ▸'}
          </button>
        </form>
      </div>
    );
  }

  // ----- Signed in: full dashboard -----
  const challenges = data?.challenges ?? [];
  const days = data?.days ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
        >
          ‹ back to the arena
        </Link>
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-terminal-border px-3 py-2 text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <h1 className="text-2xl font-extrabold text-terminal-green">🛠 Instructor Dashboard</h1>

      {/* Stat tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Status" value={statusLabel} valueClass={statusColor} />
        <Tile label="Players" value={String(data?.players_count ?? 0)} />
        <Tile label="Total solves" value={String(data?.total_solves ?? 0)} />
        <Tile label="Freeze" value={`${data?.event?.freeze_minutes ?? 0} min`} />
      </div>

      {/* Event controls */}
      <section className="mt-6 rounded-xl border border-terminal-border bg-terminal-panel p-5">
        <h2 className="mb-4 font-bold uppercase tracking-widest text-terminal-cyan">▸ Event control</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
              className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-2.5 text-terminal-green outline-none focus:border-terminal-green"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
              Hide scores in final … minutes
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={120}
                value={freeze}
                onChange={(e) => setFreeze(Number(e.target.value))}
                className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-2.5 text-terminal-green outline-none focus:border-terminal-green"
              />
              <button
                disabled={busy}
                onClick={() => run(() => adminSetFreeze(secret, freeze))}
                className="whitespace-nowrap rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-3 py-2.5 text-sm font-bold text-terminal-cyan transition hover:bg-terminal-cyan/20"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            disabled={busy}
            onClick={() => run(() => adminStartEvent(secret, minutes))}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20"
          >
            ▶ Start / restart {minutes}-min event
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => adminStopEvent(secret), 'Stop the event now for everyone?')}
            className="rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20"
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
            className="rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20"
          >
            ⟲ Reset game
          </button>
        </div>
      </section>

      {/* Days */}
      <section className="mt-6 rounded-xl border border-terminal-border bg-terminal-panel p-5">
        <h2 className="mb-4 font-bold uppercase tracking-widest text-terminal-cyan">▸ Days</h2>
        <div className="space-y-3">
          {days.map((d: AdminDay) => (
            <div
              key={d.day}
              className="rounded-lg border border-terminal-border bg-terminal-input/50 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {d.is_rest && <span title="Rest day">😴</span>}
                  <div>
                    <div className="font-bold text-terminal-green">{d.title}</div>
                    {d.subtitle && <div className="text-xs text-terminal-dim">{d.subtitle}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.requires_code && (
                    <span className="rounded border border-terminal-amber/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-amber">
                      🔐 code
                    </span>
                  )}
                  <span
                    className={`text-xs font-bold uppercase ${d.is_open ? 'text-terminal-green' : 'text-terminal-dim'}`}
                  >
                    {d.is_open ? '● Open' : '○ Locked'}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => run(() => adminSetDay(secret, d.day, !d.is_open))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
                      d.is_open
                        ? 'border-terminal-amber/60 bg-terminal-amber/10 text-terminal-amber hover:bg-terminal-amber/20'
                        : 'border-terminal-green/60 bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20'
                    }`}
                  >
                    {d.is_open ? 'Lock' : 'Unlock'}
                  </button>
                </div>
              </div>
              {/* Day access code editor */}
              <DayCodeEditor
                currentCode={d.code ?? ''}
                busy={busy}
                onSave={(code) => run(() => adminSetDayCode(secret, d.day, code))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Challenges (with flags + preview) */}
      <section className="mt-6 rounded-xl border border-terminal-border bg-terminal-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">
            ▸ Challenges & flags
          </h2>
          <button
            onClick={() => setShowFlags((s) => !s)}
            className="rounded border border-terminal-border px-3 py-1 text-xs text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
          >
            {showFlags ? '🙈 Hide flags' : '👁 Reveal flags'}
          </button>
        </div>
        <div className="space-y-3">
          {challenges.map((c: AdminChallenge) => (
            <ChallengeAdminCard key={c.id} c={c} showFlags={showFlags} />
          ))}
        </div>
        <p className="mt-4 text-[11px] text-terminal-dim">
          Tip: to add challenges to any day, insert rows in the Supabase <code className="text-terminal-green">challenges</code> table and
          set their <code className="text-terminal-green">day</code> number.
        </p>
      </section>

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
    </div>
  );
}

function Tile({
  label,
  value,
  valueClass = 'text-terminal-green',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel px-4 py-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-terminal-dim">{label}</div>
      <div className={`mt-1 text-lg font-extrabold ${valueClass}`}>{value}</div>
    </div>
  );
}

function DayCodeEditor({
  currentCode,
  busy,
  onSave,
}: {
  currentCode: string;
  busy: boolean;
  onSave: (code: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(currentCode);

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-terminal-dim">
          Access code: {currentCode ? <code className="text-terminal-amber">{currentCode}</code> : <span className="italic">none (open)</span>}
        </span>
        <button
          onClick={() => { setCode(currentCode); setEditing(true); }}
          className="text-[11px] text-terminal-cyan underline decoration-dotted hover:text-terminal-green"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Leave empty to remove code"
        className="flex-1 rounded border border-terminal-border bg-terminal-input px-2 py-1 text-xs text-terminal-green outline-none focus:border-terminal-green"
      />
      <button
        disabled={busy}
        onClick={() => { onSave(code); setEditing(false); }}
        className="rounded border border-terminal-green/60 bg-terminal-green/10 px-2 py-1 text-[11px] font-bold text-terminal-green hover:bg-terminal-green/20"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded border border-terminal-border px-2 py-1 text-[11px] text-terminal-dim hover:text-terminal-red"
      >
        Cancel
      </button>
    </div>
  );
}

function ChallengeAdminCard({ c, showFlags }: { c: AdminChallenge; showFlags: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-input/40">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-terminal-green/5"
      >
        <span className="w-8 text-center text-xs tabular-nums text-terminal-dim">D{c.day}</span>
        <span className="flex-1 font-semibold text-terminal-green">{c.title}</span>
        <span className={`text-xs font-bold uppercase ${diffColor[c.difficulty]}`}>{c.difficulty}</span>
        <span className="w-12 text-right tabular-nums text-terminal-amber">{c.points}</span>
        <span className="w-12 text-right text-xs tabular-nums text-terminal-dim">{c.solves_count} ★</span>
        <span className="text-xs text-terminal-red">
          {c.first_blood_by ? `🩸 ${c.first_blood_by}` : '—'}
        </span>
        <span className="text-terminal-dim">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="border-t border-terminal-border/60 px-4 py-3 space-y-3">
          {/* Prompt preview */}
          <div>
            <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-terminal-dim">Prompt preview</h4>
            <div className="rounded border border-terminal-border bg-terminal-bg p-3">
              <Prompt text={c.prompt ?? ''} className="text-sm text-terminal-green/90" />
            </div>
          </div>

          {/* Flag */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-terminal-dim">Flag:</span>
            <code className="rounded bg-terminal-input px-2 py-0.5 text-xs text-terminal-green">
              {showFlags ? c.flag : '••••••••'}
            </code>
          </div>

          {/* Hints */}
          {c.hints && c.hints.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-terminal-dim">Hints</h4>
              <ul className="space-y-1">
                {c.hints.map((h) => (
                  <li key={h.n} className="rounded border border-terminal-amber/20 bg-terminal-amber/5 px-3 py-1.5 text-xs">
                    <span className="font-bold text-terminal-amber">#{h.n} (−{h.penalty}pts):</span>{' '}
                    <span className="text-terminal-green/80">{h.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          <div className="flex gap-3 text-xs">
            {c.asset_url && (
              <span className="text-terminal-cyan">📎 {c.asset_url}</span>
            )}
            {c.action_url && (
              <span className="text-terminal-cyan">🔗 {c.action_url}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
