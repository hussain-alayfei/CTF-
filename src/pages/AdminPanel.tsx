import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminDeleteAllPlayers,
  adminDeletePlayer,
  adminListPlayers,
  adminOverview,
  adminReset,
  adminSetActiveDay,
  adminSetDay,
  adminSetDayCode,
  adminSetFreeze,
  adminSetPlayerExcluded,
  adminStartEvent,
  adminStopEvent,
} from '../lib/api';
import { formatDuration, getEventState } from '../lib/time';
import type { AdminChallenge, AdminDay, AdminOverview, AdminPlayer } from '../lib/types';
import { useApp } from '../lib/app-context';
import { clearPlayer } from '../lib/session';
import Prompt from '../components/Prompt';
import Register from '../components/Register';

const diffColor: Record<string, string> = {
  easy: 'text-terminal-green',
  medium: 'text-terminal-amber',
  hard: 'text-terminal-red',
  danger: 'text-fuchsia-400',
};

const TAB_KEY = 'kgsp_ctf_admin_tab';
const MUSIC_URL_KEY = 'kgsp_ctf_music_url';

type TabId = 'event' | 'activeday' | 'music' | 'days' | 'players' | 'challenges';

const TABS: { id: TabId; label: string }[] = [
  { id: 'event', label: 'Event Control' },
  { id: 'activeday', label: 'Active Day' },
  { id: 'music', label: 'Music' },
  { id: 'days', label: 'Days' },
  { id: 'players', label: 'Players' },
  { id: 'challenges', label: 'Challenges' },
];

