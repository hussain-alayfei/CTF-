import { useMemo } from 'react';
import type { Player, LeaderboardRow, Solve, Challenge } from '../lib/types';
import useLockBodyScroll from '../lib/useLockBodyScroll';

const medals = ['🥇', '🥈', '🥉'];

export default function ProfileModal({
  player,
  leaderboard,
  solves,
  challenges,
  myPoints,
  onClose,
  onLogout,
}: {
  player: Player;
  leaderboard: LeaderboardRow[];
  solves: Solve[];
  challenges: Challenge[];
  myPoints: number;
  onClose: () => void;
  onLogout: () => void;
}) {
  useLockBodyScroll();
  const mySolves = solves.filter((s) => s.player_id === player.id);
  const rank = leaderboard.findIndex((r) => r.player_id === player.id) + 1;
  const totalPlayers = leaderboard.length;
  const totalPossible = challenges.reduce((s, c) => s + c.points, 0);
  const pct = totalPossible > 0 ? Math.round((myPoints / totalPossible) * 100) : 0;
  const firstBloods = mySolves.filter((s) => s.is_first_blood).length;
  const rankBadge = rank >= 1 && rank <= 3 ? medals[rank - 1] : rank > 0 ? `#${rank}` : '—';

  // Group solves by day for the per-day breakdown
  const perDay = useMemo(() => {
    const challDay = new Map(challenges.map((c) => [c.id, c]));
    const dayMap = new Map<number, { solves: Solve[]; pts: number; title: string }>();
    for (const s of mySolves) {
      const ch = challDay.get(s.challenge_id);
      const dayNum = ch?.day ?? 0;
      const title = dayNum > 0 ? `Day ${dayNum}` : 'Other';
      const entry = dayMap.get(dayNum) ?? { solves: [], pts: 0, title };
      entry.solves.push(s);
      entry.pts += s.points_awarded;
      dayMap.set(dayNum, entry);
    }
    return [...dayMap.entries()].sort((a, b) => a[0] - b[0]);
  }, [mySolves, challenges]);

  const solvedChallenges = mySolves.map((s) => {
    const ch = challenges.find((c) => c.id === s.challenge_id);
    return { ...s, title: ch?.title ?? s.challenge_id, category: ch?.category ?? '—', day: ch?.day ?? 0 };
  }).sort((a, b) => (b.solved_at > a.solved_at ? 1 : -1));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-sm animate-slide-left flex-col border-l border-terminal-border bg-terminal-panel shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-terminal-border p-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{player.avatar}</span>
            <div>
              <h2 className="text-xl font-extrabold text-terminal-green">{player.username}</h2>
              <span className="flex items-center gap-1 text-xs text-terminal-dim">
                <span className="text-base">{rankBadge}</span>
                {rank > 0 ? `of ${totalPlayers} players` : 'unranked'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-terminal-border px-2 py-1 text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 p-5">
            <StatBox label="Score" value={`${myPoints}`} sub={`${pct}%`} accent="text-terminal-amber" />
            <StatBox label="Solves" value={`${mySolves.length}`} sub={`of ${challenges.length}`} accent="text-terminal-green" />
            <StatBox label="First Bloods" value={`${firstBloods}`} sub="🩸" accent="text-terminal-red" />
          </div>

          {/* Progress bar */}
          <div className="px-5 pb-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-terminal-border">
              <div
                className="h-full rounded-full bg-terminal-green transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-terminal-dim">
              {myPoints} / {totalPossible} pts ({pct}% complete)
            </p>
          </div>

          {/* Per-day breakdown */}
          {perDay.length > 0 && (
            <div className="border-t border-terminal-border px-5 py-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-terminal-dim">
                Score by day
              </h3>
              <div className="space-y-2">
                {perDay.map(([dayNum, info]) => (
                  <div
                    key={dayNum}
                    className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-input/30 px-3 py-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-terminal-green">{info.title}</div>
                      <div className="text-[10px] text-terminal-dim">
                        {info.solves.length} solve{info.solves.length !== 1 ? 's' : ''}
                        {info.solves.some((s) => s.is_first_blood) && (
                          <span className="ml-1 text-terminal-red">🩸</span>
                        )}
                      </div>
                    </div>
                    <span className="font-extrabold tabular-nums text-terminal-amber">
                      +{info.pts}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solved list */}
          <div className="border-t border-terminal-border px-5 py-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-terminal-dim">
              Challenges owned
            </h3>
            {solvedChallenges.length === 0 ? (
              <p className="text-sm text-terminal-dim">No solves yet — go capture your first flag! 🚩</p>
            ) : (
              <ul className="space-y-1">
                {solvedChallenges.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-terminal-green">
                      {s.is_first_blood ? '🩸' : '✓'} {s.title}
                      <span className="ml-2 text-[10px] text-terminal-dim">{s.category}</span>
                    </span>
                    <span className="tabular-nums text-terminal-amber">+{s.points_awarded}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="space-y-2 border-t border-terminal-border p-5">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20"
          >
            ◂ Back to challenges
          </button>
          <button
            onClick={onLogout}
            className="w-full rounded-lg border border-terminal-red/50 bg-terminal-red/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20"
          >
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
}

function StatBox({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-input/40 p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-terminal-dim">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${accent}`}>{value}</div>
      <div className="text-[11px] text-terminal-dim">{sub}</div>
    </div>
  );
}
