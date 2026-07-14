import { useEffect, useMemo, useState } from 'react';
import { formatDuration, getEventState, isFrozen, strobeMs } from '@/lib/time';
import useCountdown from '@/lib/useCountdown';
import type { EventConfig } from '@/lib/types';
import type { Game } from '@/lib/useGame';

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
        // The huge lg:/xl: scale is only safe for the numeric countdown (`19:58`
        // — short, monospace, tabular-nums keeps every frame the same width). The
        // status words ("TIME'S UP", "WAITING") are much wider strings; at the
        // same giant size they blew straight past the card's edges on both sides
        // instead of wrapping inside it. Word labels get their own, smaller scale.
        className={`mt-3 max-w-full break-words font-mono font-black leading-none ${color} ${
          status === 'running'
            ? 'text-7xl tabular-nums sm:text-8xl lg:text-[9rem] xl:text-[11rem]'
            : 'text-4xl sm:text-5xl lg:text-6xl xl:text-7xl'
        } ${critical ? 'animate-strobe' : ''}`}
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
function FrozenPanel({
  event,
  count,
  ended,
}: {
  event: EventConfig | null;
  count: number;
  ended: boolean;
}) {
  const mins = event?.freeze_minutes ?? 15;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-terminal-amber/40 bg-terminal-amber/5 p-10 text-center">
      <div className="animate-flicker text-6xl">{ended ? '🏁' : '🔒'}</div>
      <h2 className="mt-4 text-2xl font-extrabold text-terminal-amber sm:text-3xl">
        {ended ? 'Final reveal' : 'Standings frozen'}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-terminal-dim">
        {ended
          ? 'Time is up! The top 3 are revealed on the results cards. Full standings appear once the champion card is opened.'
          : `Hidden for the final ${mins} minutes. The winners are then revealed card by card.`}
      </p>
      <p className="mt-5 text-xs uppercase tracking-widest text-terminal-dim">
        {count} competitor{count === 1 ? '' : 's'} still in the running
      </p>
    </div>
  );
}

/**
 * The "present to the class" board — one of the tabs in the persistent header
 * (HeaderBar), rendered as normal in-page content below it (NOT a fixed
 * full-viewport overlay: that used to paint over the header, in a higher
 * stacking context than its `sticky`, and made switching tabs look like a
 * broken navigation to a different page). It reuses the arena's live `game`
 * object — the same realtime feed the arena already subscribes to — so it's
 * always in sync with zero extra network. Countdown sounds are owned by
 * <Timer> in the arena header, which stays mounted the whole time.
 */