export default function AdminPanel() {
  const { player, setPlayer, theme, toggleTheme } = useApp();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeDaySel, setActiveDaySel] = useState<number | ''>('');
  const [showFlags, setShowFlags] = useState(false);
  const [autoLockMin, setAutoLockMin] = useState<number | null>(null);

  // Duration & freeze as local string state — synced from server only on genuine changes
  const [minutesStr, setMinutesStr] = useState('35');
  const [freezeStr, setFreezeStr] = useState('15');
  const lastServerMinutes = useRef<number | null>(null);
  const lastServerFreeze = useRef<number | null>(null);

  // Tab state persisted in localStorage
  const [tab, setTab] = useState<TabId>(() => {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved && TABS.some((t) => t.id === saved)) return saved as TabId;
    return 'event';
  });

  function switchTab(id: TabId) {
    setTab(id);
    localStorage.setItem(TAB_KEY, id);
  }

  // Ref for MusicPlayer so we can auto-play on event start
  const musicRef = useRef<MusicPlayerHandle>(null);

  // Cache: avoid re-fetching when switching tabs
  const cacheRef = useRef<{ data: AdminOverview | null; players: AdminPlayer[] }>({
    data: null,
    players: [],
  });

  const autoLockState = useRef<{ endsAt: string; interval: number } | null>(null);

  const secret = player?.admin_token ?? '';

  const load = useCallback(async () => {
    if (!secret) return;
    const res = await adminOverview(secret);
    if (res.error) {
      setMsg({ ok: false, text: res.message ?? 'Could not load the dashboard.' });
      return;
    }
    setData(res);
    cacheRef.current.data = res;

    if (res.event) {
      // Sync duration only when server value genuinely changed
      const serverMin = res.event.duration_minutes ?? 35;
      if (lastServerMinutes.current === null || lastServerMinutes.current !== serverMin) {
        lastServerMinutes.current = serverMin;
        setMinutesStr(String(serverMin));
      }
      const serverFreeze = res.event.freeze_minutes ?? 15;
      if (lastServerFreeze.current === null || lastServerFreeze.current !== serverFreeze) {
        lastServerFreeze.current = serverFreeze;
        setFreezeStr(String(serverFreeze));
      }
      setActiveDaySel(res.event.active_day ?? '');
    }
    try {
      const pl = await adminListPlayers(secret);
      if (pl.players) {
        setPlayers(pl.players);
        cacheRef.current.players = pl.players;
      }
    } catch {
      /* ignore roster errors */
    }
  }, [secret]);

  useEffect(() => {
    if (secret) void load();
  }, [secret, load]);

  useEffect(() => {
    if (!secret) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [secret, load]);

  // Auto-lock the active day 30 minutes after event ends
  useEffect(() => {
    const endsAt = data?.event?.ends_at;
    const activeD = data?.event?.active_day;
    const eventIsEnded = !!endsAt && Date.now() >= Date.parse(endsAt);

    if (!eventIsEnded || !endsAt || activeD == null) {
      if (autoLockState.current) {
        clearInterval(autoLockState.current.interval);
        autoLockState.current = null;
      }
      setAutoLockMin(null);
      return;
    }

    if (autoLockState.current?.endsAt === endsAt) return;
    if (autoLockState.current) clearInterval(autoLockState.current.interval);

    const lockTime = Date.parse(endsAt) + 30 * 60 * 1000;

    const tick = () => {
      const rem = Math.max(0, Math.ceil((lockTime - Date.now()) / 60000));
      setAutoLockMin(rem);
      if (rem === 0) {
        if (autoLockState.current) clearInterval(autoLockState.current.interval);
        autoLockState.current = null;
        void adminSetDay(secret, activeD, false).then(() => void load());
      }
    };

    tick();
    const interval = window.setInterval(tick, 30_000);
    autoLockState.current = { endsAt, interval };

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.event?.ends_at, data?.event?.active_day, secret]);

  function logout() {
    clearPlayer();
    setPlayer(null);
  }

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
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error.' });
    } finally {
      setBusy(false);
    }
  }

  const state = getEventState(data?.event ?? null);
  const isIdle = state.status === 'idle';
  const isRunning = state.status === 'running';
  const isEnded = state.status === 'ended';
  const statusLabel = isRunning ? 'RUNNING' : isEnded ? 'ENDED' : 'NOT STARTED';
  const statusColor = isRunning ? 'text-terminal-green' : isEnded ? 'text-terminal-red' : 'text-terminal-amber';

  // Accurate stats: active players = non-excluded, solves from non-excluded
  const activePlayers = players.filter((p) => !p.exclude_from_board);
  const activePlayerCount = activePlayers.length;
  const activeSolves = activePlayers.reduce((sum, p) => sum + p.solves_count, 0);

  // Parse duration for start button
  const parsedMinutes = parseInt(minutesStr, 10);
  const validMinutes = !isNaN(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : 35;
  const parsedFreeze = parseInt(freezeStr, 10);
  const validFreeze = !isNaN(parsedFreeze) && parsedFreeze >= 0 ? parsedFreeze : 15;

  // Not logged in
  if (!player) return <Register />;

  // Not an admin
  if (!player.is_admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-4xl">🚫</div>
        <h1 className="mt-3 text-xl font-extrabold text-terminal-red">Instructors only</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          This page is for course instructors. Head back to the arena to keep playing.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg border border-terminal-green px-4 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/10"
        >
          ‹ Back to the arena
        </Link>
      </div>
    );
  }

  const challenges = data?.challenges ?? [];
  const days = data?.days ?? [];

  const dayTitle = new Map(days.map((d) => [d.day, d.title]));
  const challengeDayGroups = [...challenges
    .reduce((map, c) => {
      const arr = map.get(c.day) ?? [];
      arr.push(c);
      return map.set(c.day, arr);
    }, new Map<number, AdminChallenge[]>())
    .entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({ day, title: dayTitle.get(day) ?? `Day ${day}`, list }));

  // Days split into Week 1 (3-5) and Week 2 (6-10)
  const week1Days = days.filter((d) => d.day >= 3 && d.day <= 5);
  const week2Days = days.filter((d) => d.day >= 6 && d.day <= 10);

  function handleStartEvent() {
    run(async () => {
      const res = await adminStartEvent(secret, validMinutes);
      // Auto-start music
      musicRef.current?.play();
      return res;
    }, isRunning
      ? `An event is already running. Restart it now with a fresh ${validMinutes}-minute timer? Progress so far is kept, but the clock resets.`
      : undefined);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
        >
          ‹ back to the arena
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/board"
            className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan transition hover:bg-terminal-cyan/10"
          >
            🖥 Present board
          </Link>
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-terminal-border px-3 py-2 text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={logout}
            className="rounded-lg border border-terminal-border px-3 py-2 text-sm font-bold text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
          >
            Sign out
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-extrabold text-terminal-green">🛠 Instructor Dashboard</h1>

      {/* Action result message */}
      {msg && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-center text-sm font-semibold ${
            msg.ok
              ? 'border border-terminal-green/60 bg-terminal-green/10 text-terminal-green'
              : 'border border-terminal-red/60 bg-terminal-red/10 text-terminal-red'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Stats tiles */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile label="Status" value={statusLabel} valueClass={statusColor} />
        <Tile label="Active players" value={String(activePlayerCount)} />
        <Tile label="Total solves" value={String(activeSolves)} />
      </div>

      {/* Tab bar */}
      <div className="mt-6 flex gap-1 border-b border-terminal-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition ${
              tab === t.id
                ? 'border-b-2 border-terminal-green text-terminal-green'
                : 'text-terminal-dim hover:text-terminal-green/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === 'event' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-terminal-cyan">
              ▸ Event Control
            </h2>

            {/* Big status banner */}
            <StatusBanner
              status={state.status}
              endsAt={data?.event?.ends_at ?? null}
              remainingMs={state.remainingMs}
            />

            {/* Auto-lock countdown */}
            {isEnded && autoLockMin !== null && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-terminal-amber/40 bg-terminal-amber/5 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-terminal-amber">
                    ⏳ Active day auto-locks in ~{autoLockMin} minute{autoLockMin === 1 ? '' : 's'}
                  </div>
                  <div className="text-[11px] text-terminal-dim">
                    30 minutes after the event ended — or lock it now to start fresh.
                  </div>
                </div>
                <button
                  disabled={busy || data?.event?.active_day == null}
                  onClick={() =>
                    run(
                      () => adminSetDay(secret, data!.event!.active_day!, false),
                      'Lock the active day now?',
                    )
                  }
                  className="ml-4 shrink-0 rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-40"
                >
                  Lock now
                </button>
              </div>
            )}

            {/* Duration & freeze inputs side by side */}
            <div className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
                  Duration (minutes)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minutesStr}
                  onChange={(e) => setMinutesStr(e.target.value)}
                  className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-2.5 text-terminal-green outline-none focus:border-terminal-green"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-terminal-dim">
                  Score freeze (final minutes)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={freezeStr}
                    onChange={(e) => setFreezeStr(e.target.value)}
                    className="w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-2.5 text-terminal-green outline-none focus:border-terminal-green"
                  />
                  <button
                    disabled={busy}
                    onClick={() => run(() => adminSetFreeze(secret, validFreeze))}
                    className="whitespace-nowrap rounded-lg border border-terminal-cyan/60 bg-terminal-cyan/10 px-3 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-cyan transition hover:bg-terminal-cyan/20 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-terminal-dim">
              On the projector board (<code className="text-terminal-cyan">/board</code>), scores hide during
              the final <strong className="text-terminal-amber">{validFreeze}</strong> minute
              {validFreeze === 1 ? '' : 's'} to keep the finish a surprise, then reveal when time ends. Set
              to <strong>0</strong> to keep the board live the whole round.
            </p>

            {/* Action buttons */}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                disabled={busy}
                onClick={handleStartEvent}
                className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
              >
                {isRunning ? `🔁 Restart with ${validMinutes}-min timer` : `▶ Start ${validMinutes}-min event`}
              </button>
              <button
                disabled={busy || !isRunning}
                onClick={() => run(() => adminStopEvent(secret), 'Stop the event now for everyone?')}
                title={!isRunning ? 'Nothing is running right now.' : undefined}
                className="rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-40"
              >
                ⏹ Stop now
              </button>
              <button
                disabled={busy || isIdle}
                onClick={() =>
                  run(
                    () => adminReset(secret),
                    'Reset ALL scores and clear the timer? Players keep their names but lose all solves. Do this before starting a brand-new round.',
                  )
                }
                title={isIdle ? 'Nothing to reset — no event has been started.' : undefined}
                className="rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20 disabled:opacity-40"
              >
                ⟲ Reset game
              </button>
            </div>
          </section>
        )}

        {tab === 'activeday' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <h2 className="mb-2 font-bold uppercase tracking-widest text-terminal-cyan">
              ▸ Active Day (Leaderboard)
            </h2>
            <p className="mb-4 text-xs text-terminal-dim">
              Students only see the leaderboard for this day. When a day finishes, switch to the next
              one to start its board fresh — past days&apos; scores are never lost and can still be
              browsed from the leaderboard&apos;s day selector.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={activeDaySel}
                onChange={(e) => setActiveDaySel(Number(e.target.value))}
                className="rounded-lg border border-terminal-border bg-terminal-input px-3 py-2.5 text-sm text-terminal-green outline-none focus:border-terminal-green"
              >
                <option value="" disabled>
                  Choose a day…
                </option>
                {days.map((d) => (
                  <option key={d.day} value={d.day}>
                    {d.title}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || activeDaySel === ''}
                onClick={() =>
                  run(
                    () => adminSetActiveDay(secret, Number(activeDaySel)),
                    'Switch the live leaderboard to this day?',
                  )
                }
                className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-40"
              >
                Set active day
              </button>
              <span className="text-xs text-terminal-dim">
                Currently live:{' '}
                <strong className="text-terminal-green">
                  {days.find((d) => d.day === data?.event?.active_day)?.title ??
                    `Day ${data?.event?.active_day ?? '—'}`}
                </strong>
              </span>
            </div>
          </section>
        )}

        {tab === 'music' && <MusicPlayer ref={musicRef} />}

        {tab === 'days' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <h2 className="mb-4 font-bold uppercase tracking-widest text-terminal-cyan">▸ Days</h2>
            <DaysWeekGroup
              label="Week 1 (Days 3–5)"
              days={week1Days}
              busy={busy}
              secret={secret}
              run={run}
            />
            <DaysWeekGroup
              label="Week 2 (Days 6–10)"
              days={week2Days}
              busy={busy}
              secret={secret}
              run={run}
              className="mt-4"
            />
          </section>
        )}

        {tab === 'players' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <PlayersSection
              players={players}
              busy={busy}
              onToggleExclude={(id, name, excluded) =>
                run(
                  () => adminSetPlayerExcluded(secret, id, excluded),
                  excluded
                    ? `Hide "${name}" from the leaderboard, projector board, and live feed? Their account and solves are kept — this just stops a test account from showing up in the competition.`
                    : `Show "${name}" on the leaderboard again?`,
                )
              }
              onDelete={(id, name) =>
                run(
                  () => adminDeletePlayer(secret, id),
                  `Delete player "${name}"? This removes their account and all solves. This cannot be undone.`,
                )
              }
              onDeleteAll={() =>
                run(
                  () => adminDeleteAllPlayers(secret),
                  'Delete ALL players and their solves? Everyone will be signed out and must register again. This cannot be undone.',
                )
              }
            />
          </section>
        )}

        {tab === 'challenges' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
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
              {challengeDayGroups.length === 0 ? (
                <p className="text-sm text-terminal-dim">No challenges yet.</p>
              ) : (
                challengeDayGroups.map((g) => (
                  <ChallengeDayGroup
                    key={g.day}
                    title={g.title}
                    challenges={g.list}
                    showFlags={showFlags}
                  />
                ))
              )}
            </div>
            <p className="mt-4 text-[11px] text-terminal-dim">
              Tip: to add challenges to any day, insert rows in the Supabase{' '}
              <code className="text-terminal-green">challenges</code> table and set their{' '}
              <code className="text-terminal-green">day</code> number.
            </p>
          </section>
        )}
      </div>

      {/* MusicPlayer always mounted (hidden) so ref stays alive for auto-play */}
      {tab !== 'music' && (
        <div className="hidden">
          <MusicPlayer ref={musicRef} />
        </div>
      )}
    </div>
  );
}

