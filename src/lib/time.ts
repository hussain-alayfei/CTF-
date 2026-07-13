import type { EventConfig } from './types';

export type EventStatus = 'idle' | 'running' | 'ended';

export interface EventState {
  status: EventStatus;
  remainingMs: number; // time left while running, else 0
}

export function getEventState(event: EventConfig | null, now = Date.now()): EventState {
  if (!event || !event.starts_at) return { status: 'idle', remainingMs: 0 };
  const start = Date.parse(event.starts_at);
  const end = event.ends_at ? Date.parse(event.ends_at) : Infinity;
  if (now < start) return { status: 'idle', remainingMs: 0 };
  if (now >= end) return { status: 'ended', remainingMs: 0 };
  return { status: 'running', remainingMs: end - now };
}

/** Minutes after ends_at before the arena drops TIME'S UP and returns to STAND BY. */
export const STALE_ENDED_MS = 30 * 60 * 1000;

/**
 * True when the round has been over long enough that the UI should look like
 * standby again (timer + banners), not shout TIME'S UP forever.
 */
export function isStaleEnded(event: EventConfig | null, now = Date.now()): boolean {
  const { status } = getEventState(event, now);
  if (status !== 'ended' || !event?.ends_at) return false;
  return now - Date.parse(event.ends_at) > STALE_ENDED_MS;
}

/** Status used by arena chrome: ended → idle after the stale window. */
export function getEffectiveEventStatus(
  event: EventConfig | null,
  now = Date.now(),
): EventStatus {
  const { status } = getEventState(event, now);
  if (isStaleEnded(event, now)) return 'idle';
  return status;
}

/**
 * The scoreboard "blackout": during the final `freeze_minutes` of a running
 * event the live leaderboard is hidden to build suspense (like a real CTF
 * freeze). Returns true only while the event is running and inside that window.
 */
export function isFrozen(event: EventConfig | null, now = Date.now()): boolean {
  const state = getEventState(event, now);
  if (state.status !== 'running') return false;
  const freezeMs = (event?.freeze_minutes ?? 0) * 60_000;
  return freezeMs > 0 && state.remainingMs <= freezeMs;
}

// ---------------------------------------------------------------------------
// Countdown urgency model — one source of truth for the arena banner, the
// projector board and the admin panel, so all three escalate identically.
// ---------------------------------------------------------------------------

/** ≤ 5 minutes left: the clock goes red. */
export const WARN_SECONDS = 5 * 60;
/** ≤ 1 minute left: red + hard on/off strobe, and the per-second beeps start. */
export const CRITICAL_SECONDS = 60;

export type CountdownPhase = 'idle' | 'normal' | 'freeze' | 'warn' | 'critical' | 'ended';

export interface CountdownState extends EventState {
  /** Whole seconds remaining (ceil), so 0.4s left still reads as "1". */
  secs: number;
  phase: CountdownPhase;
  /** Inside the score-freeze window (independent of the red/strobe phases). */
  inFreeze: boolean;
}

/**
 * Urgency wins over the freeze tint: once we're inside the last 5 minutes the
 * clock is red even if the standings are still frozen, because "time is nearly
 * up" is the more important thing for the room to see.
 */
export function getCountdown(event: EventConfig | null, now = Date.now()): CountdownState {
  const state = getEventState(event, now);
  const secs = Math.ceil(state.remainingMs / 1000);
  const freezeMs = (event?.freeze_minutes ?? 0) * 60_000;
  const inFreeze = state.status === 'running' && freezeMs > 0 && state.remainingMs <= freezeMs;

  let phase: CountdownPhase;
  if (state.status === 'idle') phase = 'idle';
  else if (state.status === 'ended') phase = 'ended';
  else if (secs <= CRITICAL_SECONDS) phase = 'critical';
  else if (secs <= WARN_SECONDS) phase = 'warn';
  else if (inFreeze) phase = 'freeze';
  else phase = 'normal';

  return { ...state, secs, phase, inFreeze };
}

/**
 * How fast the final-minute strobe flashes, in ms per on/off cycle. It tightens
 * as the clock runs out so the room can feel the last seconds without reading
 * the digits.
 */
export function strobeMs(secs: number): number {
  if (secs <= 3) return 240;
  if (secs <= 10) return 400;
  return 900;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
