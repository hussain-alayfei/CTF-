import { useEffect, useRef, useState } from 'react';
import type { EventConfig, LeaderboardRow } from '../lib/types';
import { adminSetFinaleStage } from '../lib/api';
import { playCardFlip, playCountdownBeep, playFanfare, playReveal } from '../lib/sounds';
import useLockBodyScroll from '../lib/useLockBodyScroll';
import Fireworks from './Fireworks';

// The reveal runs 3rd → 2nd → 1st. The winner gets a longer countdown and a
// bigger show than the runners-up; that asymmetry is the whole point.
const COUNTDOWN_FOR: Record<number, number> = { 3: 3, 2: 3, 1: 5 };
const HOLD_MS = 7000; // how long a runner-up's reveal stays up before returning to the cards

type Phase = 'count' | 'show';
interface Takeover {
  place: number;
  phase: Phase;
}

/** finale_stage 1/2/3 → podium place 3rd/2nd/1st. */
function stageToPlace(stage: number): number {
  return stage === 1 ? 3 : stage === 2 ? 2 : 1;
}

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const placeName: Record<number, string> = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD' };
const accent: Record<number, string> = {
  1: 'text-terminal-amber',
  2: 'text-terminal-cyan',
  3: 'text-terminal-green',
};
const cardBorder: Record<number, string> = {
  1: 'border-terminal-amber shadow-neon-amber',
  2: 'border-terminal-cyan/70',
  3: 'border-terminal-green/60',
};

/**
 * The finale, driven by `event.finale_stage` so that every screen in the room
 * reveals together: the instructor clicks a card, the stage is written to
 * event_config, and the realtime feed the arena already has does the rest.
 *
 * Layout note (this is a regression guard, not decoration): the old podium was a
 * `justify-center` fixed overlay with fixed-height info boxes, so on a laptop the
 * tallest column — 1st place — overflowed the top edge and the *winner's name was
 * the one thing you couldn't see*. Everything here is content-sized and scrolls
 * from the top, never centered-with-overflow.
 */
