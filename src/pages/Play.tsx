import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { useGame } from '../lib/useGame';
import { getEventState } from '../lib/time';
import type { Challenge, Difficulty } from '../lib/types';
import Register from '../components/Register';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import ChallengeCard from '../components/ChallengeCard';
import ChallengeModal from '../components/ChallengeModal';
import Toasts from '../components/Toasts';

const order: Difficulty[] = ['easy', 'medium', 'hard'];
const sectionTitle: Record<Difficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Very Hard',
};

export default function Play() {
  const { player, muted, toggleMute } = useApp();
  const game = useGame(player);
  const [openId, setOpenId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Difficulty, Challenge[]> = { easy: [], medium: [], hard: [] };
    for (const c of game.challenges) g[c.difficulty]?.push(c);
    return g;
  }, [game.challenges]);

  const eventState = getEventState(game.event);
  const open = game.challenges.find((c) => c.id === openId) ?? null;
  const totalPossible = game.challenges.reduce((s, c) => s + c.points, 0);

  return (
    <div className="min-h-full">
      <Toasts announcements={game.announcements} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-terminal-border bg-terminal-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-terminal-green drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
              MERAS<span className="text-white">//</span>CTF
            </span>
            <span className="hidden animate-flicker text-terminal-green/60 sm:inline">▮</span>
          </div>

          <Timer event={game.event} />

          <div className="flex items-center gap-3">
            {player && (
              <div className="rounded-lg border border-terminal-border bg-black/40 px-3 py-1.5 text-right">
                <div className="max-w-[9rem] truncate text-sm font-bold text-terminal-green">
                  {player.username}
                </div>
                <div className="text-[11px] text-terminal-dim">
                  <span className="text-terminal-amber">{game.myPoints}</span> / {totalPossible} pts
                </div>
              </div>
            )}
            <button
              onClick={toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
              className="rounded-lg border border-terminal-border px-3 py-2 text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <section>
          {game.loading ? (
            <p className="py-20 text-center text-terminal-dim">Loading challenges…</p>
          ) : (
            order.map((diff) =>
              grouped[diff].length === 0 ? null : (
                <div key={diff} className="mb-8">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-terminal-dim">
                    {sectionTitle[diff]}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {grouped[diff].map((c) => (
                      <ChallengeCard
                        key={c.id}
                        challenge={c}
                        solved={game.mySolvedIds.has(c.id)}
                        firstBloodBy={game.firstBloodByChallenge.get(c.id)}
                        onOpen={() => setOpenId(c.id)}
                      />
                    ))}
                  </div>
                </div>
              ),
            )
          )}

          <p className="mt-4 text-center text-xs text-terminal-dim">
            Flags always look like <code className="text-terminal-green">MERAS&#123;...&#125;</code> ·{' '}
            <Link to="/admin" className="underline decoration-dotted hover:text-terminal-green">
              instructor panel
            </Link>
          </p>
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <Leaderboard rows={game.leaderboard} meId={player?.id ?? null} />
        </aside>
      </main>

      {/* Challenge modal */}
      {open && player && (
        <ChallengeModal
          challenge={open}
          player={player}
          solved={game.mySolvedIds.has(open.id)}
          firstBloodBy={game.firstBloodByChallenge.get(open.id)}
          eventStatus={eventState.status}
          onClose={() => setOpenId(null)}
          onSolved={() => void game.refreshBoard()}
        />
      )}

      {/* Registration gate */}
      {!player && <Register />}
    </div>
  );
}