export default function Board({ game, onClose }: { game: Game; onClose: () => void }) {
  const activeDayNum = game.event?.active_day ?? null;

  // Score-freeze for the final N minutes. Flip exactly at the freeze boundary and
  // again at time's up, rather than ticking every second — a per-second re-render
  // of this whole board was the old "shimmer".
  const [frozen, setFrozen] = useState(() => isFrozen(game.event, Date.now()));
  const [ended, setEnded] = useState(() => getEventState(game.event).status === 'ended');
  useEffect(() => {
    const ev = game.event;
    setFrozen(isFrozen(ev, Date.now()));
    setEnded(getEventState(ev).status === 'ended');
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
      // At time-up the freeze window closes, but the standings do NOT auto-reveal:
      // the winners come out card by card in the finale. Hand off to the ended
      // hold, which stays hidden until the champion card is turned.
      timers.push(
        window.setTimeout(() => {
          setFrozen(false);
          setEnded(true);
        }, end - now + 50),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [game.event]);

  // Numeric standings unlock only when the champion card is revealed
  // (finale_stage 3). Fewer than 3 scored players can't run the card reveal, so
  // don't trap the board in that case.
  const finaleStage = game.event?.finale_stage ?? -1;
  const scoredCount = game.leaderboard.filter(
    (r) => r.total_points > 0 || r.solves_count > 0,
  ).length;
  const resultsRevealed = finaleStage >= 3 || scoredCount < 3;
  const hideStandings = frozen || (ended && !resultsRevealed);

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

  return (
    <div className="bg-terminal-bg p-5 text-terminal-text sm:p-7">
      <div className="mx-auto max-w-[1600px]">
        {/* No brand eyebrow, mute toggle or close button here — the persistent
            HeaderBar above already owns all three (mute icon, and the "Arena" tab
            is the way back). Duplicating them made this look like a second,
            disconnected header rather than a tab of the same page. */}
        <header className="mb-5">
          <h1 className="text-xl font-extrabold text-terminal-green drop-shadow-[0_0_10px_rgb(var(--c-green)/0.4)] sm:text-2xl">
            {activeDay?.title ?? 'No active day set'}
          </h1>
        </header>

        {/* Column 1: the clock, on its own. Column 2: standings + activity. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(400px,0.85fr)_1.15fr]">
          {/* The clock owns this column outright. The competitor/solve tiles that used
              to sit under it are gone — from ten metres away nobody reads them, and
              they were stealing height from the only thing on the board that has to be
              legible from the back of the room. */}
          <section className="lg:sticky lg:top-7 lg:h-[calc(100vh-7rem)]">
            <BoardClock event={game.event} />
          </section>

          <section className="flex flex-col gap-5">
            {hideStandings ? (
              <FrozenPanel event={game.event} count={game.leaderboard.length} ended={ended} />
            ) : (
              // One shared grid template across every row, so rank, avatar, name,
              // solve count and score line up in true columns instead of each row
              // packing itself independently with flex. Names are a step smaller than
              // before — they were competing with the clock for attention and losing
              // the space that the solve feed needed.
              <ol className="space-y-1.5">
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
                      className={`grid grid-cols-[2.25rem_2rem_1fr_auto_4.5rem] items-center gap-3 rounded-lg border px-4 py-2 transition ${
                        podium
                          ? 'border-terminal-amber/40 bg-terminal-amber/5 shadow-neon-amber'
                          : 'border-terminal-border bg-terminal-panel'
                      }`}
                    >
                      <span className="text-center text-xl font-extrabold tabular-nums text-terminal-dim">
                        {podium ? medal[i] : i + 1}
                      </span>
                      <span className="text-center text-2xl leading-none">{r.avatar}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-base font-bold text-terminal-green">
                          {r.username}
                        </span>
                        {!hasPoints && (
                          <span className="shrink-0 rounded border border-terminal-dim/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-terminal-dim">
                            entered
                          </span>
                        )}
                      </span>
                      <span className="text-xs tabular-nums text-terminal-dim">{r.solves_count}★</span>
                      <span className="text-right text-xl font-extrabold tabular-nums text-terminal-amber">
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

            {/* The last 3 solves, given the room the tiles and the oversized rows were
                using. This is the part of the board that actually moves during a round,
                so it should be big enough to catch the eye from across the class. */}
            <div className="flex min-h-0 flex-1 flex-col">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-terminal-cyan">
                ▸ Latest solves
              </h2>
              <ul className="space-y-2.5">
                {feed.length === 0 && (
                  <li className="rounded-xl border border-dashed border-terminal-border px-4 py-10 text-center text-terminal-dim">
                    {game.loading ? 'Loading…' : 'No solves yet — waiting for the first flag! 🚩'}
                  </li>
                )}
                {feed.map((a) => (
                  <li
                    key={a.id}
                    className={`grid grid-cols-[2.5rem_3rem_1fr_auto] items-center gap-3 rounded-xl border px-4 py-3.5 ${
                      a.type === 'first_blood'
                        ? 'border-terminal-red/50 bg-terminal-red/5'
                        : 'border-terminal-border bg-terminal-panel'
                    }`}
                  >
                    <span className="text-center text-2xl">
                      {a.type === 'first_blood' ? '🩸' : '✓'}
                    </span>
                    {/* While standings are hidden (freeze, or the post-time-up
                        reveal window) the feed keeps flowing so the room still
                        feels the action, but names/points are masked so it can't
                        leak who's climbing before the cards are opened. */}
                    <span className="text-center text-3xl leading-none">
                      {hideStandings ? '🕵️' : a.avatar}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold text-terminal-green">
                        {hideStandings ? 'Anonymous' : a.username}
                      </span>
                      <span className="block truncate text-sm text-terminal-dim">
                        {a.type === 'first_blood' ? 'first blood · ' : ''}
                        <span className="text-terminal-text">{a.challengeTitle}</span>
                      </span>
                    </span>
                    <span className="text-right text-2xl font-extrabold tabular-nums text-terminal-amber">
                      {hideStandings ? '🔒' : `+${a.points}`}
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
