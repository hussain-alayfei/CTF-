import { useEffect, useRef, useState } from 'react';
import type { Announcement } from '../lib/useGame';
import { playFirstBlood } from '../lib/sounds';

interface Toast extends Announcement {
  key: string;
}

export default function Toasts({ announcements }: { announcements: Announcement[] }) {
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

    fresh.forEach((a) => {
      if (a.type === 'first_blood') playFirstBlood();
      const key = `${a.id}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...a, key }]);
      const ttl = a.type === 'first_blood' ? 6000 : 3800;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== key));
      }, ttl);
    });
  }, [announcements]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) =>
        t.type === 'first_blood' ? (
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
                <strong className="text-white">{t.username}</strong> owned{' '}
                <strong className="text-white">{t.challengeTitle}</strong> (+{t.points})
              </div>
            </div>
          </div>
        ) : (
          <div
            key={t.key}
            className="animate-slide-down rounded-lg border border-terminal-green/40 bg-terminal-panel/90 px-4 py-2 text-sm text-terminal-green backdrop-blur"
          >
            <strong className="text-white">{t.username}</strong> solved{' '}
            <strong className="text-terminal-green">{t.challengeTitle}</strong> (+{t.points})
          </div>
        ),
      )}
    </div>
  );
}
