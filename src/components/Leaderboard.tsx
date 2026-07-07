import type { LeaderboardRow } from '../lib/types';

const medal = ['🥇', '🥈', '🥉'];

export default function Leaderboard({
  rows,
  meId,
  frozen = false,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  frozen?: boolean;
}) {
  const ranked = rows.filter((r) => r.total_points > 0 || r.solves_count > 0);
  const idle = rows.filter((r) => r.total_points === 0 && r.solves_count === 0);

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel">
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">▸ Leaderboard</h2>
        <span className="text-xs text-terminal-dim">{rows.length} players</span>
      </div>

      {frozen ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="text-4xl">🕶️</span>
          <p className="font-bold text-terminal-amber">SCOREBOARD FROZEN</p>
          <p className="text-xs leading-relaxed text-terminal-dim">
            The scores are hidden for the final minutes. Nobody can see the ranking now —
            keep solving, the winners are revealed when time runs out!
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {ranked.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-terminal-dim">
              No solves yet. Be the first to draw blood. 🩸
            </p>
          )}

          <ol>
            {ranked.map((r, i) => {
              const me = r.player_id === meId;
              return (
                <li
                  key={r.player_id}
                  className={`flex items-center gap-3 border-b border-terminal-border/50 px-4 py-2.5 ${
                    me ? 'bg-terminal-green/10' : i < 3 ? 'bg-terminal-strong/[0.04]' : ''
                  }`}
                >
                  <span className="w-7 shrink-0 text-center text-sm font-bold text-terminal-dim">
                    {i < 3 ? medal[i] : i + 1}
                  </span>
                  <span
                    className={`flex-1 truncate font-semibold ${me ? 'text-terminal-green' : 'text-terminal-green/90'}`}
                  >
                    <span className="mr-1.5">{r.avatar ?? '🕵️'}</span>
                    {r.username}
                    {me && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-terminal-dim">
                        you
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-terminal-dim">{r.solves_count}★</span>
                  <span className="w-16 shrink-0 text-right font-bold tabular-nums text-terminal-amber">
                    {r.total_points}
                  </span>
                </li>
              );
            })}
          </ol>

          {idle.length > 0 && (
            <div className="px-4 py-2 text-[11px] text-terminal-dim">
              + {idle.length} player{idle.length > 1 ? 's' : ''} waiting to score
            </div>
          )}
        </div>
      )}
    </div>
  );
}
