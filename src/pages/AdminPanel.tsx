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
  adminSetDayCompleted,
  adminSetFreeze,
  adminSetPlayerExcluded,
  adminStartEvent,
  adminStopEvent,
} from '../lib/api';
import { formatDuration, getEventState } from '../lib/time';
import type { AdminChallenge, AdminDay, AdminOverview, AdminPlayer, AdminPlayerSolve } from '../lib/types';
import { useApp } from '../lib/app-context';
import { clearPlayer } from '../lib/session';
import { getCache, setCache } from '../lib/cache';
import Prompt from '../components/Prompt';
import Register from '../components/Register';

const diffColor: Record<string, string> = {
  easy: 'text-terminal-green',
  medium: 'text-terminal-amber',
  hard: 'text-terminal-red',
  danger: 'text-fuchsia-400',
};

const TAB_KEY = 'kgsp_ctf_admin_tab';

// Merged from 5 tabs down to 3: Event Control absorbed Active Day (they're the
// same "run the round" mental task), and Days absorbed Challenges (a day's
// challenge list is just detail on that day). Players keeps its own tab but
// its label grows the live day number so instructors don't have to guess
// which day the roster below is scoped to.
type TabId = 'event' | 'days' | 'players';

const OLD_TAB_MIGRATION: Record<string, TabId> = {
  activeday: 'event',
  challenges: 'days',
};

