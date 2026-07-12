import { useEffect, useMemo, useState } from 'react';
import { getEventState, formatDuration, isFrozen } from '../lib/time';
import type { EventConfig } from '../lib/types';
import type { Game } from '../lib/useGame';

const medal = ['🥇', '🥈', '🥉'];

// The countdown owns its own 1s tick, so the once-per-second repaint stays
// isolated here and never re-renders the ranking list (which caused the
// top-3 rows to visibly shimmer/loop while projecting). Rendered HUGE as the
// centerpiece of the projector board.
function BoardTimer({ event }: { event: EventConfig | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const state = getEventState(event, now);
  const running = state.status === 'running';
  // Same escalation as the arena banner: blue during the freeze, red in the last
  // 3 minutes, lighter red in the last minute.
  const secs = state.remainingMs / 1000;
  const freezeMs = (event?.freeze_minutes ?? 0) * 60_000;
  const inFreeze = running && freezeMs > 0 && state.remainingMs <= freezeMs;
  const final1 = running && secs <= 60;
  const final3 = running && secs <= 180;
  const label = running
    ? formatDuration(state.remainingMs)
    : state.status === 'ended'
      ? "TIME'S UP"
      : 'WAITING';
  const color =
    state.status === 'ended'
      ? 'text-terminal-red'
      : state.status === 'idle'
        ? 'text-terminal-amber'
        : final1
          ? 'text-terminal-redlight'
          : final3
            ? 'text-terminal-red'
            : inFreeze
              ? 'text-terminal-cyan'
              : 'text-terminal-green';
  const glow =
    state.status === 'ended'
      ? 'drop-shadow-[0_0_28px_rgb(var(--c-red)/0.5)]'
      : state.status === 'idle'
        ? 'drop-shadow-[0_0_28px_rgb(var(--c-amber)/0.5)]'
        : final1 || final3
          ? 'drop-shadow-[0_0_28px_rgb(var(--c-red)/0.5)]'
          : inFreeze
            ? 'drop-shadow-[0_0_28px_rgb(var(--c-cyan)/0.5)]'
            : 'drop-shadow-[0_0_28px_rgb(var(--c-green)/0.55)]';
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-[0.5em] text-terminal-dim">
        {state.status === 'running' ? 'Time Remaining' : 'Status'}
      </div>
      <div
        className={`font-mono text-7xl font-black leading-none tabular-nums sm:text-8xl md:text-9xl ${color} ${glow}`}
      >
        {label}
      </div>
    </div>
  );
}

// Shown in place of the ranking during the final-minutes freeze so the finish
// stays a surprise on the projector. Scores are revealed automatically the
// moment the timer hits zero.
function FrozenPanel({ event, count }: { event: EventConfig | null; count: number }) {
  const mins = event?.freeze_minutes ?? 15;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-terminal-amber/40 bg-terminal-amber/5 p-16 text-center">
      <div className="animate-flicker text-6xl">🔒</div>
      <h2 className="mt-4 text-2xl font-extrabold text-terminal-amber sm:text-3xl">Standings frozen</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-terminal-dim">
        Scores are hidden for the final {mins} minutes to keep the finish a surprise. The full
        leaderboard is revealed the moment the timer hits zero — keep hacking!
      </p>
      <p className="mt-5 text-xs uppercase tracking-widest text-terminal-dim">
        {count} competitor{count === 1 ? '' : 's'} still in the running
      </p>
    </div>
  );
}

