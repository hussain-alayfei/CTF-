import { useEffect, useRef, useState } from 'react';
import type { Announcement } from '../lib/useGame';
import type { EventConfig } from '../lib/types';
import { isFrozen } from '../lib/time';
import { playFirstBlood } from '../lib/sounds';

interface Toast extends Announcement {
  key: string;
  /** Snapshotted at fire time: hide the identity because the board was frozen. */
  anonymized: boolean;
}

// Shown in place of a real name/avatar while the leaderboard is frozen, so a
// solve toast on a student's screen can't leak who's climbing during the
// final-minutes blackout (the projector board hides names too).
const ANON_NAME = 'Anonymous';
const ANON_AVATAR = '🕵️';

export default function Toasts({
  announcements,
  event = null,
}: {
  announcements: Announcement[];
  /** Used to detect the score-freeze window and anonymize toasts during it. */
  event?: EventConfig | null;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<number>(0);

  useEffect(() => {
    if (announcements.length <= seen.current) {
      // Reset guard if the feed was cleared.
      seen.current = Math.min(seen.current, announcements.length);
      return;
    }
    const fresh = announcements.slice(seen.current);
    seen.current = announcements.length;

    // Decide anonymization once, at the moment the toast fires, against the real
    // clock — not render `now` (which the arena only updates at boundaries).
    const anon = isFrozen(event, Date.now());

    fresh.forEach((a) => {
      if (a.type === 'first_blood') playFirstBlood();
      const key = `${a.id}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...a, key, anonymized: anon }]);
      const ttl = a.type === 'first_blood' ? 6000 : 3800;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== key));
      }, ttl);
    });
    // event is intentionally read fresh via Date.now(); no need to re-run on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const name = t.anonymized ? ANON_NAME : t.username;
        const avatar = t.anonymized ? ANON_AVATAR : t.avatar;
        const points = t.anonymized ? '🔒' : `+${t.points}`;
        return t.type === 'first_blood' ? (
          <div
            key={t.key}
            className="animate-slide-down flex items-center gap-3 rounded-lg border-2 border-terminal-red bg-terminal-red/15 px-6 py-3 text-center shadow-neon-red backdrop-blur"
          >
            <span className="animate-pulse-ring rounded-full text-2xl">🩸</span>
            <div>
              <div className="text-sm font-extrabold uppercase tracking-widest text-terminal-red">
                First Blood!
              </div>
              <div className="text-sm text-terminal-green">
                <span className="mr-1">{avatar}</span>
                <strong className="text-terminal-strong">{name}</strong> owned{' '}
                <strong className="text-terminal-strong">{t.challengeTitle}</strong> ({points})
              </div>
            </div>
          </div>
        ) : (
          <div
            key={t.key}
            className="animate-slide-down rounded-lg border border-terminal-green/40 bg-terminal-panel/90 px-4 py-2 text-sm text-terminal-green backdrop-blur"
          >
            <span className="mr-1">{avatar}</span>
            <strong className="text-terminal-strong">{name}</strong> solved{' '}
            <strong className="text-terminal-green">{t.challengeTitle}</strong> ({points})
          </div>
        );
      })}
    </div>
  );
}
