import { useEffect, useRef, useState } from 'react';
import type { LeaderboardRow } from '../lib/types';
import { playFanfare, playReveal } from '../lib/sounds';

// Kahoot-style finale: reveal 3rd, then 2nd, then 1st, one at a time with
// sound and animation. `stage` counts how many places have been revealed.
export default function Podium({
  rows,
  meId,
  onClose,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  onClose: () => void;
}) {
  const top = rows.filter((r) => r.total_points > 0 || r.solves_count > 0).slice(0, 3);
  const [stage, setStage] = useState(0); // 0 none, 1=3rd, 2=+2nd, 3=+1st
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // Reveal order is 3rd, 2nd, 1st. `count` = how many places exist.
    const count = [3, 2, 1].filter((p) => top.length >= p).length;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let d = 900;
    for (let step = 1; step <= count; step++) {
      const isFirstPlace = step === count; // final reveal is 1st place
      const placeRevealed = 3 - (step - 1) - (3 - count); // 3, then 2, then 1
      const t = window.setTimeout(() => {
        setStage(step);
        if (isFirstPlace) playFanfare();
        else playReveal(placeRevealed);
      }, d);
      timers.current.push(t);
      d += 1600;
    }
    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function revealAll() {
    timers.current.forEach(clearTimeout);
    setStage(top.length);
    playFanfare();
  }

  // Map: which places are visible given stage. Reveal order is 3rd,2nd,1st,
  // so after `stage` reveals, the visible places are the last `stage` of [3,2,1].
  const revealOrder = [3, 2, 1].filter((p) => top.length >= p);
  const visiblePlaces = new Set(revealOrder.slice(0, stage));

  const byPlace = (place: number) => top[place - 1];
  const heights: Record<number, string> = { 1: 'h-44', 2: 'h-32', 3: 'h-24' };
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const glow: Record<number, string> = {
    1: 'border-terminal-amber shadow-neon-amber',
    2: 'border-terminal-dim',
    3: 'border-terminal-border',
  };

  function Column({ place }: { place: number }) {
    const row = byPlace(place);
    const shown = visiblePlaces.has(place) && row;
    return (
      <div className="flex w-24 flex-col items-center justify-end sm:w-32">
        {shown && (
          <div className="mb-2 animate-rise text-center">
            <div className="text-3xl">{medals[place]}</div>
            <div className="max-w-[8rem] truncate text-sm font-bold text-terminal-green">
              {row.username}
              {row.player_id === meId && (
                <span className="ml-1 text-[10px] uppercase text-terminal-dim">you</span>
              )}
            </div>
            <div className="text-lg font-extrabold tabular-nums text-terminal-amber">
              {row.total_points}
            </div>
          </div>
        )}
        <div
          className={`w-full ${heights[place]} rounded-t-lg border-2 ${
            shown ? glow[place] : 'border-terminal-border/40'
          } bg-terminal-panel transition-all duration-500 ${shown ? 'opacity-100' : 'opacity-30'} flex items-start justify-center pt-2`}
        >
          <span className="text-2xl font-extrabold text-terminal-dim">{place}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-terminal-bg/95 p-6 backdrop-blur">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded border border-terminal-border px-3 py-1 text-sm text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
      >
        ✕ close
      </button>

      <h1 className="mb-1 text-center text-3xl font-extrabold text-terminal-green drop-shadow-[0_0_12px_rgb(var(--c-green)/0.5)] sm:text-4xl">
        🏁 FINAL RESULTS
      </h1>
      <p className="mb-8 text-center text-sm text-terminal-dim">
        {stage < top.length ? 'Revealing the winners…' : 'Congratulations to our top hackers!'}
      </p>

      {top.length === 0 ? (
        <p className="text-terminal-dim">No scores were recorded this round.</p>
      ) : (
        <div className="flex items-end justify-center gap-3 sm:gap-5">
          {revealOrder.includes(2) && <Column place={2} />}
          <Column place={1} />
          {revealOrder.includes(3) && <Column place={3} />}
        </div>
      )}

      <div className="mt-10 flex gap-3">
        {stage < top.length && (
          <button
            onClick={revealAll}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-2 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20"
          >
            Reveal all ▸
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-lg border border-terminal-border px-5 py-2 text-sm font-bold uppercase tracking-widest text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
        >
          Back to board
        </button>
      </div>
    </div>
  );
}
