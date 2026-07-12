import { useEffect, useState } from 'react';
import type { EventConfig } from './types';
import { getCountdown, type CountdownState } from './time';

/**
 * The round clock, as a hook. Owns its own ticker so that whichever component
 * uses it repaints once per tick without dragging its parent (and its parent's
 * leaderboard) along for the ride — the projector board's ranking used to
 * shimmer for exactly that reason.
 *
 * The interval stops itself shortly after the round ends, so an ended event
 * doesn't leave a timer spinning for the rest of the session.
 */
export default function useCountdown(event: EventConfig | null): CountdownState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now()); // resync immediately when the event object changes
    const end = event?.ends_at ? Date.parse(event.ends_at) : null;
    if (end != null && Date.now() >= end) return;

    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (end != null && t >= end + 500) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [event]);

  return getCountdown(event, now);
}
