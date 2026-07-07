import { useEffect, useRef, useState } from 'react';
import type { LeaderboardRow } from '../lib/types';
import { playFanfare, playReveal, playTick } from '../lib/sounds';

// Timing: real suspense, not a quick slideshow. Each place gets its own
// countdown before it's revealed, plus a pause afterward to let it land.
const INITIAL_DELAY_MS = 1200;
const COUNTDOWN_SECONDS = 3;
const GAP_AFTER_REVEAL_MS = 2200;

type Phase = 'idle' | 'announcing' | 'revealed' | 'done';

// Kahoot-style finale: reveal 3rd, then 2nd, then 1st — one at a time, with a
// real countdown and a pause between each so it actually feels live.
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
  const revealOrder = [3, 2, 1].filter((p) => top.length >= p);

  const [stage, setStage] = useState(0); // how many places are fully revealed
  const [phase, setPhase] = useState<Phase>('idle');
  const [announcingPlace, setAnnouncingPlace] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStage(0);
    setPhase('idle');
    setAnnouncingPlace(null);

    if (revealOrder.length === 0) return;

    function schedule(fn: () => void, delay: number) {
      const id = window.setTimeout(fn, delay);
      timers.current.push(id);
      return id;
    }

    function runStep(index: number, baseDelay: number) {
      const place = revealOrder[index];
      const isLast = index === revealOrder.length - 1;

      // Announce + countdown for this place.
      schedule(() => {
        setPhase('announcing');
        setAnnouncingPlace(place);
        setCountdown(COUNTDOWN_SECONDS);
        for (let s = 1; s < COUNTDOWN_SECONDS; s++) {
          schedule(() => {
            setCountdown(COUNTDOWN_SECONDS - s);
            playTick();
          }, s * 1000);
        }
      }, baseDelay);

      // Reveal this place.
      const revealAt = baseDelay + COUNTDOWN_SECONDS * 1000;
      schedule(() => {
        setPhase('revealed');
        setAnnouncingPlace(null);
        setStage(index + 1);
        if (isLast) playFanfare();
        else playReveal(place);
      }, revealAt);

      if (isLast) {
        schedule(() => setPhase('done'), revealAt + 600);
      } else {
        runStep(index + 1, revealAt + GAP_AFTER_REVEAL_MS);
      }
    }

    runStep(0, INITIAL_DELAY_MS);

    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top.length]);

  function revealAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnnouncingPlace(null);
    setStage(top.length);
    setPhase('done');
    playFanfare();
  }

  const visiblePlaces = new Set(revealOrder.slice(0, stage));
  const byPlace = (place: number) => top[place - 1];
  const heights: Record<number, string> = { 1: 'h-44', 2: 'h-32', 3: 'h-24' };
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const placeName: Record<number, string> = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD' };
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
          <div className="mb-3 animate-rise text-center duration-700">
            <div className="text-3xl">{medals[place]}</div>
            <div className="mt-1 text-2xl">{row.avatar ?? '🕵️'}</div>
            <div className="mt-1 max-w-[8rem] truncate text-sm font-bold text-terminal-green">
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
          } bg-terminal-panel transition-all duration-700 ${shown ? 'opacity-100' : 'opacity-30'} flex items-start justify-center pt-2`}
        >
          <span className="text-2xl font-extrabold text-terminal-dim">{place}</span>
        </div>
      </div>
    );
  }

  const headline =
    phase === 'idle'
      ? 'Get ready…'
      : phase === 'announcing'
        ? `Revealing ${placeName[announcingPlace ?? 0]} place…`
        : phase === 'done'
          ? 'Congratulations to our top hackers!'
          : 'Locked in.';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-terminal-bg/95 p-6 backdrop-blur">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded border border-terminal-border px-3 py-1 text-sm text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
      >
        ✕ close
      </button>

      <h1 className="mb-2 text-center text-3xl font-extrabold text-terminal-green drop-shadow-[0_0_12px_rgb(var(--c-green)/0.5)] sm:text-4xl">
        🏁 FINAL RESULTS
      </h1>

      <div className="mb-8 flex h-16 flex-col items-center justify-center text-center">
        <p className="text-sm uppercase tracking-widest text-terminal-dim">{headline}</p>
        {phase === 'announcing' && (
          <p className="mt-2 animate-pulse text-4xl font-extrabold tabular-nums text-terminal-amber">
            {countdown}
          </p>
        )}
      </div>

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
        {phase !== 'done' && (
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
