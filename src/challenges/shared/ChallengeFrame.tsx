import { Link } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/lib/app-context';
import { fetchChallenges, fetchDays, fetchEventConfig } from '@/lib/api';
import { getEffectiveEventStatus } from '@/lib/time';

/** Shared chrome for live Day 7 (and similar) challenge pages. */
export default function ChallengeFrame({
  challengeId,
  title,
  blurb,
  children,
}: {
  challengeId: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  const { player } = useApp();
  // Same fairness rule as ChallengeModal: live day, round not running, day not
  // completed → lab must not open early (URL paste or leftover Open challenge).
  const [fairnessLocked, setFairnessLocked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ev, challenges, days] = await Promise.all([
          fetchEventConfig(),
          fetchChallenges(),
          fetchDays(),
        ]);
        if (!alive) return;
        const ch = challenges.find((c) => c.id === challengeId);
        if (!ch) return;
        const dayMeta = days.find((d) => d.day === ch.day);
        if (dayMeta?.is_completed) {
          setFairnessLocked(false);
          return;
        }
        const status = getEffectiveEventStatus(ev);
        setFairnessLocked(ch.day === ev.active_day && status !== 'running');
      } catch {
        /* network blip — don't lock people out of a practice page */
      }
    })();
    return () => {
      alive = false;
    };
  }, [challengeId]);

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-terminal-dim">Log in from the arena first, then reopen this challenge.</p>
        <Link
          to={`/?c=${challengeId}`}
          className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted"
        >
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  if (fairnessLocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-3xl">🔒</p>
        <p className="mt-3 text-sm font-semibold text-terminal-amber">
          Lab locked until the round starts
        </p>
        <p className="mt-1 text-xs text-terminal-dim">
          Details stay hidden while the arena is on standby (fairness).
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-terminal-green underline decoration-dotted"
        >
          ‹ back to the arena
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to={`/?c=${challengeId}`}
        className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green"
      >
        ‹ back to the challenge
      </Link>
      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">{title}</h1>
        <p className="mt-2 text-sm text-terminal-dim">{blurb}</p>
        {children}
      </div>
    </div>
  );
}