export default function AdminPanel() {
  const { player, setPlayer, theme, toggleTheme } = useApp();
  // Seed from the session cache so the dashboard paints instantly on refresh /
  // re-entry; load() still fetches fresh data below and the 5s poll revalidates.
  const [data, setData] = useState<AdminOverview | null>(() => getCache<AdminOverview>('admin_overview'));
  const [players, setPlayers] = useState<AdminPlayer[]>(() => getCache<AdminPlayer[]>('admin_players') ?? []);
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

  // Tab state persisted in localStorage. Old saved values from the previous
  // 5-tab layout ('activeday', 'challenges') are transparently remapped to
  // their merged home so returning instructors don't land on a blank state.
  const [tab, setTab] = useState<TabId>(() => {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved === 'event' || saved === 'days' || saved === 'players') return saved;
    if (saved && saved in OLD_TAB_MIGRATION) return OLD_TAB_MIGRATION[saved];
    return 'event';
  });

  function switchTab(id: TabId) {
    setTab(id);
    localStorage.setItem(TAB_KEY, id);
  }

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
    // Cache WITHOUT secret flags/answers: sessionStorage is readable via DevTools
    // and this could be a shared/projector machine. The live fetch runs on mount
    // and restores the real flags in memory, so reveal still works.
    setCache('admin_overview', {
      ...res,
      challenges: res.challenges?.map((c) => ({ ...c, flag: '' })),
    });

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
        setCache('admin_players', pl.players);
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
      return await adminStartEvent(secret, validMinutes);
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

      {/* Tab bar — 3 tabs: Event Control (incl. Active Day), Days (incl.
          Challenges), Players (labeled with the live day number). */}
      <div className="mt-6 flex gap-1 border-b border-terminal-border">
        {(
          [
            { id: 'event' as TabId, label: 'Event Control' },
            { id: 'days' as TabId, label: 'Days & Challenges' },
            {
              id: 'players' as TabId,
              label:
                data?.event?.active_day != null ? `Players · Day ${data.event.active_day}` : 'Players',
            },
          ]
        ).map((t) => (
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

            {/* Active day picker — merged in from the old separate "Active Day"
                tab. This is the day players see as the "live" leaderboard and
                what Reset/Players are scoped to, so it lives right next to the
                status banner instead of being a click away in another tab. */}
            <div className="mt-4 rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/5 p-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-terminal-cyan">
                ▸ Active day (live leaderboard)
              </h3>
              <p className="mb-3 text-[11px] text-terminal-dim">
                Students only see the leaderboard for this day. Reset and the Players tab are also
                scoped to it. Past days&apos; scores are never lost when you switch.
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
                      {d.day === data?.event?.active_day ? ' · live' : ''}
                    </option>
                  ))}
                </select>
                <button
                  disabled={
                    busy ||
                    activeDaySel === '' ||
                    Number(activeDaySel) === data?.event?.active_day
                  }
                  onClick={() =>
                    run(
                      () => adminSetActiveDay(secret, Number(activeDaySel)),
                      'Switch the live leaderboard to this day?',
                    )
                  }
                  className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-40"
                >
                  {activeDaySel !== '' && Number(activeDaySel) === data?.event?.active_day
                    ? '✓ Currently live'
                    : 'Set active day'}
                </button>
                <span className="text-xs text-terminal-dim">
                  Currently live:{' '}
                  <strong className="text-terminal-green">
                    {days.find((d) => d.day === data?.event?.active_day)?.title ??
                      `Day ${data?.event?.active_day ?? '—'}`}
                  </strong>
                </span>
              </div>
            </div>

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
                disabled={busy || isIdle || data?.event?.active_day == null}
                onClick={() => {
                  const resetDay = data?.event?.active_day;
                  if (resetDay == null) return;
                  const dayName = days.find((d) => d.day === resetDay)?.title ?? `Day ${resetDay}`;
                  run(
                    () => adminReset(secret, resetDay),
                    `Reset scores for ${dayName} ONLY and clear the timer? Players keep their names but lose ${dayName}'s solves. Every other day's scores are untouched.`,
                  );
                }}
                title={
                  isIdle
                    ? 'Nothing to reset — no event has been started.'
                    : data?.event?.active_day == null
                      ? 'Set an active day first (above).'
                      : `Only clears ${days.find((d) => d.day === data?.event?.active_day)?.title ?? `Day ${data?.event?.active_day}`}'s scores.`
                }
                className="rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20 disabled:opacity-40"
              >
                ⟲ Reset {days.find((d) => d.day === data?.event?.active_day)?.title ?? 'active day'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-terminal-dim">
              ⟲ Reset only clears scores for the <strong className="text-terminal-red">currently active day</strong>{' '}
              (set above) — every other day's history is always safe.
            </p>
          </section>
        )}

        {tab === 'days' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">▸ Days & Challenges</h2>
              <button
                onClick={() => setShowFlags((s) => !s)}
                className="rounded border border-terminal-border px-3 py-1 text-xs text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
              >
                {showFlags ? '🙈 Hide flags' : '👁 Reveal flags'}
              </button>
            </div>
            <p className="mb-4 text-[11px] text-terminal-dim">
              Lock/unlock a day, set its access code, then expand it to see and manage that day's
              challenges & flags in the same place.
            </p>
            <DaysWeekGroup
              label="Week 1 (Days 3–5)"
              days={week1Days}
              busy={busy}
              secret={secret}
              run={run}
              challengesByDay={challengeDayGroups}
              showFlags={showFlags}
            />
            <DaysWeekGroup
              label="Week 2 (Days 6–10)"
              days={week2Days}
              busy={busy}
              secret={secret}
              run={run}
              challengesByDay={challengeDayGroups}
              showFlags={showFlags}
              className="mt-4"
            />
          </section>
        )}

        {tab === 'players' && (
          <section className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <PlayersSection
              players={players}
              challenges={challenges}
              days={days}
              activeDay={data?.event?.active_day ?? null}
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

      </div>

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
  challengesByDay,
  showFlags,
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
  challengesByDay: { day: number; title: string; list: AdminChallenge[] }[];
  showFlags: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

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
            const dayChallenges = challengesByDay.find((g) => g.day === d.day)?.list ?? [];
            return (
              <div
                key={d.day}
                className="rounded-lg border border-terminal-border bg-terminal-input/50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {d.is_rest && <span title="Rest day">😴</span>}
                    <div className="min-w-0">
                      <div className="truncate font-bold text-terminal-green">{d.title}</div>
                      {d.subtitle && (
                        <div className="truncate text-xs text-terminal-dim">{d.subtitle}</div>
                      )}
                    </div>
                  </div>
                  {/* Fixed-width columns keep the code badge, status pill and
                      Lock/Unlock button aligned across every row. */}
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="flex w-8 justify-center">
                      {d.requires_code && (
                        <span
                          title="Access code required"
                          className="rounded border border-terminal-amber/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-terminal-amber"
                        >
                          🔐
                        </span>
                      )}
                    </span>
                    <span
                      className={`w-20 text-center text-xs font-bold uppercase ${d.is_open ? 'text-terminal-green' : 'text-terminal-dim'}`}
                    >
                      {d.is_open ? '● Open' : '○ Locked'}
                    </span>
                    <button
                      disabled={busy}
                      title={
                        d.is_completed
                          ? 'Marked completed — always open for practice, never hidden before the clock starts. Click to unmark.'
                          : 'Mark this day completed so students can practice it any time (never fairness-blurred).'
                      }
                      onClick={() => runAction(() => adminSetDayCompleted(secret, d.day, !d.is_completed))}
                      className={`w-28 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition disabled:opacity-40 ${
                        d.is_completed
                          ? 'border-terminal-cyan/60 bg-terminal-cyan/10 text-terminal-cyan hover:bg-terminal-cyan/20'
                          : 'border-terminal-border text-terminal-dim hover:border-terminal-cyan/50 hover:text-terminal-cyan'
                      }`}
                    >
                      {d.is_completed ? '✓ Completed' : 'Mark done'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => runAction(() => adminSetDay(secret, d.day, !d.is_open))}
                      className={`w-24 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition disabled:opacity-40 ${
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
                {dayChallenges.length > 0 && (
                  <DayChallengesInline challenges={dayChallenges} showFlags={showFlags} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** This day's challenges & flags, nested right inside its own row — replaces
 * the old separate "Challenges" tab so instructors manage a day and its
 * challenges together instead of cross-referencing two tabs. */
function DayChallengesInline({
  challenges,
  showFlags,
}: {
  challenges: AdminChallenge[];
  showFlags: boolean;
}) {
  const [open, setOpen] = useState(false);
  const solved = challenges.reduce((n, c) => n + c.solves_count, 0);

  return (
    <div className="mt-3 border-t border-terminal-border/50 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left text-xs transition hover:text-terminal-green"
      >
        <span className="flex items-center gap-2 font-bold text-terminal-cyan">
          <span className={`text-terminal-dim transition-transform ${open ? 'rotate-90' : ''}`}>
            ▸
          </span>
          Challenges & flags
        </span>
        <span className="flex items-center gap-3 text-terminal-dim">
          <span>
            {challenges.length} challenge{challenges.length === 1 ? '' : 's'}
          </span>
          <span>{solved} ★ solves</span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {challenges.map((c) => (
            <ChallengeAdminCard key={c.id} c={c} showFlags={showFlags} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Generate a default access code like "PRIVACY-2026" from the day title. */
function generateDayCode(day: AdminDay): string {
  // Order matters: more specific keys must win over generic ones. "hacking"
  // maps to WEBHACK before the generic "web" so Day 7 "Web Applications" and
  // Day 8 "Web Application Hacking" no longer collide on the same WEB-2026 code.
  const keywords: [string, string][] = [
    ['application hacking', 'WEBHACK'],
    ['hacking', 'WEBHACK'],
    ['attack', 'WEBHACK'],
    ['privacy', 'PRIVACY'],
    ['pentesting', 'PENTESTING'],
    ['pen testing', 'PENTESTING'],
    ['forensics', 'FORENSICS'],
    ['cryptography', 'CRYPTO'],
    ['crypto', 'CRYPTO'],
    ['networking', 'NETWORK'],
    ['network', 'NETWORK'],
    ['blockchain', 'BLOCKCHAIN'],
    ['smart contract', 'SMART'],
    ['contract', 'SMART'],
    ['web', 'WEB'],
    ['osint', 'OSINT'],
    ['reverse', 'REVERSE'],
    ['malware', 'MALWARE'],
    ['defense', 'DEFENSE'],
    ['steganography', 'STEGO'],
    ['stego', 'STEGO'],
    ['misc', 'MISC'],
    ['binary', 'BINARY'],
    ['pwn', 'PWN'],
    ['exploit', 'EXPLOIT'],
  ];
  const titleLower = day.title.toLowerCase();
  for (const [key, code] of keywords) {
    if (titleLower.includes(key)) return `${code}-2026`;
  }
  // Fallback: strip a leading emoji/punctuation and any "Day N —" prefix, then
  // take the first real word (so an emoji-prefixed title never yields "⛓️-2026").
  const word = day.title
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/^day\s*\d+[\s:–-]*/i, '')
    .split(/\s+/)[0]
    ?.replace(/[^\p{L}\p{N}]/gu, '')
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
  challenges,
  days,
  activeDay,
  busy,
  onToggleExclude,
  onDelete,
  onDeleteAll,
}: {
  players: AdminPlayer[];
  challenges: AdminChallenge[];
  days: AdminDay[];
  activeDay: number | null;
  busy: boolean;
  onToggleExclude: (id: string, name: string, excluded: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onDeleteAll: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // challenge_id -> { day, title } so a player's solves can be grouped per day
  // and shown by challenge title instead of a raw id.
  const chMeta = new Map<string, { day: number; title: string }>();
  for (const c of challenges) chMeta.set(c.id, { day: c.day, title: c.title });

  const activeDayTitle = days.find((d) => d.day === activeDay)?.title ?? (activeDay != null ? `Day ${activeDay}` : null);

  // Per-player stats scoped to whichever day is currently live — this is what
  // the row summary (and the search list) shows by default now, instead of
  // an undifferentiated all-time total. The full per-day breakdown is still
  // one click away when a row is expanded.
  const activeDayStats = new Map<string, { points: number; solves: number; firstBloods: number }>();
  if (activeDay != null) {
    for (const p of players) {
      const dayPeriod = p.solves.filter((s) => chMeta.get(s.challenge_id)?.day === activeDay);
      activeDayStats.set(p.id, {
        points: dayPeriod.reduce((sum, s) => sum + s.points, 0),
        solves: dayPeriod.length,
        firstBloods: dayPeriod.filter((s) => s.first_blood).length,
      });
    }
  }

  const filtered = players.filter((p) =>
    p.username.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">
            ▸ Players ({players.length})
          </h2>
          <p className="mt-0.5 text-[11px] text-terminal-dim">
            {activeDay != null ? (
              <>
                Showing scores for{' '}
                <strong className="text-terminal-green">
                  Day {activeDay} — {activeDayTitle}
                </strong>{' '}
                (the currently live day). Expand a player for their full per-day history.
              </>
            ) : (
              'No active day is set — showing all-time totals. Set an active day in Event Control.'
            )}
          </p>
        </div>
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
            const dayStat = activeDayStats.get(p.id);
            const showDayScoped = activeDay != null && dayStat != null;
            const points = showDayScoped ? dayStat.points : p.total_points;
            const solvesCount = showDayScoped ? dayStat.solves : p.solves_count;
            const firstBloods = showDayScoped ? dayStat.firstBloods : p.first_bloods;
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
                  {showDayScoped && (
                    <span className="shrink-0 rounded border border-terminal-cyan/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-terminal-cyan">
                      Day {activeDay}
                    </span>
                  )}
                  <span className="w-16 text-right text-xs tabular-nums text-terminal-dim">
                    {solvesCount} solves
                  </span>
                  {firstBloods > 0 && (
                    <span className="text-xs text-terminal-red">🩸 {firstBloods}</span>
                  )}
                  <span className="w-16 text-right font-bold tabular-nums text-terminal-amber">
                    {points}
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
                    <div className="mb-3 flex flex-wrap gap-4 text-terminal-dim">
                      <span>
                        All-time score: <span className="text-terminal-amber">{p.total_points}</span>
                      </span>
                      <span>
                        All-time solves: <span className="text-terminal-green">{p.solves_count}</span>
                      </span>
                      <span>
                        All-time first bloods: <span className="text-terminal-red">{p.first_bloods}</span>
                      </span>
                      <span>Joined: {new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <PlayerSolvesByDay solves={p.solves} chMeta={chMeta} activeDay={activeDay} />
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

// Groups one player's solves by day so instructors see a per-day score
// breakdown (Day 3, Day 4, ...) with a subtotal, instead of a flat, day-less
// list of raw challenge ids.
function PlayerSolvesByDay({
  solves,
  chMeta,
  activeDay,
}: {
  solves: AdminPlayerSolve[];
  chMeta: Map<string, { day: number; title: string }>;
  activeDay?: number | null;
}) {
  if (solves.length === 0) {
    return <p className="text-terminal-dim">No solves yet.</p>;
  }
  const byDay = new Map<number, AdminPlayerSolve[]>();
  for (const s of solves) {
    const day = chMeta.get(s.challenge_id)?.day ?? 0;
    const arr = byDay.get(day) ?? [];
    arr.push(s);
    byDay.set(day, arr);
  }
  const groups = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <div className="space-y-3">
      {groups.map(([day, list]) => {
        const subtotal = list.reduce((sum, s) => sum + s.points, 0);
        const firstBloods = list.filter((s) => s.first_blood).length;
        const isLive = activeDay != null && day === activeDay;
        return (
          <div
            key={day}
            className={`overflow-hidden rounded-lg border bg-terminal-bg/40 ${
              isLive ? 'border-terminal-cyan/50' : 'border-terminal-border/60'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-3 py-1.5 ${
                isLive ? 'border-terminal-cyan/30 bg-terminal-cyan/10' : 'border-terminal-border/40 bg-terminal-input/30'
              }`}
            >
              <span className="font-bold text-terminal-green">
                {day > 0 ? `Day ${day}` : 'Other'}
                {isLive && (
                  <span className="ml-2 rounded border border-terminal-cyan/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-terminal-cyan">
                    ● live
                  </span>
                )}
                <span className="ml-2 text-[10px] font-normal uppercase tracking-widest text-terminal-dim">
                  {list.length} solve{list.length === 1 ? '' : 's'}
                </span>
                {firstBloods > 0 && <span className="ml-1 text-terminal-red">🩸 {firstBloods}</span>}
              </span>
              <span className="font-extrabold tabular-nums text-terminal-amber">+{subtotal}</span>
            </div>
            <ul className="space-y-1 px-3 py-2">
              {list
                .slice()
                .sort((a, b) => (a.solved_at > b.solved_at ? 1 : -1))
                .map((s) => (
                  <li key={s.challenge_id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-terminal-green">
                      {s.first_blood && <span className="mr-1">🩸</span>}
                      {chMeta.get(s.challenge_id)?.title ?? s.challenge_id}
                    </span>
                    <span className="shrink-0 text-terminal-dim">
                      +{s.points} · {new Date(s.solved_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
