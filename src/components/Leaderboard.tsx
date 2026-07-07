import { memo, useEffect, useRef, useState } from 'react';
import type { Day, LeaderboardRow } from '../lib/types';
import { fetchDayLeaderboard } from '../lib/api';

const medal = ['🥇', '🥈', '🥉'];

function Leaderboard({
  rows,
  meId,
  days = [],
  activeDay = null,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  /** Days worth browsing on the board (already filtered by the parent). */
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

  const browsableDays = days.filter((d) => !d.is_rest).slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel">
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">▸ Leaderboard</h2>
        <span className="text-xs text-terminal-dim">
          {displayRows.length} {displayRows.length === 1 ? 'competitor' : 'competitors'}
        </span>
      </div>

      {browsableDays.length > 1 && (
        <div className="flex items-center gap-2 border-b border-terminal-border/60 px-4 py-2">
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-terminal-dim">Viewing</span>
          <DayPicker
            days={browsableDays}
            activeDay={activeDay}
            value={viewDay}
            onSelect={handleSelectDay}
          />
        </div>
      )}

      {loadingOverride ? (
        <p className="px-4 py-10 text-center text-sm text-terminal-dim">Loading…</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {displayRows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-terminal-dim">
              No one has entered this day yet. 🕵️
            </p>
          ) : (
            <ol>
              {displayRows.map((r, i) => {
                const me = r.player_id === meId;
                const hasPoints = r.total_points > 0;
                return (
                  <li
                    key={r.player_id}
                    className={`flex items-center gap-3 border-b border-terminal-border/50 px-4 py-2.5 ${
                      me ? 'bg-terminal-green/10' : hasPoints && i < 3 ? 'bg-terminal-strong/[0.04]' : ''
                    }`}
                  >
                    <span className="w-7 shrink-0 text-center text-sm font-bold text-terminal-dim">
                      {hasPoints && i < 3 ? medal[i] : i + 1}
                    </span>
                    <span
                      className={`flex min-w-0 flex-1 items-center font-semibold ${me ? 'text-terminal-green' : 'text-terminal-green/90'}`}
                    >
                      <span className="mr-1.5 inline-block w-5 shrink-0 text-center">{r.avatar ?? '🕵️'}</span>
                      <span className="min-w-0 flex-1 truncate">{r.username}</span>
                      {me && (
                        <span className="ml-2 shrink-0 text-[10px] uppercase tracking-widest text-terminal-dim">
                          you
                        </span>
                      )}
                      {!hasPoints && !me && (
                        <span className="ml-2 shrink-0 text-[10px] uppercase tracking-widest text-terminal-dim">
                          entered
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
          )}
        </div>
      )}
    </div>
  );
}

// A themed dropdown that renders its menu *inside* the card (absolutely
// positioned) instead of relying on the browser's native <select> popup,
// which broke out of the panel's frame and looked out of place.
function DayPicker({
  days,
  activeDay,
  value,
  onSelect,
}: {
  days: Day[];
  activeDay: number | null;
  value: number | null;
  onSelect: (day: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = days.find((d) => d.day === value) ?? days.find((d) => d.day === activeDay) ?? days[0];

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded border border-terminal-border bg-terminal-input px-2 py-1 text-xs text-terminal-green outline-none transition hover:border-terminal-green focus:border-terminal-green"
      >
        <span className="truncate">
          {current?.title ?? 'Select day'}
          {current?.day === activeDay && <span className="ml-1 text-terminal-dim">· live</span>}
        </span>
        <span className={`shrink-0 text-terminal-dim transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <ul className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded border border-terminal-border bg-terminal-panel py-1 shadow-neon">
          {days.map((d) => {
            const selected = d.day === value;
            return (
              <li key={d.day}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(d.day);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-terminal-green/10 ${
                    selected ? 'bg-terminal-green/10 text-terminal-green' : 'text-terminal-green/80'
                  }`}
                >
                  <span className="truncate">{d.title}</span>
                  {d.day === activeDay && (
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-terminal-dim">live</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Memoized so the per-second clock tick in the arena doesn't re-render (and
// visibly flicker/reshuffle) the whole board. It only re-renders when the
// actual data — rows, days, the active day or the viewer — changes.
export default memo(Leaderboard);
