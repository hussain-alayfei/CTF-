import { useEffect, useRef, useState } from 'react';
import type { EventConfig } from '../lib/types';
import { formatDuration, getEventState } from '../lib/time';
import { playTick, playTimeUp } from '../lib/sounds';

// Standalone clock — used only to drive countdown sound cues on the arena page.
// The large visual display lives in the ArenaTimerBanner below.
const TIMEUP_ROUND_KEY = 'kgsp_ctf_timeup_round';

function SoundClock({ event }: { event: EventConfig | null }) {
  const [now, setNow] = useState(Date.now());
  const lastTickSec = useRef<number>(-1);
  // Tracks the status on the previous render so we only fire the "time's up"
  // sound on a genuine live running -> ended transition. Starts null so a fresh
  // mount straight into an already-ended round (i.e. a page refresh after the
  // event finished) never replays the sound.
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    const end = event?.ends_at ? Date.parse(event.ends_at) : null;
    if (end != null && Date.now() >= end) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (end != null && Date.now() >= end + 500) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [event]);

  const state = getEventState(event, now);

  useEffect(() => {
    const status = state.status;
    if (status === 'running') {
      const secs = Math.ceil(state.remainingMs / 1000);
      if (secs <= 10 && secs > 0 && secs !== lastTickSec.current) {
        lastTickSec.current = secs;
        playTick();
      }
    } else if (status === 'ended' && prevStatus.current === 'running') {
      // Only on a real live transition, and only once per round (keyed by the
      // round's ends_at) so refreshing the page after it ended stays silent.
      const roundKey = event?.ends_at ?? '';
      let announced: string | null = null;
      try {
        announced = sessionStorage.getItem(TIMEUP_ROUND_KEY);
      } catch {
        /* sessionStorage unavailable — degrade gracefully */
      }
      if (announced !== roundKey) {
        try {
          sessionStorage.setItem(TIMEUP_ROUND_KEY, roundKey);
        } catch {
          /* ignore */
        }
        playTimeUp();
      }
    }
    prevStatus.current = status;
  }, [state.status, state.remainingMs, event?.ends_at]);

  return null; // renders nothing — sound only
}

/**
 * Large, prominent timer banner shown between the sticky header and the event
 * status strip. This is the element the player's eye goes to first.
 */
export function ArenaTimerBanner({ event }: { event: EventConfig | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const end = event?.ends_at ? Date.parse(event.ends_at) : null;
    if (end != null && Date.now() >= end) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (end != null && Date.now() >= end + 500) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [event]);

  const state = getEventState(event, now);

  // After 30 min past the end, stop showing "TIME'S UP" and go back to standby
  const endedAt = event?.ends_at ? Date.parse(event.ends_at) : null;
  const staleEnded = state.status === 'ended' && endedAt != null && Date.now() - endedAt > 30 * 60 * 1000;

  if (state.status === 'idle' || staleEnded) {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-terminal-amber/30 bg-terminal-amber/5 py-4">
        <span className="animate-flicker text-4xl font-extrabold tracking-widest text-terminal-amber sm:text-5xl">
          ◷ STAND BY
        </span>
      </div>
    );
  }

  if (state.status === 'ended') {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-terminal-red/30 bg-terminal-red/5 py-4 shadow-neon-red">
        <span className="text-4xl font-extrabold text-terminal-red sm:text-5xl">
          ⏱ TIME&apos;S UP
        </span>
      </div>
    );
  }

  const secs = state.remainingMs / 1000;
  const danger = secs <= 60;
  const warn = secs <= 300;
  const color = danger ? 'text-terminal-red' : warn ? 'text-terminal-amber' : 'text-terminal-green';
  const border = danger
    ? 'border-terminal-red/40 shadow-neon-red bg-terminal-red/5'
    : warn
      ? 'border-terminal-amber/30 bg-terminal-amber/5'
      : 'border-terminal-green/30 bg-terminal-green/5 shadow-neon';

  return (
    <div className={`flex flex-col items-center justify-center border-b py-4 ${border}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-terminal-dim">
        time remaining
      </span>
      <span
        className={`text-5xl font-extrabold tabular-nums tracking-widest drop-shadow-[0_0_16px_currentColor] sm:text-6xl ${color} ${danger ? 'animate-flicker' : ''}`}
      >
        {formatDuration(state.remainingMs)}
      </span>
    </div>
  );
}

/**
 * Compact inline timer — used for legacy/admin contexts. The arena uses ArenaTimerBanner.
 */
export default function Timer({ event }: { event: EventConfig | null }) {
  return <SoundClock event={event} />;
}
