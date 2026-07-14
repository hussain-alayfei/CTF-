import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  adminAddTime,
  adminDeleteAllPlayers,
  adminDeletePlayer,
  adminListPlayers,
  adminOverview,
  adminReset,
  adminSetActiveDay,
  adminSetDay,
  adminSetDayCode,
  adminSetDayCompleted,
  adminSetDuration,
  adminSetFinaleStage,
  adminSetFreeze,
  adminSetPlayerExcluded,
  adminStartEvent,
  adminStopEvent,
} from '@/lib/api';
import { formatDuration, strobeMs, type CountdownState } from '@/lib/time';
import useCountdown from '@/lib/useCountdown';
import type { Game } from '@/lib/useGame';
import type { AdminChallenge, AdminDay, AdminOverview, AdminPlayer, AdminPlayerSolve } from '@/lib/types';
import { useApp } from '@/lib/app-context';
import { getCache, setCache } from '@/lib/cache';
import Prompt from '@/challenges/shared/Prompt';
import Register from '@/arena/components/Register';
import ConfirmDialog from './ConfirmDialog';
import useLockBodyScroll from '@/lib/useLockBodyScroll';

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

export default function AdminPanel({
  embedded = false,
  game,
  onClose,
}: {
  /** When true the panel renders as a full-screen overlay on the arena URL
   *  (no /admin route) — "back to the arena" calls onClose instead of navigating. */
  embedded?: boolean;
  /**
   * The arena's live game object. The panel used to read the event from its own
   * 5-second poll, so the instructor's clock jumped in 5s steps and could sit
   * seconds behind what the room was seeing. Reading the event straight off the
   * arena's realtime feed instead means "+5 min" lands here, on the players'
   * screens and on the projector from the same update — no refresh, no drift, and
   * no second subscription.
   */
  game?: Game;
  onClose?: () => void;
} = {}) {
  const { player } = useApp();
  // Seed from the session cache so the dashboard paints instantly on refresh /
  // re-entry; load() still fetches fresh data below and the 5s poll revalidates.
  const [data, setData] = useState<AdminOverview | null>(() => getCache<AdminOverview>('admin_overview'));
  const [players, setPlayers] = useState<AdminPlayer[]>(() => getCache<AdminPlayer[]>('admin_players') ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showFlags, setShowFlags] = useState(false);

  // Seed the editable event fields from the freshest event we already have — the
  // arena's realtime feed (`game.event`) when embedded, else the cached overview.
  // Without this, opening Admin flashed the hardcoded 35/15/"choose a day"
  // defaults and only snapped to the real values once the 5s poll returned,
  // which read as stale ghost values coming back from the DB.
  const seedEvent = game?.event ?? getCache<AdminOverview>('admin_overview')?.event ?? null;
  const [activeDaySel, setActiveDaySel] = useState<number | ''>(seedEvent?.active_day ?? '');

  // Duration & freeze as local string state — synced from the live event only
  // when the SERVER value genuinely changes, so a poll never clobbers a value
  // the instructor is mid-edit.
  const [minutesStr, setMinutesStr] = useState(() => String(seedEvent?.duration_minutes ?? 35));
  const [freezeStr, setFreezeStr] = useState(() => String(seedEvent?.freeze_minutes ?? 15));
  // Mid-round clock adjustment (add/remove minutes without restarting).
  const [adjustStr, setAdjustStr] = useState('15');
  const lastServerMinutes = useRef<number | null>(seedEvent?.duration_minutes ?? null);
  const lastServerFreeze = useRef<number | null>(seedEvent?.freeze_minutes ?? null);
  const lastServerActiveDay = useRef<number | null>(seedEvent?.active_day ?? null);

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
    // Editable event fields (duration / freeze / active-day selector) are synced
    // from the live event in a dedicated effect below, not here — so they hydrate
    // from the arena's realtime feed instantly instead of waiting on this poll.
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

  // (The day used to auto-lock itself 30 minutes after the round ended, from a
  // timer in this panel. It is gone: it locked the day out from under the class
  // while people were still practising, then the arena — which had nothing to do
  // with the decision — started nagging about it. Locking a day is a decision, so
  // it is now only ever made by hand, from the Days tab.)

  // Confirmable admin actions route through an in-app dialog instead of
  // window.confirm — same gate, but readable, on-brand, and keyboard-friendly.
  const [pendingConfirm, setPendingConfirm] = useState<{
    body: string;
    tone: 'default' | 'danger';
    action: () => Promise<{ error?: string; message?: string }>;
  } | null>(null);

  async function execute(action: () => Promise<{ error?: string; message?: string }>) {
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

  function run(
    action: () => Promise<{ error?: string; message?: string }>,
    confirmText?: string,
  ) {
    if (confirmText) {
      const tone: 'default' | 'danger' =
        /\b(delete|reset|remove|sign)\b|cannot be undone/i.test(confirmText) ? 'danger' : 'default';
      setPendingConfirm({ body: confirmText, tone, action });
      return;
    }
    return execute(action);
  }

  // The live event, straight off the arena's realtime feed (falling back to the
  // polled copy only if the panel is ever rendered outside the arena). useCountdown
  // ticks it, so the clock below actually counts down instead of stepping in 5s
  // jumps whenever the poll happened to land.
  const liveEvent = game?.event ?? data?.event ?? null;
  const clock = useCountdown(liveEvent);
  const isIdle = clock.status === 'idle';
  const isRunning = clock.status === 'running';
  const isEnded = clock.status === 'ended';
  const activeDay = liveEvent?.active_day ?? null;
  const finaleStage = liveEvent?.finale_stage ?? -1;

  // Keep the editable event fields in lock-step with the live event. Only
  // overwrite when the SERVER value actually changed (tracked via refs) so a
  // realtime tick or poll never stomps a value the instructor is mid-edit, and
  // the active-day dropdown isn't reset out from under an unsaved selection.
  useEffect(() => {
    if (!liveEvent) return;
    const serverMin = liveEvent.duration_minutes ?? 35;
    if (lastServerMinutes.current !== serverMin) {
      lastServerMinutes.current = serverMin;
      setMinutesStr(String(serverMin));
    }
    const serverFreeze = liveEvent.freeze_minutes ?? 15;
    if (lastServerFreeze.current !== serverFreeze) {
      lastServerFreeze.current = serverFreeze;
      setFreezeStr(String(serverFreeze));
    }
    const serverDay = liveEvent.active_day ?? null;
    if (lastServerActiveDay.current !== serverDay) {
      lastServerActiveDay.current = serverDay;
      setActiveDaySel(serverDay ?? '');
    }
  }, [liveEvent?.duration_minutes, liveEvent?.freeze_minutes, liveEvent?.active_day]);
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
  const parsedAdjust = parseInt(adjustStr, 10);
  const validAdjust = !isNaN(parsedAdjust) && parsedAdjust > 0 ? parsedAdjust : 0;

  // Compared against the live event, so the button honestly reflects whether what
  // is on screen differs from what the server will actually use on the next start.
  const setupDirty =
    validMinutes !== (liveEvent?.duration_minutes ?? 35) ||
    validFreeze !== (liveEvent?.freeze_minutes ?? 15);

  async function saveSetup() {
    await run(async () => {
      const a = await adminSetDuration(secret, validMinutes);
      if (a.error) return a;
      const b = await adminSetFreeze(secret, validFreeze);
      if (b.error) return b;
      return { message: `Saved — ${validMinutes} min round, ${validFreeze} min score freeze.` };
    });
  }

  // Read-only convenience on Event Control: copy the live day's access code so
  // the instructor never has to hop to the Days tab mid-round to read it.
  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMsg({ ok: true, text: `Copied access code: ${code}` });
    } catch {
      setMsg({ ok: false, text: 'Could not copy automatically — select the code and copy it by hand.' });
    }
  }

  // In embedded mode the panel is one of the tabs in the persistent HeaderBar —
  // there is no /admin route anymore (navigating to a separate route was causing
  // the arena's realtime/game state to remount). It renders as normal in-page
  // content below that header, NOT a `fixed inset-0` overlay: a fixed overlay
  // opens a stacking context above the header's `sticky` one and paints straight
  // over it, which is what made clicking "Admin" look like it navigated away to a
  // different, header-less page. Otherwise (standalone/non-embedded) render as a
  // normal page.
  const wrap = (node: JSX.Element) =>
    embedded ? <div className="bg-terminal-bg">{node}</div> : node;

  // Not logged in
  if (!player) return <Register />;

  // Not an admin
  if (!player.is_admin) {
    return wrap(
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-4xl">🚫</div>
        <h1 className="mt-3 text-xl font-extrabold text-terminal-red">Instructors only</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          This page is for course instructors. Head back to the arena to keep playing.
        </p>
        {embedded ? (
          <button
            onClick={onClose}
            className="mt-4 inline-block rounded-lg border border-terminal-green px-4 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/10"
          >
            ‹ Back to the arena
          </button>
        ) : (
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg border border-terminal-green px-4 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/10"
          >
            ‹ Back to the arena
          </Link>
        )}
      </div>,
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

  // Event Control workflow helpers: which day is live, its access code, and a
  // single "what to do next" line so the tab reads as ordered steps rather than
  // a stack of equally-loud cards.
  const activeDayObj = days.find((d) => d.day === activeDay) ?? null;
  const activeDayName = activeDayObj?.title ?? (activeDay != null ? `Day ${activeDay}` : '—');
  const activeCode = activeDayObj?.code ?? '';
  const nextHint =
    activeDay == null
      ? 'Start here — choose the live day below.'
      : isRunning
        ? 'The round is live. Add or remove time below if you need to.'
        : isEnded
          ? 'The round ended. Open the finale to reveal the winners.'
          : activeCode
            ? 'Ready — share the access code, check the length, then start the round.'
            : 'Ready — set the round length, then start the round.';

  function handleStartEvent() {
    run(
      async () => await adminStartEvent(secret, validMinutes),
      isRunning
        ? `Restart with a fresh ${validMinutes}-minute clock? Scores are kept, but the intro replays.\n\nJust need more time? Cancel and use "+ Add" instead.`
        : undefined,
    );
  }

  return wrap(
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Embedded mode has no local chrome here — Board / theme / sign-out all live
          in the persistent HeaderBar (and profile) above. Standalone keeps a back
          link only for the rare non-embedded render. */}
      {!embedded && (
        <div className="mb-4">
          <Link
            to="/"
            className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
          >
            ‹ back to the arena
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-extrabold text-terminal-green">🛠 Instructor Dashboard</h1>
        {/* Compact status line — used to be three tall tiles under the title. */}
        <p className="font-mono text-xs text-terminal-dim">
          <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
          <span className="mx-2 text-terminal-border">·</span>
          {activePlayerCount} players
          <span className="mx-2 text-terminal-border">·</span>
          {activeSolves} solves
        </p>
      </div>

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

      {/* Tab bar — 3 tabs: Event Control (incl. Active Day), Days (incl.
          Challenges), Players (labeled with the live day number). */}
      <div className="mt-5 flex gap-1 border-b border-terminal-border">
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
          <div className="space-y-3">
            {/* One-line "what to do next", derived purely from day + clock state,
                so the tab always tells the instructor the single next action. */}
            <div className="flex items-center gap-3 rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/5 px-4 py-2">
              <span className="rounded bg-terminal-cyan/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-terminal-cyan">
                Next
              </span>
              <span className="text-sm text-terminal-green/90">{nextHint}</span>
            </div>

            {/* STEP 1 — pick which day the leaderboard scores. */}
            <Step n={1} title="Choose the live day" tone="cyan" hint="Sets which day the leaderboard scores right now.">
              <div className="flex flex-wrap items-center gap-2">
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
                      {d.day === activeDay ? ' · live' : ''}
                    </option>
                  ))}
                </select>
                <button
                  disabled={busy || activeDaySel === '' || Number(activeDaySel) === activeDay}
                  onClick={() =>
                    run(
                      () => adminSetActiveDay(secret, Number(activeDaySel)),
                      'Switch the live leaderboard to this day?',
                    )
                  }
                  className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-40"
                >
                  {activeDaySel !== '' && Number(activeDaySel) === activeDay ? '✓ Live' : 'Set live'}
                </button>
                <span className="text-xs text-terminal-dim">
                  Now: <strong className="text-terminal-green">{activeDayName}</strong>
                </span>
              </div>
            </Step>

            {/* STEP 2 — read/copy the code players type to join (edited under Days). */}
            <Step n={2} title="Share the access code" hint="Players enter this to join the live day.">
              {activeDay == null ? (
                <p className="text-sm text-terminal-dim">Pick the live day first, then its code shows here.</p>
              ) : activeCode ? (
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 px-4 py-2 font-mono text-lg font-bold tracking-widest text-terminal-amber">
                    {activeCode}
                  </code>
                  <button
                    onClick={() => void copyCode(activeCode)}
                    className="rounded-lg border border-terminal-cyan/60 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-terminal-cyan transition hover:bg-terminal-cyan/20"
                  >
                    ⧉ Copy
                  </button>
                  <span className="text-[11px] text-terminal-dim">
                    Change it under <strong className="text-terminal-green">Days &amp; Challenges</strong>.
                  </span>
                </div>
              ) : (
                <p className="text-sm text-terminal-dim">
                  <span className="text-terminal-amber">No code set</span> — this day is open to everyone. Add one
                  under <strong className="text-terminal-green">Days &amp; Challenges</strong> if you want to gate it.
                </p>
              )}
            </Step>

            {/* STEP 3 — round length + score freeze (saved settings for next start). */}
            <Step n={3} title="Set the round length" hint="Applied on the next start.">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-terminal-dim">
                    Round length
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={minutesStr}
                      onChange={(e) => setMinutesStr(e.target.value)}
                      className="w-16 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-center text-terminal-green outline-none focus:border-terminal-green"
                    />
                    <span className="text-[11px] text-terminal-dim">min · next start</span>
                  </span>
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-terminal-dim">
                    Score freeze
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={freezeStr}
                      onChange={(e) => setFreezeStr(e.target.value)}
                      className="w-16 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-center text-terminal-green outline-none focus:border-terminal-green"
                    />
                    <span className="text-[11px] text-terminal-dim">final min · 0 = never</span>
                  </span>
                </label>
                <button
                  disabled={busy || !setupDirty}
                  onClick={() => void saveSetup()}
                  className="rounded-lg border border-terminal-cyan/60 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-terminal-cyan transition hover:bg-terminal-cyan/20 disabled:opacity-40"
                >
                  {setupDirty ? '💾 Save' : '✓ Saved'}
                </button>
                {setupDirty && <span className="self-center text-[11px] text-terminal-amber">Unsaved changes.</span>}
              </div>
            </Step>

            {/* STEP 4 — the live clock + the start/stop you press to run it. */}
            <Step n={4} title="Run the round" hint="Start when the room is ready. Everyone sees the countdown.">
              <AdminClock clock={clock} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={handleStartEvent}
                  className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
                >
                  {isRunning ? `🔁 Restart · ${validMinutes} min` : `▶ Start · ${validMinutes} min`}
                </button>
                <button
                  disabled={busy || !isRunning}
                  onClick={() => run(() => adminStopEvent(secret), 'Stop the event now for everyone?')}
                  title={!isRunning ? 'Nothing is running right now.' : undefined}
                  className="rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-40"
                >
                  ⏹ Stop now
                </button>
              </div>
            </Step>

            {/* STEP 5 — adjust the clock without restarting (running or ended only).
                Restart resets starts_at, which replays the 3-2-1 GO! intro; this
                only moves ends_at. */}
            {(isRunning || isEnded) && (
              <Step
                n={5}
                title="Adjust the clock"
                hint="Add or remove time without restarting — no replayed intro."
              >
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 15].map((m) => (
                    <button
                      key={m}
                      disabled={busy}
                      onClick={() => run(() => adminAddTime(secret, m))}
                      className="rounded-lg border border-terminal-green/50 bg-terminal-green/10 px-3 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-40"
                    >
                      +{m} min
                    </button>
                  ))}
                  <button
                    disabled={busy}
                    onClick={() => run(() => adminAddTime(secret, -5))}
                    className="rounded-lg border border-terminal-amber/50 bg-terminal-amber/10 px-3 py-2 text-sm font-bold text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-40"
                  >
                    −5 min
                  </button>
                  <span className="mx-1 hidden h-6 w-px bg-terminal-border sm:block" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={adjustStr}
                    onChange={(e) => setAdjustStr(e.target.value)}
                    aria-label="Custom minutes to add or remove"
                    className="w-16 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-center text-terminal-green outline-none focus:border-terminal-green"
                  />
                  <button
                    disabled={busy || validAdjust === 0}
                    onClick={() => run(() => adminAddTime(secret, validAdjust))}
                    className="rounded-lg border border-terminal-green/60 bg-terminal-green/10 px-3 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-40"
                  >
                    ＋ Add
                  </button>
                  <button
                    disabled={busy || validAdjust === 0}
                    onClick={() => run(() => adminAddTime(secret, -validAdjust))}
                    className="rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-3 py-2 text-sm font-bold text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-40"
                  >
                    － Remove
                  </button>
                </div>
              </Step>
            )}

            {/* THE FINALE — reveal on every screen at once (ended only). */}
            {isEnded && (
              <Step n="🏁" title="The finale" tone="amber" hint="Reveals the winners on every screen at once.">
                <p className="text-xs text-terminal-dim">
                  Opens the card table on <strong className="text-terminal-amber">every screen</strong>. Click the
                  cards to reveal 3rd → 2nd → 1st.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy || finaleStage >= 0}
                    onClick={() => run(() => adminSetFinaleStage(secret, 0))}
                    className="rounded-lg border border-terminal-amber bg-terminal-amber/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-40"
                  >
                    🏁 Open the reveal
                  </button>
                  <button
                    disabled={busy || finaleStage < 0}
                    onClick={() => run(() => adminSetFinaleStage(secret, -1))}
                    className="rounded-lg border border-terminal-border px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red disabled:opacity-40"
                  >
                    ✕ End it
                  </button>
                  {finaleStage >= 0 && (
                    <span className="self-center text-xs text-terminal-dim">
                      {finaleStage === 0 ? 'Cards are face down.' : `Revealed: ${finaleStage} of 3.`}
                    </span>
                  )}
                </div>
              </Step>
            )}

            {/* DANGER — reset the live day's scores. Visually last and quiet. */}
            <Step n="⚠" title="Danger zone" tone="red" hint="Clears the live day's scores and clock. Other days are safe.">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  disabled={busy || isIdle || activeDay == null}
                  onClick={() => {
                    if (activeDay == null) return;
                    const dayName = days.find((d) => d.day === activeDay)?.title ?? `Day ${activeDay}`;
                    run(
                      () => adminReset(secret, activeDay),
                      `Reset scores for ${dayName} ONLY? Players keep their names but lose ${dayName}'s solves. Every other day is untouched.`,
                    );
                  }}
                  title={
                    isIdle
                      ? 'Nothing to reset — no event has been started.'
                      : activeDay == null
                        ? 'Set a live day first.'
                        : undefined
                  }
                  className="rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20 disabled:opacity-40"
                >
                  ⟲ Reset {days.find((d) => d.day === activeDay)?.title ?? 'live day'}
                </button>
                <span className="text-[11px] text-terminal-dim">
                  Clears the live day&apos;s scores and the clock. Other days are safe.
                </span>
              </div>
            </Step>
          </div>
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

      <ConfirmDialog
        open={pendingConfirm !== null}
        title="Please confirm"
        body={pendingConfirm?.body ?? ''}
        tone={pendingConfirm?.tone ?? 'default'}
        busy={busy}
        onConfirm={() => {
          const action = pendingConfirm?.action;
          setPendingConfirm(null);
          if (action) void execute(action);
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>,
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
        <div className="space-y-2 pl-2">
          {days.map((d: AdminDay) => {
            const autoCode = generateDayCode(d);
            const dayChallenges = challengesByDay.find((g) => g.day === d.day)?.list ?? [];
            return (
              <div
                key={d.day}
                className="rounded-lg border border-terminal-border bg-terminal-input/50 px-3 py-2.5"
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

// ---- Layout primitives: one card per job, so the panel reads as sections
// rather than a wall of buttons and paragraphs. ----
const cardTone: Record<string, string> = {
  default: 'border-terminal-border',
  cyan: 'border-terminal-cyan/30',
  amber: 'border-terminal-amber/40',
  red: 'border-terminal-red/40',
};
const titleTone: Record<string, string> = {
  default: 'text-terminal-cyan',
  cyan: 'text-terminal-cyan',
  amber: 'text-terminal-amber',
  red: 'text-terminal-red',
};

const stepBadge: Record<string, string> = {
  default: 'border-terminal-cyan/50 text-terminal-cyan',
  cyan: 'border-terminal-cyan/50 text-terminal-cyan',
  amber: 'border-terminal-amber/50 text-terminal-amber',
  red: 'border-terminal-red/50 text-terminal-red',
};

/** A numbered section: a panel shell with a step badge and an optional one-line
 * hint so Event Control reads as an ordered checklist. */
function Step({
  n,
  title,
  tone = 'default',
  hint,
  children,
}: {
  n: number | string;
  title: string;
  tone?: 'default' | 'cyan' | 'amber' | 'red';
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-lg border bg-terminal-panel p-4 ${cardTone[tone]}`}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${stepBadge[tone]}`}
        >
          {n}
        </span>
        <h2 className={`text-xs font-bold uppercase tracking-widest ${titleTone[tone]}`}>{title}</h2>
        {hint && <span className="truncate text-[11px] font-normal normal-case text-terminal-dim">— {hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * The instructor's clock. It ticks — the old status banner only repainted when
 * the 5-second poll happened to land, so the number the instructor was reading
 * could be up to 5 seconds behind the number the room was reading. It also uses
 * the same red-at-5-minutes / strobe-in-the-final-minute escalation as the arena
 * and the projector, so all three screens agree at a glance.
 */
function AdminClock({ clock }: { clock: CountdownState }) {
  const { status, remainingMs, secs, phase } = clock;
  const critical = phase === 'critical';

  const [tone, headline] =
    status === 'running'
      ? critical || phase === 'warn'
        ? (['red', '🟢 LIVE — final stretch'] as const)
        : (['green', '🟢 LIVE — players can submit'] as const)
      : status === 'ended'
        ? (['red', "🔴 ENDED — players see “Time's up”"] as const)
        : (['amber', '⏳ NOT STARTED — players see “Stand by”'] as const);

  const box =
    tone === 'green'
      ? 'border-terminal-green/60 bg-terminal-green/10 shadow-neon'
      : tone === 'red'
        ? 'border-terminal-red/60 bg-terminal-red/10'
        : 'border-terminal-amber/50 bg-terminal-amber/10';
  const text =
    tone === 'green'
      ? 'text-terminal-green'
      : tone === 'red'
        ? 'text-terminal-red'
        : 'text-terminal-amber';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 px-5 py-4 ${box}`}>
      <div className={`text-sm font-extrabold uppercase tracking-widest ${text}`}>{headline}</div>
      {status === 'running' && (
        <div
          className={`font-mono text-4xl font-black tabular-nums ${critical ? 'animate-strobe text-terminal-redlight' : text}`}
          style={critical ? { animationDuration: `${strobeMs(secs)}ms` } : undefined}
        >
          {formatDuration(remainingMs)}
        </div>
      )}
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
  const [detailId, setDetailId] = useState<string | null>(null);

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

  // Look up against the full roster (not `filtered`) so the detail modal stays
  // open even if the search box is edited while it is showing.
  const detailPlayer = detailId != null ? players.find((p) => p.id === detailId) ?? null : null;

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
                (the currently live day). Click a player for their full per-day history.
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
                    onClick={() => setDetailId(p.id)}
                    title="View player details"
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
              </div>
            );
          })}
        </div>
      )}

      {detailPlayer && (
        <PlayerDetailModal
          player={detailPlayer}
          chMeta={chMeta}
          activeDay={activeDay}
          activeDayTitle={activeDayTitle}
          busy={busy}
          onToggleExclude={onToggleExclude}
          onDelete={(id, name) => {
            setDetailId(null);
            onDelete(id, name);
          }}
          onClose={() => setDetailId(null)}
        />
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

// Player detail as a right-side drawer (matches the arena's ProfileModal
// pattern) instead of expanding the row inline and pushing the list around.
function PlayerDetailModal({
  player,
  chMeta,
  activeDay,
  activeDayTitle,
  busy,
  onToggleExclude,
  onDelete,
  onClose,
}: {
  player: AdminPlayer;
  chMeta: Map<string, { day: number; title: string }>;
  activeDay: number | null;
  activeDayTitle: string | null;
  busy: boolean;
  onToggleExclude: (id: string, name: string, excluded: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onClose: () => void;
}) {
  useLockBodyScroll();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md animate-slide-left flex-col border-l border-terminal-border bg-terminal-panel shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-terminal-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-3xl">{player.avatar}</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-terminal-green">{player.username}</h2>
              <span className="text-[11px] text-terminal-dim">
                Joined {new Date(player.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-terminal-border px-2 py-1 text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {player.exclude_from_board && (
            <p className="mb-3 rounded border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-terminal-amber">
              🙈 Hidden from the competition
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-terminal-border bg-terminal-input/40 px-2 py-3">
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Score</div>
              <div className="mt-1 text-lg font-extrabold text-terminal-amber">{player.total_points}</div>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-input/40 px-2 py-3">
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Solves</div>
              <div className="mt-1 text-lg font-extrabold text-terminal-green">{player.solves_count}</div>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-input/40 px-2 py-3">
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim">First bloods</div>
              <div className="mt-1 text-lg font-extrabold text-terminal-red">{player.first_bloods}</div>
            </div>
          </div>
          {activeDay != null && (
            <p className="mt-3 text-[11px] text-terminal-dim">
              Live day:{' '}
              <strong className="text-terminal-cyan">
                Day {activeDay}
                {activeDayTitle ? ` — ${activeDayTitle}` : ''}
              </strong>
            </p>
          )}
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-terminal-dim">
              Solves by day
            </h3>
            <PlayerSolvesByDay solves={player.solves} chMeta={chMeta} activeDay={activeDay} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-terminal-border p-4">
          <button
            disabled={busy}
            onClick={() => onToggleExclude(player.id, player.username, !player.exclude_from_board)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-widest transition disabled:opacity-40 ${
              player.exclude_from_board
                ? 'border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/15'
                : 'border-terminal-border text-terminal-dim hover:border-terminal-cyan hover:text-terminal-cyan'
            }`}
          >
            {player.exclude_from_board ? '👁 Show on board' : '🙈 Hide from board'}
          </button>
          <button
            disabled={busy}
            onClick={() => onDelete(player.id, player.username)}
            className="rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20 disabled:opacity-40"
          >
            🗑 Delete player
          </button>
        </div>
      </aside>
    </div>
  );
}
