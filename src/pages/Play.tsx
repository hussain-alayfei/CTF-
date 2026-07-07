import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { useGame } from '../lib/useGame';
import { getEventState, isFrozen } from '../lib/time';
import type { Challenge, Day, Difficulty } from '../lib/types';
import Register from '../components/Register';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import ChallengeCard from '../components/ChallengeCard';
import ChallengeModal from '../components/ChallengeModal';
import Toasts from '../components/Toasts';
import Podium from '../components/Podium';

const order: Difficulty[] = ['easy', 'medium', 'hard'];
const sectionTitle: Record<Difficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Very Hard',
};

export default function Play() {
  const { player, muted, toggleMute, theme, toggleTheme } = useApp();
  const game = useGame(player);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showPodium, setShowPodium] = useState(false);
  const podiumShown = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const eventState = getEventState(game.event, now);
  const frozen = isFrozen(game.event, now);

  // Auto-launch the Kahoot-style finale once, when the clock hits zero.
  useEffect(() => {
    if (
      eventState.status === 'ended' &&
      !podiumShown.current &&
      game.leaderboard.some((r) => r.total_points > 0)
    ) {
      podiumShown.current = true;
      setShowPodium(true);
    }
  }, [eventState.status, game.leaderboard]);

  const challengesByDay = useMemo(() => {
    const map = new Map<number, Challenge[]>();
    for (const c of game.challenges) {
      const arr = map.get(c.day) ?? [];
      arr.push(c);
      map.set(c.day, arr);
    }
    return map;
  }, [game.challenges]);

  const openDays = game.days.filter((d) => d.is_open);
  const lockedDays = game.days.filter((d) => !d.is_open);
  const open = game.challenges.find((c) => c.id === openId) ?? null;
  const totalPossible = game.challenges.reduce((s, c) => s + c.points, 0);

  function renderDay(d: Day) {
    const list = (challengesByDay.get(d.day) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    return (
      <div key={d.day} className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-terminal-border pb-2">
          <h2 className="text-lg font-extrabold text-terminal-green">{d.title}</h2>
          {d.event_label && (
            <span className="rounded border border-terminal-green/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-green">
              {d.event_label}
            </span>
          )}
        </div>
        {d.subtitle && <p className="mb-4 text-xs text-terminal-dim">{d.subtitle}</p>}

        {list.length === 0 ? (
          <p className="text-sm text-terminal-dim">Challenges will appear here.</p>
        ) : (
          order.map((diff) => {
            const group = list.filter((c) => c.difficulty === diff);
            if (group.length === 0) return null;
            return (
              <div key={diff} className="mb-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-terminal-dim">
                  {sectionTitle[diff]}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map((c) => (
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
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <Toasts announcements={game.announcements} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-terminal-border bg-terminal-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-terminal-green drop-shadow-[0_0_8px_rgb(var(--c-green)/0.5)]">
              KGSP<span className="text-terminal-strong">//</span>CTF
            </span>
            <span className="text-[9px] uppercase tracking-[0.25em] text-terminal-dim">
              KUAST Academy
            </span>
          </div>

          <Timer event={game.event} />

          <div className="flex items-center gap-2">
            {player && (
              <div className="rounded-lg border border-terminal-border bg-terminal-input/60 px-3 py-1.5 text-right">
                <div className="max-w-[9rem] truncate text-sm font-bold text-terminal-green">
                  {player.username}
                </div>
                <div className="text-[11px] text-terminal-dim">
                  <span className="text-terminal-amber">{game.myPoints}</span> / {totalPossible} pts
                </div>
              </div>
            )}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-lg border border-terminal-border px-3 py-2 text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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

      {/* Ended banner */}
      {eventState.status === 'ended' && (
        <div className="border-b border-terminal-amber/40 bg-terminal-amber/10 px-4 py-2 text-center text-sm text-terminal-amber">
          The event has ended.{' '}
          <button onClick={() => setShowPodium(true)} className="font-bold underline">
            🏁 Show final results
          </button>
        </div>
      )}

      {/* Main */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <section>
          {game.loading ? (
            <p className="py-20 text-center text-terminal-dim">Loading challenges…</p>
          ) : (
            <>
              {openDays.map(renderDay)}

              {lockedDays.map((d) => (
                <div
                  key={d.day}
                  className="mb-6 rounded-xl border border-dashed border-terminal-border bg-terminal-panel/50 p-6 text-center"
                >
                  <div className="text-3xl">🔒</div>
                  <h2 className="mt-2 text-lg font-bold text-terminal-dim">{d.title}</h2>
                  <p className="text-sm text-terminal-dim">
                    {d.subtitle ?? 'Locked — coming soon.'}
                  </p>
                  <span className="mt-3 inline-block rounded border border-terminal-amber/40 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-terminal-amber">
                    ⏳ Wait — unlocks later
                  </span>
                </div>
              ))}
            </>
          )}

          <p className="mt-4 text-center text-xs text-terminal-dim">
            Flags always look like <code className="text-terminal-green">KGSP&#123;...&#125;</code> · Delivered by
            KUAST Academy ·{' '}
            <Link to="/admin" className="underline decoration-dotted hover:text-terminal-green">
              instructor panel
            </Link>
          </p>
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <Leaderboard rows={game.leaderboard} meId={player?.id ?? null} frozen={frozen} />
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

      {/* Finale */}
      {showPodium && (
        <Podium rows={game.leaderboard} meId={player?.id ?? null} onClose={() => setShowPodium(false)} />
      )}

      {/* Registration gate */}
      {!player && <Register />}
    </div>
  );
}
