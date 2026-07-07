import { useEffect, useRef, useState } from 'react';
import type { EventConfig } from '../lib/types';
import { formatDuration, getEventState } from '../lib/time';
import { playTick, playTimeUp } from '../lib/sounds';

export default function Timer({ event }: { event: EventConfig | null }) {
  const [now, setNow] = useState(Date.now());
  const lastTickSec = useRef<number>(-1);
  const playedTimeUp = useRef(false);

  // Only tick while the clock is actually counting. Once the event has ended the
  // display is static ("TIME'S UP"), so there's no reason to keep re-rendering
  // four times a second — that needless repaint fed the board shimmer.
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
    if (state.status === 'running') {
      const secs = Math.ceil(state.remainingMs / 1000);
      if (secs <= 10 && secs > 0 && secs !== lastTickSec.current) {
        lastTickSec.current = secs;
        playTick();
      }
      playedTimeUp.current = false;
    } else if (state.status === 'ended' && !playedTimeUp.current) {
      playedTimeUp.current = true;
      playTimeUp();
    }
  }, [state.status, state.remainingMs]);

  if (state.status === 'idle') {
    return (
      <div className="flex flex-col items-center rounded-lg border border-terminal-border bg-terminal-input/60 px-4 py-1.5">
        <span className="text-[10px] uppercase tracking-widest text-terminal-dim">status</span>
        <span className="animate-flicker font-bold text-terminal-amber">◷ WAITING TO START</span>
      </div>
    );
  }

  if (state.status === 'ended') {
    return (
      <div className="flex flex-col items-center rounded-lg border border-terminal-red/60 bg-terminal-red/10 px-4 py-1.5 shadow-neon-red">
        <span className="text-[10px] uppercase tracking-widest text-terminal-dim">the clock</span>
        <span className="font-extrabold text-terminal-red">⏱ TIME&apos;S UP</span>
      </div>
    );
  }

  const secs = state.remainingMs / 1000;
  const danger = secs <= 60;
  const warn = secs <= 300;
  const color = danger ? 'text-terminal-red' : warn ? 'text-terminal-amber' : 'text-terminal-green';
  const border = danger
    ? 'border-terminal-red/60 shadow-neon-red'
    : warn
      ? 'border-terminal-amber/50'
      : 'border-terminal-green/50 shadow-neon';

  return (
    <div className={`flex flex-col items-center rounded-lg border bg-terminal-input/60 px-5 py-1.5 ${border}`}>
      <span className="text-[10px] uppercase tracking-widest text-terminal-dim">time left</span>
      <span className={`text-2xl font-extrabold tabular-nums tracking-wider ${color} ${danger ? 'animate-flicker' : ''}`}>
        {formatDuration(state.remainingMs)}
      </span>
    </div>
  );
}
