import { useEffect, useState } from 'react';
import type { Day, LeaderboardRow } from '../lib/types';
import { fetchDayLeaderboard } from '../lib/api';

const medal = ['🥇', '🥈', '🥉'];

export default function Leaderboard({
  rows,
  meId,
  frozen = false,
  days = [],
  activeDay = null,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  frozen?: boolean;
  /** All days, so students can browse a previous day's board. */
  days?: Day[];
  /** The day currently "live" — its board is `rows`, kept in realtime sync. */
  activeDay?: number | null;
}) {
  const [viewDay, setViewDay] = useState<number | null>(activeDay);
  const [overrideRows, setOverrideRows] = useState<LeaderboardRow[] | null>(null);
  const [loadingOverride, setLoadingOverride] = useState(false);

  // If the admin changes the active day while this is open, snap back to it.
  useEffect(() => {
    setViewDay(activeDay);
    setOverrideRows(null);
  }, [activeDay]);

  const isViewingActive = viewDay === activeDay || viewDay == null;
  const displayRows = isViewingActive ? rows : overrideRows ?? rows;

  async function handleSelectDay(day: number) {
    setViewDay(day);
    if (day === activeDay) {
      setOverrideRows(null);
      return;
    }
    setLoadingOverride(true);
    try {
      setOverrideRows(await fetchDayLeaderboard(day));
    } catch {
      setOverrideRows([]);
    } finally {
      setLoadingOverride(false);
    }
  }

  const ranked = displayRows.filter((r) => r.total_points > 0 || r.solves_count > 0);
  const idle = displayRows.filter((r) => r.total_points === 0 && r.solves_count === 0);
  const browsableDays = days.filter((d) => !d.is_rest).slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel">
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">▸ Leaderboard</h2>
        <span className="text-xs text-terminal-dim">{displayRows.length} players</span>
      </div>

      {browsableDays.length > 1 && (
        <div className="flex items-center gap-2 border-b border-terminal-border/60 px-4 py-2">
          <span className="text-[10px] uppercase tracking-widest text-terminal-dim">Viewing</span>
          <select
            value={viewDay ?? ''}
            onChange={(e) => handleSelectDay(Number(e.target.value))}
            className="flex-1 rounded border border-terminal-border bg-terminal-input px-2 py-1 text-xs text-terminal-green outline-none focus:border-terminal-green"
          >
            {browsableDays.map((d) => (
              <option key={d.day} value={d.day}>
                {d.title} {d.day === activeDay ? '· live' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {frozen && isViewingActive ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="text-4xl">🕶️</span>
          <p className="font-bold text-terminal-amber">SCOREBOARD FROZEN</p>
          <p className="text-xs leading-relaxed text-terminal-dim">
            The scores are hidden for the final minutes. Nobody can see the ranking now —
            keep solving, the winners are revealed when time runs out!
          </p>
        </div>
      ) : loadingOverride ? (
        <p className="px-4 py-10 text-center text-sm text-terminal-dim">Loading…</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {ranked.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-terminal-dim">
              No solves yet. Be the first to draw blood. 🩸
            </p>
          )}

          <ol>
            {ranked.map((r, i) => {
              const me = r.player_id === meId;
              return (
                <li
                  key={r.player_id}
                  className={`flex items-center gap-3 border-b border-terminal-border/50 px-4 py-2.5 ${
                    me ? 'bg-terminal-green/10' : i < 3 ? 'bg-terminal-strong/[0.04]' : ''
                  }`}
                >
                  <span className="w-7 shrink-0 text-center text-sm font-bold text-terminal-dim">
                    {i < 3 ? medal[i] : i + 1}
                  </span>
                  <span
                    className={`flex-1 truncate font-semibold ${me ? 'text-terminal-green' : 'text-terminal-green/90'}`}
                  >
                    <span className="mr-1.5">{r.avatar ?? '🕵️'}</span>
                    {r.username}
                    {me && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-terminal-dim">
                        you
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-terminal-dim">{r.solves_count}★</span>
                  <span className="w-16 shrink-0 text-right font-bold tabular-nums text-terminal-amber">
                    {r.total_points}
                  </span>
                </li>
              );
            })}
          </ol>

          {idle.length > 0 && (
            <div className="px-4 py-2 text-[11px] text-terminal-dim">
              + {idle.length} player{idle.length > 1 ? 's' : ''} waiting to score
            </div>
          )}
        </div>
      )}
    </div>
  );
}
