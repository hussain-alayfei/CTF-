import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { useGame } from '../lib/useGame';
import { getEventState, formatDuration } from '../lib/time';
import Register from '../components/Register';

const medal = ['🥇', '🥈', '🥉'];

// Full-screen, admin-only "present to the class" dashboard. Shares the same
// realtime data feed as the main arena, so it's always in sync — no manual
// refreshing needed while screen-sharing.
export default function Board() {
  const { player } = useApp();
  const game = useGame(player);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!player) return <Register />;

  if (!player.is_admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-terminal-bg text-center text-terminal-text">
        <div className="text-4xl">🚫</div>
        <h1 className="mt-3 text-xl font-extrabold text-terminal-red">Instructors only</h1>
        <Link to="/" className="mt-4 text-sm text-terminal-green underline">
          ‹ Back to the arena
        </Link>
      </div>
    );
  }

  const eventState = getEventState(game.event, now);
  const activeDay = game.days.find((d) => d.day === game.event?.active_day);
  // Everyone who entered the live day is shown, even at 0 points.
  const rows = game.leaderboard.slice(0, 20);
  const overflow = game.leaderboard.length - rows.length;
  const feed = game.announcements.slice(-8).slice().reverse();

  const timerLabel =
    eventState.status === 'running'
      ? formatDuration(eventState.remainingMs)
      : eventState.status === 'ended'
        ? "TIME'S UP"
        : 'WAITING';
  const timerColor =
    eventState.status === 'running'
      ? 'text-terminal-green'
      : eventState.status === 'ended'
        ? 'text-terminal-red'
        : 'text-terminal-amber';

  return (
    <div className="min-h-screen bg-terminal-bg p-6 text-terminal-text sm:p-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="mb-1 inline-flex items-center gap-1 text-xs text-terminal-dim underline decoration-dotted transition hover:text-terminal-green"
            >
              ‹ Back to arena
            </Link>
            <div className="text-xs uppercase tracking-[0.35em] text-terminal-dim">
              KGSP // CTF — Live Board
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-terminal-green drop-shadow-[0_0_10px_rgb(var(--c-green)/0.4)] sm:text-4xl">
              {activeDay?.title ?? 'No active day set'}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-terminal-dim">
              {eventState.status === 'running' ? 'Time remaining' : 'Status'}
            </div>
            <div className={`text-4xl font-extrabold tabular-nums sm:text-5xl ${timerColor}`}>
              {timerLabel}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Ranking */}
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
                    } ${hasPoints ? '' : 'opacity-60'}`}
                  >
                    <span className="w-10 shrink-0 text-center text-2xl font-extrabold text-terminal-dim">
                      {hasPoints && i < 3 ? medal[i] : i + 1}
                    </span>
                    <span className="text-3xl">{r.avatar}</span>
                    <span className="flex-1 truncate text-lg font-bold text-terminal-green sm:text-xl">
                      {r.username}
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

            {/* Live feed */}
            <div className="h-fit rounded-xl border border-terminal-border bg-terminal-panel p-4">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-terminal-cyan">
                ▸ Live feed
              </h2>
              <ul className="space-y-2.5 text-sm">
                {feed.length === 0 && (
                  <li className="text-terminal-dim">Waiting for the first solve…</li>
                )}
                {feed.map((a) => (
                  <li
                    key={a.id}
                    className={a.type === 'first_blood' ? 'text-terminal-red' : 'text-terminal-dim'}
                  >
                    <span className="mr-1">{a.type === 'first_blood' ? '🩸' : '✓'}</span>
                    <span className="mr-1">{a.avatar}</span>
                    <strong className="text-terminal-green">{a.username}</strong>{' '}
                    {a.type === 'first_blood' ? 'drew first blood on' : 'solved'}{' '}
                    <strong className="text-terminal-green">{a.challengeTitle}</strong>{' '}
                    <span className="text-terminal-amber">(+{a.points})</span>
                  </li>
                ))}
              </ul>
            </div>
        </div>
      </div>
    </div>
  );
}
