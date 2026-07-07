import type { Player, LeaderboardRow, Solve, Challenge } from '../lib/types';

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
  const mySolves = solves.filter((s) => s.player_id === player.id);
  const rank = leaderboard.findIndex((r) => r.player_id === player.id) + 1;
  const totalPlayers = leaderboard.length;
  const totalPossible = challenges.reduce((s, c) => s + c.points, 0);
  const pct = totalPossible > 0 ? Math.round((myPoints / totalPossible) * 100) : 0;
  const firstBloods = mySolves.filter((s) => s.is_first_blood).length;

  const solvedChallenges = mySolves.map((s) => {
    const ch = challenges.find((c) => c.id === s.challenge_id);
    return { ...s, title: ch?.title ?? s.challenge_id, category: ch?.category ?? '—' };
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg animate-pop rounded-xl border border-terminal-border bg-terminal-panel shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-terminal-border p-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{player.avatar}</span>
            <div>
              <h2 className="text-xl font-extrabold text-terminal-green">{player.username}</h2>
              <span className="text-xs text-terminal-dim">
                {rank > 0 ? `Rank #${rank} of ${totalPlayers}` : 'Unranked'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-terminal-border px-2 py-1 text-terminal-dim transition hover:border-terminal-red hover:text-terminal-red"
          >
            ✕
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 p-5">
          <StatBox label="Score" value={`${myPoints}`} sub={`${pct}%`} accent="text-terminal-amber" />
          <StatBox label="Solves" value={`${mySolves.length}`} sub={`of ${challenges.length}`} accent="text-terminal-green" />
          <StatBox label="First Bloods" value={`${firstBloods}`} sub="🩸" accent="text-terminal-red" />
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
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

        {/* Solved list */}
        {solvedChallenges.length > 0 && (
          <div className="max-h-48 overflow-y-auto border-t border-terminal-border px-5 py-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-terminal-dim">
              Challenges owned
            </h3>
            <ul className="space-y-1">
              {solvedChallenges.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-terminal-green">
                    ✓ {s.title}
                    <span className="ml-2 text-[10px] text-terminal-dim">{s.category}</span>
                  </span>
                  <span className="tabular-nums text-terminal-amber">+{s.points_awarded}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Logout */}
        <div className="border-t border-terminal-border p-5">
          <button
            onClick={onLogout}
            className="w-full rounded-lg border border-terminal-red/50 bg-terminal-red/10 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-terminal-red transition hover:bg-terminal-red/20"
          >
            Log out
          </button>
          <p className="mt-2 text-center text-[11px] text-terminal-dim">
            Remember your password — we can't recover it for you!
          </p>
        </div>
      </div>
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
