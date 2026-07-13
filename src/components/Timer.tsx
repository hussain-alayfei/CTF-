import { useEffect, useRef } from 'react';
import type { EventConfig } from '../lib/types';
import { CRITICAL_SECONDS, WARN_SECONDS, formatDuration, getEffectiveEventStatus, isStaleEnded, strobeMs } from '../lib/time';
import useCountdown from '../lib/useCountdown';
import { playCountdownBeep, playFinalMinute, playTimeUp, playWarn5 } from '../lib/sounds';

const TIMEUP_ROUND_KEY = 'kgsp_ctf_timeup_round';

// Best-effort haptic buzz (Android Chrome etc.); silently a no-op elsewhere.
function buzz(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* some browsers throw if not user-activated — ignore */
    }
  }
}

/**
 * The round's audio cues. Mounted once, in the arena header — and because the
 * admin panel, the projector board and the finale are all in-page overlays
 * rendered *inside* the arena, this stays mounted underneath them. So the
 * countdown is heard on every screen, whichever one the instructor is showing.
 *
 * Escalation:
 *   5:00  → one warning tone as the clock turns red
 *   1:00  → alarm as the clock starts strobing
 *   0:59… → a beep every second, hardening at 0:10 and again at 0:03
 *   0:00  → time's up
 *
 * Every cue is edge-triggered (fired on a real crossing, once), so a client that
 * joins mid-round doesn't replay cues it missed, and a re-render never doubles one.
 */
function RoundAudio({ event }: { event: EventConfig | null }) {
  const { status, secs } = useCountdown(event);
  const prevSecs = useRef<number | null>(null);
  const lastBeepSec = useRef(-1);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'running') {
      const prev = prevSecs.current;

      // Boundary cues — only on a genuine crossing during this mount.
      if (prev != null && prev > WARN_SECONDS && secs <= WARN_SECONDS) {
        playWarn5();
        buzz(200);
      }
      if (prev != null && prev > CRITICAL_SECONDS && secs <= CRITICAL_SECONDS) {
        playFinalMinute();
        buzz([120, 80, 120]);
      }

      // Per-second countdown through the last minute (the 1:00 mark itself gets
      // the alarm above, so the beeps start at 0:59).
      if (secs > 0 && secs < CRITICAL_SECONDS && secs !== lastBeepSec.current) {
        lastBeepSec.current = secs;
        playCountdownBeep(secs);
        if (secs <= 3) buzz(160);
      }

      prevSecs.current = secs;
    } else {
      prevSecs.current = null;
      lastBeepSec.current = -1;
    }

    if (status === 'ended' && prevStatus.current === 'running') {
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
        buzz([300, 120, 300]);
      }
    }
    prevStatus.current = status;
  }, [status, secs, event?.ends_at]);

  return null; // sound only
}

/**
 * Large countdown banner on the arena — the element the player's eye goes to first.
 */
export function ArenaTimerBanner({ event }: { event: EventConfig | null }) {
  const { status, remainingMs, secs, phase } = useCountdown(event);
  const displayStatus = getEffectiveEventStatus(event);

  if (displayStatus === 'idle' || isStaleEnded(event)) {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-terminal-amber/30 bg-terminal-amber/5 py-4">
        <span className="animate-flicker text-4xl font-extrabold tracking-widest text-terminal-amber sm:text-5xl">
          ◷ STAND BY
        </span>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-terminal-red/30 bg-terminal-red/5 py-4 shadow-neon-red">
        <span className="text-4xl font-extrabold text-terminal-red sm:text-5xl">⏱ TIME&apos;S UP</span>
      </div>
    );
  }

  const critical = phase === 'critical';
  const color =
    critical
      ? 'text-terminal-redlight'
      : phase === 'warn'
        ? 'text-terminal-red'
        : phase === 'freeze'
          ? 'text-terminal-cyan'
          : 'text-terminal-green';
  const border =
    critical
      ? 'border-terminal-red/60 bg-terminal-red/10 shadow-neon-red'
      : phase === 'warn'
        ? 'border-terminal-red/40 bg-terminal-red/5 shadow-neon-red'
        : phase === 'freeze'
          ? 'border-terminal-cyan/40 bg-terminal-cyan/5'
          : 'border-terminal-green/30 bg-terminal-green/5 shadow-neon';
  const label =
    critical
      ? 'final minute'
      : phase === 'warn'
        ? 'hurry — time is almost up'
        : phase === 'freeze'
          ? 'score freeze · time remaining'
          : 'time remaining';

  return (
    <div className={`flex flex-col items-center justify-center border-b py-4 ${border}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-terminal-dim">{label}</span>
      <span
        className={`text-5xl font-extrabold tabular-nums tracking-widest drop-shadow-[0_0_16px_currentColor] sm:text-6xl ${color} ${critical ? 'animate-strobe' : ''}`}
        style={critical ? { animationDuration: `${strobeMs(secs)}ms` } : undefined}
      >
        {formatDuration(remainingMs)}
      </span>
    </div>
  );
}

/**
 * Sound-only clock. Rendered in the arena header; see RoundAudio above for why
 * that one mount covers every screen.
 */
export default function Timer({ event }: { event: EventConfig | null }) {
  return <RoundAudio event={event} />;
}