// ---- Expandable week group for Days section ----
function DaysWeekGroup({
  label,
  days,
  busy,
  secret,
  run: runAction,
  className = '',
}: {
  label: string;
  days: AdminDay[];
  busy: boolean;
  secret: string;
  run: (
    action: () => Promise<{ error?: string; message?: string }>,
    confirmText?: string,
  ) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  if (days.length === 0) return null;

  return (
    <div className={className}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center gap-2 text-left text-sm font-bold text-terminal-green transition hover:text-terminal-green/80"
      >
        <span className={`text-terminal-dim transition-transform ${open ? 'rotate-90' : ''}`}>
          ▸
        </span>
        {label}
        <span className="text-xs font-normal text-terminal-dim">({days.length} days)</span>
      </button>
      {open && (
        <div className="space-y-3 pl-2">
          {days.map((d: AdminDay) => {
            const autoCode = generateDayCode(d);
            return (
              <div
                key={d.day}
                className="rounded-lg border border-terminal-border bg-terminal-input/50 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {d.is_rest && <span title="Rest day">😴</span>}
                    <div>
                      <div className="font-bold text-terminal-green">{d.title}</div>
                      {d.subtitle && (
                        <div className="text-xs text-terminal-dim">{d.subtitle}</div>
                      )}
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
                      onClick={() =>
                        runAction(() => adminSetDay(secret, d.day, !d.is_open))
                      }
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
                <DayCodeEditor
                  currentCode={d.code ?? ''}
                  suggestedCode={autoCode}
                  busy={busy}
                  onSave={(code) => runAction(() => adminSetDayCode(secret, d.day, code))}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Generate a default access code like "PRIVACY-2026" from the day title. */
function generateDayCode(day: AdminDay): string {
  const keywords: Record<string, string> = {
    privacy: 'PRIVACY',
    pentesting: 'PENTESTING',
    'pen testing': 'PENTESTING',
    forensics: 'FORENSICS',
    crypto: 'CRYPTO',
    cryptography: 'CRYPTO',
    network: 'NETWORK',
    networking: 'NETWORK',
    web: 'WEB',
    osint: 'OSINT',
    reverse: 'REVERSE',
    malware: 'MALWARE',
    defense: 'DEFENSE',
    steganography: 'STEGO',
    stego: 'STEGO',
    misc: 'MISC',
    binary: 'BINARY',
    pwn: 'PWN',
    exploit: 'EXPLOIT',
  };
  const titleLower = day.title.toLowerCase();
  for (const [key, code] of Object.entries(keywords)) {
    if (titleLower.includes(key)) return `${code}-2026`;
  }
  const word = day.title
    .replace(/^day\s*\d+[\s:–-]*/i, '')
    .split(/\s+/)[0]
    ?.toUpperCase();
  return word ? `${word}-2026` : `DAY${day.day}-2026`;
}

// ---- Big status banner ----
function StatusBanner({
  status,
  endsAt,
  remainingMs,
}: {
  status: 'idle' | 'running' | 'ended';
  endsAt: string | null;
  remainingMs: number;
}) {
  if (status === 'running') {
    const endsLabel = endsAt ? new Date(endsAt).toLocaleTimeString() : '—';
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-terminal-green/60 bg-terminal-green/10 px-5 py-4 shadow-neon">
        <div>
          <div className="text-base font-extrabold uppercase tracking-widest text-terminal-green">
            🟢 LIVE — players can submit flags right now
          </div>
          <div className="mt-1 text-xs text-terminal-dim">Ends at {endsLabel}</div>
        </div>
        <div className="text-3xl font-extrabold tabular-nums text-terminal-green">
          {formatDuration(remainingMs)}
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="rounded-lg border-2 border-terminal-red/60 bg-terminal-red/10 px-5 py-4">
        <div className="text-base font-extrabold uppercase tracking-widest text-terminal-red">
          🔴 ENDED — players see &quot;Time&apos;s up&quot;
        </div>
        <div className="mt-1 text-xs text-terminal-dim">
          Click <strong className="text-terminal-red">Reset game</strong> to clear this before
          starting a new round, or <strong className="text-terminal-green">Start</strong> to begin
          fresh immediately.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-terminal-amber/50 bg-terminal-amber/10 px-5 py-4">
      <div className="text-base font-extrabold uppercase tracking-widest text-terminal-amber">
        ⏳ NOT STARTED — players see &quot;Waiting to start&quot;
      </div>
      <div className="mt-1 text-xs text-terminal-dim">
        Click <strong className="text-terminal-green">Start</strong> below when you&apos;re ready to
        begin the round.
      </div>
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
  suggestedCode,
  busy,
  onSave,
}: {
  currentCode: string;
  suggestedCode?: string;
  busy: boolean;
  onSave: (code: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(currentCode);

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-terminal-dim">
          Access code:{' '}
          {currentCode ? (
            <code className="text-terminal-amber">{currentCode}</code>
          ) : suggestedCode ? (
            <span className="italic text-terminal-dim">
              none —{' '}
              <button
                onClick={() => onSave(suggestedCode)}
                disabled={busy}
                className="text-terminal-cyan underline decoration-dotted hover:text-terminal-green"
              >
                auto-set {suggestedCode}
              </button>
            </span>
          ) : (
            <span className="italic">none (open)</span>
          )}
        </span>
        <button
          onClick={() => {
            setCode(currentCode);
            setEditing(true);
          }}
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
        onClick={() => {
          onSave(code);
          setEditing(false);
        }}
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

function ChallengeDayGroup({
  title,
  challenges,
  showFlags,
}: {
  title: string;
  challenges: AdminChallenge[];
  showFlags: boolean;
}) {
  const [open, setOpen] = useState(true);
  const solved = challenges.reduce((n, c) => n + c.solves_count, 0);

  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-input/20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-terminal-green/5"
      >
        <span className="flex items-center gap-2 font-bold text-terminal-green">
          <span className={`text-terminal-dim transition-transform ${open ? 'rotate-90' : ''}`}>
            ▸
          </span>
          {title}
        </span>
        <span className="flex items-center gap-3 text-[11px] text-terminal-dim">
          <span>
            {challenges.length} challenge{challenges.length === 1 ? '' : 's'}
          </span>
          <span>{solved} ★ solves</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-terminal-border/60 p-3">
          {challenges.map((c) => (
            <ChallengeAdminCard key={c.id} c={c} showFlags={showFlags} />
          ))}
        </div>
      )}
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
        <span className="flex-1 font-semibold text-terminal-green">{c.title}</span>
        {c.is_extra && (
          <span className="rounded border border-terminal-cyan/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-terminal-cyan">
            🎁 extra
          </span>
        )}
        <span className={`text-xs font-bold uppercase ${diffColor[c.difficulty]}`}>
          {c.difficulty}
        </span>
        <span className="w-12 text-right tabular-nums text-terminal-amber">{c.points}</span>
        <span className="w-12 text-right text-xs tabular-nums text-terminal-dim">
          {c.solves_count} ★
        </span>
        <span className="text-xs text-terminal-red">
          {c.first_blood_by ? `🩸 ${c.first_blood_by}` : '—'}
        </span>
        <span className="text-terminal-dim">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-terminal-border/60 px-4 py-3">
          <div>
            <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-terminal-dim">
              Prompt preview
            </h4>
            <div className="rounded border border-terminal-border bg-terminal-bg p-3">
              <Prompt text={c.prompt ?? ''} className="text-sm text-terminal-green/90" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-terminal-dim">
              Flag:
            </span>
            <code className="rounded bg-terminal-input px-2 py-0.5 text-xs text-terminal-green">
              {showFlags ? c.flag : '••••••••'}
            </code>
          </div>

          {c.suggested_tool && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-widest text-terminal-dim">
                Suggested tool:
              </span>
              <span className="text-terminal-cyan">🧰 {c.suggested_tool}</span>
            </div>
          )}

          {c.hints && c.hints.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-terminal-dim">
                Hints
              </h4>
              <ul className="space-y-1">
                {c.hints.map((h) => (
                  <li
                    key={h.n}
                    className="rounded border border-terminal-amber/20 bg-terminal-amber/5 px-3 py-1.5 text-xs"
                  >
                    <span className="font-bold text-terminal-amber">
                      #{h.n} (−{h.penalty}pts):
                    </span>{' '}
                    <span className="text-terminal-green/80">{h.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 text-xs">
            {c.asset_url && <span className="text-terminal-cyan">📎 {c.asset_url}</span>}
            {c.action_url && <span className="text-terminal-cyan">🔗 {c.action_url}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Players management ----
function PlayersSection({
  players,
  busy,
  onToggleExclude,
  onDelete,
  onDeleteAll,
}: {
  players: AdminPlayer[];
  busy: boolean;
  onToggleExclude: (id: string, name: string, excluded: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onDeleteAll: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = players.filter((p) =>
    p.username.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">
          ▸ Players ({players.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username…"
            className="rounded-lg border border-terminal-border bg-terminal-input px-3 py-1.5 text-sm text-terminal-green outline-none focus:border-terminal-green"
          />
          <button
            disabled={busy || players.length === 0}
            onClick={onDeleteAll}
            title="Delete every player and their solves"
            className="whitespace-nowrap rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20 disabled:opacity-40"
          >
            🗑 Delete all
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-terminal-dim">
          {players.length === 0
            ? 'No players have registered yet.'
            : 'No players match your search.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => {
            const isOpen = openId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-lg border border-terminal-border bg-terminal-input/40"
              >
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-center text-xs tabular-nums text-terminal-dim">
                    {i + 1}
                  </span>
                  <span className="text-lg">{p.avatar}</span>
                  <button
                    onClick={() => setOpenId(isOpen ? null : p.id)}
                    className="flex-1 truncate text-left font-semibold text-terminal-green hover:underline"
                  >
                    {p.username}
                  </button>
                  {p.exclude_from_board && (
                    <span className="shrink-0 rounded border border-terminal-amber/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-terminal-amber">
                      🙈 hidden
                    </span>
                  )}
                  <span className="w-16 text-right text-xs tabular-nums text-terminal-dim">
                    {p.solves_count} solves
                  </span>
                  {p.first_bloods > 0 && (
                    <span className="text-xs text-terminal-red">🩸 {p.first_bloods}</span>
                  )}
                  <span className="w-16 text-right font-bold tabular-nums text-terminal-amber">
                    {p.total_points}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => onToggleExclude(p.id, p.username, !p.exclude_from_board)}
                    title={
                      p.exclude_from_board
                        ? 'Hidden from the competition — click to show on the leaderboard'
                        : 'Hide this (test) account from the leaderboard, board & feed'
                    }
                    className={`rounded border px-2 py-1 text-[11px] font-bold transition disabled:opacity-40 ${
                      p.exclude_from_board
                        ? 'border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/15'
                        : 'border-terminal-border text-terminal-dim hover:border-terminal-cyan hover:text-terminal-cyan'
                    }`}
                  >
                    {p.exclude_from_board ? '🙈' : '👁'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onDelete(p.id, p.username)}
                    title="Delete player"
                    className="rounded border border-terminal-red/50 px-2 py-1 text-[11px] font-bold text-terminal-red transition hover:bg-terminal-red/15 disabled:opacity-40"
                  >
                    🗑
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-terminal-border/60 px-4 py-3 text-xs">
                    <div className="mb-2 flex flex-wrap gap-4 text-terminal-dim">
                      <span>
                        Score: <span className="text-terminal-amber">{p.total_points}</span>
                      </span>
                      <span>
                        Solves: <span className="text-terminal-green">{p.solves_count}</span>
                      </span>
                      <span>
                        First bloods: <span className="text-terminal-red">{p.first_bloods}</span>
                      </span>
                      <span>Joined: {new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    {p.solves.length === 0 ? (
                      <p className="text-terminal-dim">No solves yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {p.solves.map((s) => (
                          <li
                            key={s.challenge_id}
                            className="flex items-center justify-between"
                          >
                            <span className="text-terminal-green">
                              {s.first_blood && <span className="mr-1">🩸</span>}
                              {s.challenge_id}
                            </span>
                            <span className="text-terminal-dim">
                              +{s.points} · {new Date(s.solved_at).toLocaleTimeString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- YouTube background music player (admin device only) ----

interface MusicPlayerHandle {
  play: () => void;
}

/** Extract a YouTube video ID and optional start-time from any YouTube URL. */
function parseYoutubeUrl(raw: string): { id: string; start?: number } | null {
  try {
    const u = new URL(raw.trim());
    let id: string | null = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.slice(1).split(/[?#]/)[0];
    } else {
      id = u.searchParams.get('v');
      if (!id) {
        const m = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (m) id = m[1];
      }
    }
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
    const t = u.searchParams.get('t');
    const start = t ? parseInt(t.replace(/[^0-9]/g, ''), 10) : undefined;
    return { id, start: start && !isNaN(start) ? start : undefined };
  } catch {
    return null;
  }
}

import { forwardRef, useImperativeHandle } from 'react';

const MusicPlayer = forwardRef<MusicPlayerHandle>(function MusicPlayer(_props, ref) {
  const [url, setUrl] = useState(() => localStorage.getItem(MUSIC_URL_KEY) ?? '');
  const [playing, setPlaying] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [startSec, setStartSec] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function saveUrl(next: string) {
    setUrl(next);
    localStorage.setItem(MUSIC_URL_KEY, next);
    setError(null);
  }

  function ytCmd(func: string) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }),
      '*',
    );
  }

  function play() {
    const parsed = parseYoutubeUrl(url);
    if (!parsed) {
      setError(
        'Could not find a YouTube video ID in that URL. Try: https://www.youtube.com/watch?v=...',
      );
      return;
    }
    setError(null);
    if (videoId === parsed.id) {
      ytCmd('playVideo');
      setPlaying(true);
    } else {
      setVideoId(parsed.id);
      setStartSec(parsed.start);
      setPlaying(true);
    }
  }

  function pause() {
    ytCmd('pauseVideo');
    setPlaying(false);
  }

  function stop() {
    ytCmd('stopVideo');
    setVideoId(null);
    setStartSec(undefined);
    setPlaying(false);
  }

  useImperativeHandle(ref, () => ({ play }));

  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&loop=1&playlist=${videoId}${startSec ? `&start=${startSec}` : ''}`
    : null;

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
      <h2 className="mb-2 font-bold uppercase tracking-widest text-terminal-cyan">
        ▸ Competition music
      </h2>
      <p className="mb-3 text-xs text-terminal-dim">
        Paste a YouTube video URL. Plays on this device only — great for the room speakers. The
        video plays in the background; only audio is heard.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => saveUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="min-w-[16rem] flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-sm text-terminal-green outline-none focus:border-terminal-green"
        />
        {!playing ? (
          <button
            onClick={play}
            disabled={!url.trim()}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-40"
          >
            ▶ Play
          </button>
        ) : (
          <button
            onClick={pause}
            className="rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-4 py-2 text-sm font-bold text-terminal-amber transition hover:bg-terminal-amber/20"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={stop}
          disabled={!videoId}
          className="rounded-lg border border-terminal-red/50 bg-terminal-red/5 px-4 py-2 text-sm font-bold text-terminal-red/80 transition hover:bg-terminal-red/15 disabled:opacity-40"
        >
          ⏹ Stop
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-terminal-red">{error}</p>}
      {playing && videoId && (
        <p className="mt-2 text-[11px] text-terminal-green">
          ♪ Now playing — YouTube audio is active on this device.
        </p>
      )}

      {embedSrc && (
        <iframe
          key={videoId}
          ref={iframeRef}
          src={embedSrc}
          title="Background music"
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
    </section>
  );
});
