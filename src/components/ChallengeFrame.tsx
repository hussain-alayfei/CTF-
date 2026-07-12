import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '../lib/app-context';

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
