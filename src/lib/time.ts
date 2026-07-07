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

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