// Full-screen "present to the class" board, rendered as an in-page overlay on
// the arena (no /board route). It reuses the arena's live `game` object — the
// same realtime feed the arena already subscribes to — so it's always in sync
// with zero extra network. First-blood/solve sounds are owned by the arena's
// <Toasts> (which is mounted underneath this overlay), so the board doesn't
// duplicate them.
export default function Board({ game, onClose }: { game: Game; onClose: () => void }) {
  const activeDayNum = game.event?.active_day ?? null;

  // Score-freeze for the final N minutes. Flip exactly at the freeze boundary
  // and again at time's up, rather than ticking every second — a per-second
  // re-render of this whole board was the old "shimmer".
  const [frozen, setFrozen] = useState(() => isFrozen(game.event, Date.now()));
  useEffect(() => {
    const ev = game.event;
    setFrozen(isFrozen(ev, Date.now()));
    if (!ev?.ends_at) return;
    const end = Date.parse(ev.ends_at);
    const freezeMs = (ev.freeze_minutes ?? 0) * 60_000;
    const freezeStart = end - freezeMs;
    const now = Date.now();
    const timers: number[] = [];
    if (freezeMs > 0 && now < freezeStart) {
      timers.push(window.setTimeout(() => setFrozen(true), freezeStart - now + 50));
    }
    if (now < end) {
      timers.push(window.setTimeout(() => setFrozen(false), end - now + 50)); // reveal at time's up
    }
    return () => timers.forEach(clearTimeout);
  }, [game.event]);

  // Close on Escape, like the other arena overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live feed seeded from real solves (so it isn't blank on open) and scoped to
  // the active day. Filtering to leaderboard members drops admin/excluded
  // accounts automatically — they never appear on the board.
  const solveFeed = useMemo(() => {
    const rowById = new Map(game.leaderboard.map((r) => [r.player_id, r]));
    const chTitle = new Map(game.challenges.map((c) => [c.id, c.title]));
    const chDay = new Map(game.challenges.map((c) => [c.id, c.day]));
    return game.solves
      .filter((s) => rowById.has(s.player_id) && chDay.get(s.challenge_id) === activeDayNum)
      .slice()
      .sort((a, b) => Date.parse(b.solved_at) - Date.parse(a.solved_at))
      .slice(0, 8)
      .map((s) => {
        const r = rowById.get(s.player_id)!;
        return {
          id: s.id,
          type: s.is_first_blood ? ('first_blood' as const) : ('solve' as const),
          username: r.username,
          avatar: r.avatar ?? '🕵️',
          challengeTitle: chTitle.get(s.challenge_id) ?? s.challenge_id,
          points: s.points_awarded,
        };
      });
  }, [game.solves, game.leaderboard, game.challenges, activeDayNum]);

  const activeDay = game.days.find((d) => d.day === game.event?.active_day);
  // Everyone who entered the live day is shown, even at 0 points.
  const rows = game.leaderboard.slice(0, 20);
  const overflow = game.leaderboard.length - rows.length;
  const feed = solveFeed;
  const totalSolves = game.leaderboard.reduce((n, r) => n + r.solves_count, 0);

  return (
    <div className="fixed inset-0 z-40 min-h-screen overflow-y-auto bg-terminal-bg p-6 text-terminal-text sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Top bar */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={onClose}
              className="mb-1 inline-flex items-center gap-1 text-xs text-terminal-dim underline decoration-dotted transition hover:text-terminal-green"
            >
              ‹ Back to arena
            </button>
            <div className="text-[10px] uppercase tracking-[0.4em] text-terminal-dim">
              KGSP // CTF — Live Board
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-terminal-border px-3 py-2 text-sm font-bold uppercase tracking-widest text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
          >
            ✕ Close
          </button>
        </header>

        {/* Hero: active-day title + HUGE hacker countdown */}
        <section className="mb-6 rounded-2xl border border-terminal-border bg-terminal-panel/60 px-6 py-8 shadow-neon">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-terminal-green drop-shadow-[0_0_10px_rgb(var(--c-green)/0.4)] sm:text-3xl">
              {activeDay?.title ?? 'No active day set'}
            </h1>
            <div className="mt-1 text-[11px] uppercase tracking-[0.35em] text-terminal-dim">
              {game.leaderboard.length} competitor{game.leaderboard.length === 1 ? '' : 's'} ·{' '}
              {totalSolves} solve{totalSolves === 1 ? '' : 's'}
            </div>
          </div>
          <div className="mt-6">
            <BoardTimer event={game.event} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Ranking — hidden during the final-minutes freeze */}
            {frozen ? (
              <FrozenPanel event={game.event} count={game.leaderboard.length} />
            ) : (
            <ol className="space-y-2">
              {rows.length === 0 && (
                <li className="rounded-xl border border-dashed border-terminal-border p-16 text-center text-terminal-dim">
                  No one has entered this day yet — waiting for competitors. 🕵️
                </li>
              )}
              {rows.map((r, i) => {
                const hasPoints = r.total_points > 0;
                return (
                  <li
                    key={r.player_id}
                    className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 transition sm:px-6 sm:py-4 ${
                      hasPoints && i < 3
                        ? 'border-terminal-amber/40 bg-terminal-amber/5 shadow-neon-amber'
                        : 'border-terminal-border bg-terminal-panel'
                    }`}
                  >
                    <span className="w-10 shrink-0 text-center text-2xl font-extrabold text-terminal-dim">
                      {hasPoints && i < 3 ? medal[i] : i + 1}
                    </span>
                    <span className="text-3xl">{r.avatar}</span>
                    <span className="flex flex-1 items-center gap-2 truncate text-lg font-bold text-terminal-green sm:text-xl">
                      <span className="truncate">{r.username}</span>
                      {!hasPoints && (
                        <span className="shrink-0 rounded border border-terminal-dim/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-terminal-dim">
                          entered
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm text-terminal-dim">{r.solves_count}★</span>
                    <span className="w-20 shrink-0 text-right text-2xl font-extrabold tabular-nums text-terminal-amber sm:text-3xl">
                      {r.total_points}
                    </span>
                  </li>
                );
              })}
              {overflow > 0 && (
                <li className="px-2 text-center text-xs text-terminal-dim">
                  + {overflow} more competitor{overflow > 1 ? 's' : ''}
                </li>
              )}
            </ol>
            )}

            {/* Live feed */}
            <div className="h-fit rounded-xl border border-terminal-border bg-terminal-panel p-4">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-terminal-cyan">
                ▸ Live feed
              </h2>
              <ul className="space-y-2.5 text-sm">
                {feed.length === 0 && (
                  <li className="text-terminal-dim">
                    {game.loading ? 'Loading…' : 'No solves yet — waiting for the first flag! 🚩'}
                  </li>
                )}
                {feed.map((a) => (
                  <li
                    key={a.id}
                    className={a.type === 'first_blood' ? 'text-terminal-red' : 'text-terminal-dim'}
                  >
                    <span className="mr-1">{a.type === 'first_blood' ? '🩸' : '✓'}</span>
                    {/* During the freeze the feed keeps flowing (so the room still
                        feels the action) but names/avatars are hidden so it can't
                        reveal who's climbing while standings are blacked out. */}
                    <span className="mr-1">{frozen ? '🕵️' : a.avatar}</span>
                    <strong className="text-terminal-green">
                      {frozen ? 'Anonymous' : a.username}
                    </strong>{' '}
                    {a.type === 'first_blood' ? 'drew first blood on' : 'solved'}{' '}
                    <strong className="text-terminal-green">{a.challengeTitle}</strong>{' '}
                    {frozen ? (
                      <span className="text-terminal-dim">(🔒)</span>
                    ) : (
                      <span className="text-terminal-amber">(+{a.points})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
        </div>
      </div>
    </div>
  );
}
