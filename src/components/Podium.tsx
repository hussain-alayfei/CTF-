import { useEffect, useRef, useState } from 'react';
import type { LeaderboardRow } from '../lib/types';
import { playFanfare, playReveal, playTick } from '../lib/sounds';
import useLockBodyScroll from '../lib/useLockBodyScroll';

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
  useLockBodyScroll();
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
  // Taller, more dramatic bars. 1st towers over the others.
  const heights: Record<number, string> = { 1: 'h-56 sm:h-72', 2: 'h-40 sm:h-52', 3: 'h-28 sm:h-40' };
  const colWidth: Record<number, string> = { 1: 'w-28 sm:w-40', 2: 'w-24 sm:w-32', 3: 'w-24 sm:w-32' };
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const placeName: Record<number, string> = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD' };
  const barStyle: Record<number, string> = {
    1: 'border-terminal-amber bg-gradient-to-b from-terminal-amber/25 to-terminal-amber/5 shadow-neon-amber',
    2: 'border-terminal-cyan/70 bg-gradient-to-b from-terminal-cyan/15 to-terminal-cyan/5',
    3: 'border-terminal-green/60 bg-gradient-to-b from-terminal-green/15 to-terminal-green/5',
  };
  const rankColor: Record<number, string> = {
    1: 'text-terminal-amber',
    2: 'text-terminal-cyan',
    3: 'text-terminal-green',
  };

  function Column({ place }: { place: number }) {
    const row = byPlace(place);
    const shown = !!(visiblePlaces.has(place) && row);
    const isFirst = place === 1;
    return (
      <div className={`flex flex-col items-center justify-end ${colWidth[place]}`}>
        {/* Reserved info area — always occupies space so revealing a place
            never reflows/shifts the other columns (no "name lag"). Content just
            fades + scales in. */}
        <div
          className={`mb-3 flex h-40 flex-col items-center justify-end text-center transition-all duration-500 sm:h-48 ${
            shown ? 'animate-pop opacity-100' : 'opacity-0'
          }`}
        >
          {row && (
            <>
              {isFirst && <div className="text-3xl leading-none sm:text-4xl">👑</div>}
              <div className="text-4xl sm:text-5xl">{medals[place]}</div>
              <div
                className={`mt-1 flex h-16 w-16 items-center justify-center rounded-full border-2 text-3xl sm:h-20 sm:w-20 sm:text-4xl ${
                  isFirst ? 'border-terminal-amber shadow-neon-amber' : 'border-terminal-border'
                } bg-terminal-panel`}
              >
                {row.avatar ?? '🕵️'}
              </div>
              <div className="mt-2 max-w-[10rem] truncate text-base font-extrabold text-terminal-green sm:text-lg">
                {row.username}
                {row.player_id === meId && (
                  <span className="ml-1 text-[10px] uppercase text-terminal-dim">you</span>
                )}
              </div>
              <div className="text-xl font-black tabular-nums text-terminal-amber sm:text-2xl">
                {row.total_points}
                <span className="ml-1 text-[10px] font-normal uppercase text-terminal-dim">pts</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
                {row.solves_count} solve{row.solves_count === 1 ? '' : 's'}
              </div>
            </>
          )}
        </div>
        <div
          className={`flex w-full ${heights[place]} items-start justify-center rounded-t-xl border-2 pt-3 transition-all duration-700 ${
            shown ? `${barStyle[place]} opacity-100` : 'border-terminal-border/30 bg-terminal-panel/40 opacity-40'
          } ${isFirst && shown ? 'animate-flicker' : ''}`}
        >
          <span className={`text-4xl font-black sm:text-6xl ${shown ? rankColor[place] : 'text-terminal-dim/50'}`}>
            {place}
          </span>
        </div>
      </div>
    );
  }

  const headline =
    phase === 'idle'
      ? 'Initializing final standings…'
      : phase === 'announcing'
        ? `Decrypting ${placeName[announcingPlace ?? 0]} place…`
        : phase === 'done'
          ? '🏆 Congratulations to our top hackers!'
          : 'Locked in.';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-terminal-bg/[0.98] p-6">
      {/* Ambient glow backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgb(var(--c-amber) / 0.10), transparent 55%), radial-gradient(circle at 50% 100%, rgb(var(--c-green) / 0.08), transparent 50%)',
        }}
      />

      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded border border-terminal-border px-3 py-1 text-sm text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
      >
        ✕ close
      </button>

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-1 text-[11px] uppercase tracking-[0.5em] text-terminal-dim">KGSP // CTF</div>
        <h1 className="mb-2 text-center text-4xl font-black tracking-tight text-terminal-green drop-shadow-[0_0_18px_rgb(var(--c-green)/0.6)] sm:text-6xl">
          🏁 FINAL RESULTS
        </h1>

        <div className="mb-8 flex h-20 flex-col items-center justify-center text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-terminal-dim sm:text-base">{headline}</p>
          {phase === 'announcing' && (
            <p className="mt-2 animate-pulse text-6xl font-black tabular-nums text-terminal-amber drop-shadow-[0_0_16px_rgb(var(--c-amber)/0.6)]">
              {countdown}
            </p>
          )}
        </div>

        {top.length === 0 ? (
          <p className="text-terminal-dim">No scores were recorded this round.</p>
        ) : (
          <div className="flex items-end justify-center gap-4 sm:gap-8">
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
    </div>
  );
}
