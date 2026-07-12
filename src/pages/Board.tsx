import { useEffect, useMemo, useState } from 'react';
import { formatDuration, isFrozen, strobeMs } from '../lib/time';
import useCountdown from '../lib/useCountdown';
import { useApp } from '../lib/app-context';
import type { EventConfig } from '../lib/types';
import type { Game } from '../lib/useGame';

const medal = ['🥇', '🥈', '🥉'];

/**
 * The clock — the left column and the whole point of the projector board. It owns
 * its own tick (via useCountdown) so the once-per-second repaint stays isolated
 * here and never re-renders the ranking beside it, which used to make the top-3
 * rows visibly shimmer while projecting.
 *
 * Escalation matches the arena exactly (see lib/time): green → red at 5:00 → red
 * + hard strobe through the final minute, tightening at 0:10 and 0:03.
 */
function BoardClock({ event }: { event: EventConfig | null }) {
  const { status, remainingMs, secs, phase } = useCountdown(event);
  const critical = phase === 'critical';

  const label =
    status === 'running' ? formatDuration(remainingMs) : status === 'ended' ? "TIME'S UP" : 'WAITING';

  const color =
    status === 'ended'
      ? 'text-terminal-red'
      : status === 'idle'
        ? 'text-terminal-amber'
        : critical
          ? 'text-terminal-redlight'
          : phase === 'warn'
            ? 'text-terminal-red'
            : phase === 'freeze'
              ? 'text-terminal-cyan'
              : 'text-terminal-green';

  const glowVar =
    status === 'ended' || critical || phase === 'warn'
      ? '--c-red'
      : status === 'idle'
        ? '--c-amber'
        : phase === 'freeze'
          ? '--c-cyan'
          : '--c-green';

  const caption =
    status !== 'running'
      ? 'Status'
      : critical
        ? 'Final minute'
        : phase === 'warn'
          ? 'Time is almost up'
          : phase === 'freeze'
            ? 'Score freeze · time remaining'
            : 'Time remaining';

  return (
    <div
      className={`flex h-full flex-col items-center justify-center rounded-2xl border px-6 py-10 text-center transition-colors ${
        critical || phase === 'warn'
          ? 'border-terminal-red/50 bg-terminal-red/5'
          : 'border-terminal-border bg-terminal-panel/60'
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.5em] text-terminal-dim">{caption}</div>
      <div
        className={`mt-3 font-mono text-7xl font-black leading-none tabular-nums sm:text-8xl lg:text-[7.5rem] ${color} ${
          critical ? 'animate-strobe' : ''
        }`}
        style={{
          filter: `drop-shadow(0 0 32px rgb(var(${glowVar}) / 0.55))`,
          ...(critical ? { animationDuration: `${strobeMs(secs)}ms` } : {}),
        }}
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-terminal-amber/40 bg-terminal-amber/5 p-10 text-center">
      <div className="animate-flicker text-6xl">🔒</div>
      <h2 className="mt-4 text-2xl font-extrabold text-terminal-amber sm:text-3xl">Standings frozen</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-terminal-dim">
        Hidden for the final {mins} minutes. Revealed the moment the clock hits zero.
      </p>
      <p className="mt-5 text-xs uppercase tracking-widest text-terminal-dim">
        {count} competitor{count === 1 ? '' : 's'} still in the running
      </p>
    </div>
  );
}

/**
 * Full-screen "present to the class" board, rendered as an in-page overlay on the
 * arena (no /board route). It reuses the arena's live `game` object — the same
 * realtime feed the arena already subscribes to — so it's always in sync with zero
 * extra network. Countdown sounds are owned by <Timer> in the arena header, which
 * stays mounted underneath this overlay.
 */
export default function Board({ game, onClose }: { game: Game; onClose: () => void }) {
  const { muted, toggleMute } = useApp();
  const activeDayNum = game.event?.active_day ?? null;

  // Score-freeze for the final N minutes. Flip exactly at the freeze boundary and
  // again at time's up, rather than ticking every second — a per-second re-render
  // of this whole board was the old "shimmer".
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The last 3 solves, scoped to the active day. Filtering through the leaderboard
  // drops admin/excluded accounts automatically — they never appear on the board.
  const feed = useMemo(() => {
    const rowById = new Map(game.leaderboard.map((r) => [r.player_id, r]));
    const chTitle = new Map(game.challenges.map((c) => [c.id, c.title]));
    const chDay = new Map(game.challenges.map((c) => [c.id, c.day]));
    return game.solves
      .filter((s) => rowById.has(s.player_id) && chDay.get(s.challenge_id) === activeDayNum)
      .slice()
      .sort((a, b) => Date.parse(b.solved_at) - Date.parse(a.solved_at))
      .slice(0, 3)
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
  const rows = game.leaderboard.slice(0, 12); // everyone who entered, even at 0 points
  const overflow = game.leaderboard.length - rows.length;
  const totalSolves = game.leaderboard.reduce((n, r) => n + r.solves_count, 0);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-terminal-bg p-5 text-terminal-text sm:p-7">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-terminal-dim">
              KGSP // CTF — Live Board
            </div>
            <h1 className="text-xl font-extrabold text-terminal-green drop-shadow-[0_0_10px_rgb(var(--c-green)/0.4)] sm:text-2xl">
              {activeDay?.title ?? 'No active day set'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              title={muted ? 'Unmute the countdown' : 'Mute the countdown'}
              className="rounded-lg border border-terminal-border px-3 py-2 text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-terminal-border px-3 py-2 text-sm font-bold uppercase tracking-widest text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
            >
              ✕ Close
            </button>
          </div>
        </header>

        {/* Column 1: the clock, on its own. Column 2: standings + activity. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(400px,0.85fr)_1.15fr]">
          {/* Column flexes so the clock takes the space that's left and the two
              tiles stay pinned under it. (BoardClock is h-full: without the flex
              column it filled the whole section and pushed the tiles off-screen.) */}
          <section className="lg:sticky lg:top-7 lg:flex lg:h-[calc(100vh-7rem)] lg:flex-col">
            <div className="lg:min-h-0 lg:flex-1">
              <BoardClock event={game.event} />
            </div>
            <div className="mt-4 grid shrink-0 grid-cols-2 gap-3">
              <div className="rounded-xl border border-terminal-border bg-terminal-panel/60 px-4 py-3 text-center">
                <div className="text-3xl font-black tabular-nums text-terminal-green">
                  {game.leaderboard.length}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-terminal-dim">
                  competitors
                </div>
              </div>
              <div className="rounded-xl border border-terminal-border bg-terminal-panel/60 px-4 py-3 text-center">
                <div className="text-3xl font-black tabular-nums text-terminal-amber">{totalSolves}</div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-terminal-dim">solves</div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            {frozen ? (
              <FrozenPanel event={game.event} count={game.leaderboard.length} />
            ) : (
              <ol className="space-y-2">
                {rows.length === 0 && (
                  <li className="rounded-xl border border-dashed border-terminal-border p-12 text-center text-terminal-dim">
                    No one has entered this day yet — waiting for competitors. 🕵️
                  </li>
                )}
                {rows.map((r, i) => {
                  const hasPoints = r.total_points > 0;
                  const podium = hasPoints && i < 3;
                  return (
                    <li
                      key={r.player_id}
                      className={`flex items-center gap-4 rounded-xl border px-5 py-3 transition ${
                        podium
                          ? 'border-terminal-amber/40 bg-terminal-amber/5 shadow-neon-amber'
                          : 'border-terminal-border bg-terminal-panel'
                      }`}
                    >
                      <span className="w-10 shrink-0 text-center text-2xl font-extrabold text-terminal-dim">
                        {podium ? medal[i] : i + 1}
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

            {/* The last 3 solves — one card each, not a run-on sentence. */}
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-terminal-cyan">
                ▸ Latest solves
              </h2>
              <ul className="space-y-2">
                {feed.length === 0 && (
                  <li className="rounded-xl border border-dashed border-terminal-border px-4 py-5 text-center text-sm text-terminal-dim">
                    {game.loading ? 'Loading…' : 'No solves yet — waiting for the first flag! 🚩'}
                  </li>
                )}
                {feed.map((a) => (
                  <li
                    key={a.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                      a.type === 'first_blood'
                        ? 'border-terminal-red/50 bg-terminal-red/5'
                        : 'border-terminal-border bg-terminal-panel'
                    }`}
                  >
                    <span className="text-xl">{a.type === 'first_blood' ? '🩸' : '✓'}</span>
                    {/* During the freeze the feed keeps flowing (so the room still
                        feels the action) but names are hidden so it can't reveal
                        who's climbing while standings are blacked out. */}
                    <span className="text-2xl">{frozen ? '🕵️' : a.avatar}</span>
                    <span className="flex-1 truncate">
                      <span className="font-bold text-terminal-green">
                        {frozen ? 'Anonymous' : a.username}
                      </span>
                      <span className="text-terminal-dim">
                        {' '}
                        {a.type === 'first_blood' ? 'drew first blood on' : 'solved'}{' '}
                      </span>
                      <span className="font-bold text-terminal-text">{a.challengeTitle}</span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-terminal-amber">
                      {frozen ? '🔒' : `+${a.points}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