export default function Finale({
  rows,
  meId,
  event,
  isAdmin,
  adminSecret,
  onClose,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  event: EventConfig | null;
  isAdmin: boolean;
  adminSecret: string;
  onClose: () => void;
}) {
  useLockBodyScroll();

  const top = rows.filter((r) => r.total_points > 0 || r.solves_count > 0).slice(0, 3);
  const byPlace = (place: number) => top[place - 1];
  const stage = event?.finale_stage ?? -1;
  // Only offer cards we actually have a person for.
  const places = [3, 2, 1].filter((p) => top.length >= p);

  const [takeover, setTakeover] = useState<Takeover | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const prevStage = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const schedule = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };

    const prev = prevStage.current;
    prevStage.current = stage;

    // First render: land on the card table at whatever stage the room is at, and
    // replay NOTHING. A screen that joins late — or refreshes after the reveal —
    // gets the cards it has already earned, face up, and can walk away.
    //
    // This used to drop a refreshing screen straight into the winner's full-screen
    // takeover, which had no exit but a small ✕ and (with the old never-ending
    // fireworks) no way to stop the show. That was the "refresh gets stuck on the
    // results" trap: the takeover is a *moment*, so it may only ever be entered by
    // living through a stage advance, never by mounting into one.
    if (prev === null) return;
    if (stage <= prev || stage < 1) {
      if (stage < 1) setTakeover(null);
      return;
    }

    // A genuine advance — run the show.
    clearAll();
    const place = stageToPlace(stage);
    const n = COUNTDOWN_FOR[place] ?? 3;

    playCardFlip();
    setCount(n);
    setTakeover({ place, phase: 'count' });

    for (let s = 0; s < n; s++) {
      schedule(() => {
        const left = n - s;
        setCount(left);
        playCountdownBeep(left <= 3 ? left : 10);
      }, s * 1000);
    }

    schedule(() => {
      setTakeover({ place, phase: 'show' });
      if (place === 1) playFanfare();
      else playReveal(place);
    }, n * 1000);

    // Runners-up hand the screen back to the cards; the winner's screen is the end
    // of the show and stays up until the instructor closes it.
    if (place !== 1) {
      schedule(() => setTakeover(null), n * 1000 + HOLD_MS);
    }

    return clearAll;
  }, [stage]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function advanceTo(nextStage: number) {
    if (!isAdmin || busy) return;
    setBusy(true);
    try {
      await adminSetFinaleStage(adminSecret, nextStage);
    } catch {
      /* the realtime update is the source of truth; a failed click just does nothing */
    } finally {
      setBusy(false);
    }
  }

  // Which card is next to be opened? Cards must be opened in order.
  const nextStage = stage < 1 ? 1 : stage + 1;
  const nextPlace = nextStage <= 3 ? stageToPlace(nextStage) : null;

  // A card stays face down while its own countdown is still running. The stage has
  // already advanced by then, so without this the card would flip the instant the
  // instructor clicked — and the answer would be sitting on the table behind the
  // "3… 2… 1…", which is exactly the suspense we're trying to build.
  const counting = takeover?.phase === 'count' ? takeover.place : null;
  const isRevealed = (place: number) =>
    stage >= (place === 3 ? 1 : place === 2 ? 2 : 3) && counting !== place;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-terminal-bg/[0.98]">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgb(var(--c-amber) / 0.10), transparent 55%), radial-gradient(circle at 50% 100%, rgb(var(--c-green) / 0.08), transparent 50%)',
        }}
      />

      <button
        onClick={onClose}
        className="fixed right-4 top-4 z-30 rounded border border-terminal-border bg-terminal-bg/80 px-3 py-1 text-sm text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
      >
        ✕ close
      </button>

      {/* ---------- Card table ---------- */}
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-10">
        <div className="text-[11px] uppercase tracking-[0.5em] text-terminal-dim">KGSP // CTF</div>
        <h1 className="mt-1 text-center text-4xl font-black tracking-tight text-terminal-green drop-shadow-[0_0_18px_rgb(var(--c-green)/0.6)] sm:text-6xl">
          🏁 FINAL RESULTS
        </h1>
        <p className="mt-3 min-h-[1.5rem] text-center text-sm uppercase tracking-[0.3em] text-terminal-dim">
          {top.length === 0
            ? 'No scores were recorded this round.'
            : stage >= 3
              ? '🏆 Congratulations to our champion!'
              : isAdmin
                ? `Click the ${nextPlace === 1 ? '🥇' : nextPlace === 2 ? '🥈' : '🥉'} card to reveal ${placeName[nextPlace ?? 3]} place`
                : 'Watch the big screen…'}
        </p>

        {top.length > 0 && (
          <div className="mt-10 flex w-full flex-wrap items-stretch justify-center gap-5 sm:gap-8">
            {places.map((place) => {
              const row = byPlace(place);
              const revealed = isRevealed(place);
              const isNext = place === nextPlace;
              const clickable = isAdmin && isNext && !busy && !takeover;
              return (
                <button
                  key={place}
                  disabled={!clickable}
                  onClick={() => advanceTo(nextStage)}
                  className={`relative flex w-56 flex-col items-center justify-center rounded-2xl border-2 px-5 py-8 transition sm:w-64 ${
                    revealed
                      ? `${cardBorder[place]} bg-terminal-panel`
                      : 'border-dashed border-terminal-border bg-terminal-panel/50'
                  } ${
                    clickable
                      ? 'animate-card-idle cursor-pointer hover:border-terminal-amber hover:shadow-neon-amber'
                      : 'cursor-default'
                  }`}
                >
                  {revealed && row ? (
                    <div className="animate-pop flex flex-col items-center text-center">
                      <div className="text-5xl">{medals[place]}</div>
                      <div className="mt-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-terminal-border bg-terminal-bg text-3xl">
                        {row.avatar ?? '🕵️'}
                      </div>
                      <div className="mt-3 max-w-full break-words text-xl font-extrabold text-terminal-green">
                        {row.username}
                        {row.player_id === meId && (
                          <span className="ml-1 text-[10px] uppercase text-terminal-dim">you</span>
                        )}
                      </div>
                      <div className={`text-2xl font-black tabular-nums ${accent[place]}`}>
                        {row.total_points}
                        <span className="ml-1 text-[10px] font-normal uppercase text-terminal-dim">
                          pts
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
                        {row.solves_count} solve{row.solves_count === 1 ? '' : 's'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="text-6xl opacity-40 grayscale">{medals[place]}</div>
                      <div className="mt-4 text-5xl text-terminal-dim">?</div>
                      <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-terminal-dim">
                        {placeName[place]} place
                      </div>
                      {clickable && (
                        <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-terminal-amber">
                          ▸ click to open
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Once every card is up the show is over — but the instructor may want to
            run the winner's moment again for the room (or for a photo). Explicit,
            never automatic: mounting into the finale must stay calm. */}
        {stage >= 3 && isAdmin && (
          <button
            onClick={() => setTakeover({ place: 1, phase: 'show' })}
            className="mt-10 rounded-lg border border-terminal-amber/60 bg-terminal-amber/10 px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20"
          >
            ⟲ Replay the winner
          </button>
        )}
      </div>

      {/* ---------- Full-screen reveal takeover ---------- */}
      {takeover && <RevealTakeover takeover={takeover} count={count} row={byPlace(takeover.place)} />}
    </div>
  );
}

/**
 * The moment itself: a full-screen takeover with the countdown, then the name in
 * the biggest type on the screen with fireworks behind it. Hoisted out of Finale
 * on purpose — declaring it inline would give it a new component identity on every
 * render, remounting it (and restarting its animations) on every countdown tick.
 */
function RevealTakeover({
  takeover,
  count,
  row,
}: {
  takeover: Takeover;
  count: number;
  row: LeaderboardRow | undefined;
}) {
  const { place, phase } = takeover;
  const isWinner = place === 1;
  const showing = phase === 'show';

  // Scroll-safe centering. `justify-center` on a fixed, overflowing container
  // pushes the top of the content above the viewport where it CANNOT be scrolled
  // to — that is precisely how the old podium hid the winner. The `min-h-full`
  // inner wrapper centers while the content fits and falls back to scrolling from
  // the top when it doesn't, so a long name can never eat the name.
  //
  // The backdrop is fully opaque on purpose: at 95% the card table showed through,
  // and you could read the winner's name behind their own countdown.
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto overflow-x-hidden bg-terminal-bg">
      {showing && <Fireworks intensity={isWinner ? 2 : 1} />}

      <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-10">
        {phase === 'count' ? (
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="text-sm uppercase tracking-[0.4em] text-terminal-dim sm:text-lg">
              Decrypting {placeName[place]} place…
            </div>
            <div
              key={count}
              className={`animate-slam mt-6 font-mono text-[8rem] font-black leading-none tabular-nums sm:text-[14rem] ${accent[place]}`}
              style={{ filter: 'drop-shadow(0 0 40px currentColor)' }}
            >
              {count}
            </div>
          </div>
        ) : (
          <div
            className={`relative z-10 flex flex-col items-center text-center ${isWinner ? 'animate-shake' : ''}`}
          >
            <div className="text-5xl sm:text-7xl">{medals[place]}</div>
            <div className="mt-2 text-sm uppercase tracking-[0.4em] text-terminal-dim sm:text-base">
              {placeName[place]} PLACE
            </div>

            <div
              className={`animate-slam mt-3 max-w-[92vw] break-words text-5xl font-black leading-tight sm:text-7xl lg:text-8xl ${accent[place]}`}
              style={{ filter: 'drop-shadow(0 0 45px currentColor)' }}
            >
              {row?.username ?? '—'}
            </div>

            <div className="mt-5 flex items-center gap-5">
              <div className="text-4xl sm:text-5xl">{row?.avatar ?? '🕵️'}</div>
              <div className="text-left">
                <div className="text-3xl font-black tabular-nums text-terminal-amber sm:text-4xl">
                  {row?.total_points ?? 0}
                  <span className="ml-2 text-sm font-normal uppercase text-terminal-dim">pts</span>
                </div>
                <div className="text-xs uppercase tracking-widest text-terminal-dim">
                  {row?.solves_count ?? 0} solve{row?.solves_count === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {isWinner && (
              <div className="mt-6 animate-flicker text-2xl font-black uppercase tracking-[0.3em] text-terminal-amber sm:text-3xl">
                🎉 CHAMPION 🎉
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
