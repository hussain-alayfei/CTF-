import type { Challenge } from './types';

/**
 * Base points offered to the next solver.
 *
 * Solve-order scoring intentionally leaves the first two base awards equal:
 *   first  = initial + first-blood bonus
 *   second = initial
 *   third  = initial - one decay step
 *
 * Existing challenges have a zero step, so their scoring stays unchanged.
 */
export function nextSolveValue(challenge: Challenge, completedSolves: number): number {
  const step = Math.max(0, challenge.score_decay_step ?? 0);
  if (step === 0) return challenge.points;

  const floor = Math.max(0, challenge.score_minimum ?? 0);
  const decayCount = Math.max(0, completedSolves - 1);
  return Math.max(floor, challenge.points - step * decayCount);
}

