import type { Challenge, Difficulty } from '../lib/types';

const diffStyle: Record<Difficulty, string> = {
  easy: 'text-terminal-green border-terminal-green/40',
  medium: 'text-terminal-amber border-terminal-amber/40',
  hard: 'text-terminal-red border-terminal-red/40',
  danger: 'text-fuchsia-400 border-fuchsia-400/50',
};

const diffLabel: Record<Difficulty, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  danger: '☠ DANGER',
};

export default function ChallengeCard({
  challenge,
  solved,
  firstBloodBy,
  onOpen,
  blurred = false,
}: {
  challenge: Challenge;
  solved: boolean;
  firstBloodBy?: string;
  onOpen: () => void;
  done?: boolean;
  /** When true (event not started) the title is blurred so players can't read challenges early. */
  blurred?: boolean;
}) {
  const isDanger = challenge.difficulty === 'danger';

  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col rounded-xl border bg-terminal-panel p-4 text-left transition hover:-translate-y-0.5 hover:border-terminal-green/60 hover:shadow-neon ${
        solved
          ? 'border-terminal-green/60'
          : isDanger
            ? 'border-fuchsia-400/40 shadow-[0_0_14px_rgb(232_121_249_/_0.15)] hover:border-fuchsia-400/70'
            : 'border-terminal-border'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded border border-terminal-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-dim">
          {challenge.category}
        </span>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${diffStyle[challenge.difficulty]}`}
        >
          {diffLabel[challenge.difficulty]}
        </span>
      </div>

      {/* Title — blurred before the event starts so challenge names can't be read early */}
      <h3
        className={`mb-1 flex items-center gap-2 text-lg font-bold text-terminal-green transition-[filter] duration-500 ${
          blurred && !solved ? 'select-none blur' : ''
        }`}
      >
        {solved && <span className="text-terminal-green">✓</span>}
        {challenge.title}
      </h3>

      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="text-xl font-extrabold tabular-nums text-terminal-amber">
          {challenge.points}
          <span className="ml-1 text-xs font-normal text-terminal-dim">pts</span>
        </span>
        {firstBloodBy ? (
          <span className="truncate text-[11px] text-terminal-red" title={`First blood: ${firstBloodBy}`}>
            🩸 {firstBloodBy}
          </span>
        ) : (
          <span className="text-[11px] text-terminal-dim">unclaimed</span>
        )}
      </div>

      {solved && (
        <span className="absolute right-3 top-3 rotate-12 rounded border border-terminal-green px-1.5 text-[9px] font-bold uppercase tracking-widest text-terminal-green opacity-0 transition group-hover:opacity-100">
          owned
        </span>
      )}
    </button>
  );
}
