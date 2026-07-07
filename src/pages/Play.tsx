import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { useGame } from '../lib/useGame';
import { getEventState, isFrozen } from '../lib/time';
import { checkDayCode } from '../lib/api';
import { playEventStart, playEventEnd } from '../lib/sounds';
import { clearPlayer } from '../lib/session';
import type { Challenge, Day, Difficulty } from '../lib/types';
import Register from '../components/Register';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import ChallengeCard from '../components/ChallengeCard';
import ChallengeModal from '../components/ChallengeModal';
import Toasts from '../components/Toasts';
import Podium from '../components/Podium';
import ProfileModal from '../components/ProfileModal';

const order: Difficulty[] = ['easy', 'medium', 'hard'];
const sectionTitle: Record<Difficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Very Hard',
};

const UNLOCKED_DAYS_KEY = 'kgsp_ctf_unlocked_days';

function loadUnlockedDays(): Set<number> {
  try {
    const raw = localStorage.getItem(UNLOCKED_DAYS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveUnlockedDays(s: Set<number>) {
  localStorage.setItem(UNLOCKED_DAYS_KEY, JSON.stringify([...s]));
}

export default function Play() {
  const { player, setPlayer, muted, toggleMute, theme, toggleTheme } = useApp();
  const game = useGame(player);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showPodium, setShowPodium] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGo, setShowGo] = useState(false);
  const podiumShown = useRef(false);
  const prevStatus = useRef<string | null>(null);

  // Per-day code gate (client-side unlock cache)
  const [unlockedDays, setUnlockedDays] = useState<Set<number>>(loadUnlockedDays);
  const [codeInputs, setCodeInputs] = useState<Record<number, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<number, string>>({});
  const [codeBusy, setCodeBusy] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const eventState = getEventState(game.event, now);
  const frozen = isFrozen(game.event, now);

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

  // Announce event transitions to players (sound + GO overlay).
  useEffect(() => {
    const prev = prevStatus.current;
    if (prev && prev !== eventState.status) {
      // Leaving "ended" (via admin Reset or a fresh Restart) means a new round
      // is starting — allow the finale to trigger again for this round.
      if (prev === 'ended' && eventState.status !== 'ended') {
        podiumShown.current = false;
        setShowPodium(false);
      }
      if ((prev === 'idle' || prev === 'ended') && eventState.status === 'running') {
        playEventStart();
        setShowGo(true);
        const t = setTimeout(() => setShowGo(false), 3000);
        prevStatus.current = eventState.status;
        return () => clearTimeout(t);
      }
      if (eventState.status === 'ended') {
        playEventEnd();
      }
    }
    prevStatus.current = eventState.status;
  }, [eventState.status]);

  const challengesByDay = useMemo(() => {
    const map = new Map<number, Challenge[]>();
    for (const c of game.challenges) {
      const arr = map.get(c.day) ?? [];
      arr.push(c);
      map.set(c.day, arr);
    }
    return map;
  }, [game.challenges]);

  // Day categories
  const sortedDays = [...game.days].sort((a, b) => a.sort_order - b.sort_order);
  const restDays = sortedDays.filter((d) => d.is_rest && d.is_open);
  const activeDays = sortedDays.filter((d) => d.is_open && !d.is_rest);
  const lockedDays = sortedDays.filter((d) => !d.is_open);

  const open = game.challenges.find((c) => c.id === openId) ?? null;
  const totalPossible = game.challenges.reduce((s, c) => s + c.points, 0);

  function handleLogout() {
    clearPlayer();
    setPlayer(null);
    setShowProfile(false);
  }

  async function submitDayCode(day: number) {
    const code = (codeInputs[day] ?? '').trim();
    if (!code) return;
    setCodeBusy((p) => ({ ...p, [day]: true }));
    setCodeErrors((p) => ({ ...p, [day]: '' }));
    try {
      const ok = await checkDayCode(day, code);
      if (ok) {
        const next = new Set(unlockedDays);
        next.add(day);
        setUnlockedDays(next);
        saveUnlockedDays(next);
      } else {
        setCodeErrors((p) => ({ ...p, [day]: 'Wrong code — ask your instructor.' }));
      }
    } catch {
      setCodeErrors((p) => ({ ...p, [day]: 'Could not verify code.' }));
    } finally {
      setCodeBusy((p) => ({ ...p, [day]: false }));
    }
  }

  function isDayAccessible(d: Day): boolean {
    if (!d.requires_code) return true;
    return unlockedDays.has(d.day);
  }

  function renderChallengeGrid(list: Challenge[]) {
    return order.map((diff) => {
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
    });
  }

  function renderDay(d: Day) {
    const list = (challengesByDay.get(d.day) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const mainList = list.filter((c) => !c.is_extra);
    const extraList = list.filter((c) => c.is_extra);

    // Code gate
    if (d.requires_code && !isDayAccessible(d)) {
      return (
        <div key={d.day} className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-terminal-border pb-2">
            <h2 className="text-lg font-extrabold text-terminal-green">{d.title}</h2>
            <span className="rounded border border-terminal-amber/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-amber">
              🔐 code required
            </span>
          </div>
          {d.subtitle && <p className="mb-3 text-xs text-terminal-dim">{d.subtitle}</p>}
          <div className="rounded-xl border border-dashed border-terminal-amber/50 bg-terminal-amber/5 p-5 text-center">
            <div className="text-2xl">🔐</div>
            <p className="mt-2 text-sm text-terminal-amber">Enter the access code to unlock this day.</p>
            <div className="mx-auto mt-3 flex max-w-xs gap-2">
              <input
                value={codeInputs[d.day] ?? ''}
                onChange={(e) => setCodeInputs((p) => ({ ...p, [d.day]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && submitDayCode(d.day)}
                placeholder="ACCESS-CODE"
                className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-sm text-terminal-green caret-terminal-green outline-none focus:border-terminal-green"
              />
              <button
                onClick={() => submitDayCode(d.day)}
                disabled={codeBusy[d.day]}
                className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
              >
                {codeBusy[d.day] ? '…' : 'Unlock'}
              </button>
            </div>
            {codeErrors[d.day] && (
              <p className="mt-2 text-xs text-terminal-red">{codeErrors[d.day]}</p>
            )}
          </div>
        </div>
      );
    }

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
          <>
            {mainList.length > 0 && renderChallengeGrid(mainList)}

            {extraList.length > 0 && (
              <div className={mainList.length > 0 ? 'mt-2 rounded-xl border border-dashed border-terminal-cyan/30 bg-terminal-cyan/5 p-4' : ''}>
                {mainList.length > 0 && (
                  <h3 className="mb-4 flex flex-wrap items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-terminal-cyan">
                    🎁 Extra Challenges
                    <span className="text-[10px] font-normal normal-case text-terminal-dim">
                      optional bonus practice — not required
                    </span>
                  </h3>
                )}
                {renderChallengeGrid(extraList)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderRestDay(d: Day) {
    return (
      <div
        key={d.day}
        className="mb-6 rounded-xl border border-terminal-border bg-terminal-panel/50 p-5 text-center"
      >
        <div className="text-3xl">😴</div>
        <h2 className="mt-2 text-lg font-bold text-terminal-dim">{d.title}</h2>
        <p className="text-sm text-terminal-dim">{d.subtitle ?? 'Rest day — no challenges today.'}</p>
        <span className="mt-2 inline-block rounded border border-terminal-dim/40 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-terminal-dim">
          Rest Day
        </span>
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
              <button
                onClick={() => setShowProfile(true)}
                className="group flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-input/60 px-3 py-1.5 transition hover:border-terminal-green hover:shadow-neon"
              >
                <span className="text-lg">{player.avatar}</span>
                <div className="text-right">
                  <div className="max-w-[9rem] truncate text-sm font-bold text-terminal-green group-hover:underline">
                    {player.username}
                  </div>
                  <div className="text-[11px] text-terminal-dim">
                    <span className="text-terminal-amber">{game.myPoints}</span> / {totalPossible} pts
                  </div>
                </div>
              </button>
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

      {/* Event status banner */}
      {eventState.status === 'idle' && (
        <div className="animate-flicker border-b border-terminal-amber/40 bg-terminal-amber/10 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-terminal-amber">
          ◷ Waiting for the event to start… get ready, hacker.
        </div>
      )}
      {eventState.status === 'running' && (
        <div className="border-b border-terminal-green/40 bg-terminal-green/10 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-terminal-green">
          ● Event is LIVE — submissions are open. Go capture those flags!
        </div>
      )}
      {eventState.status === 'ended' && (
        <div className="border-b border-terminal-red/40 bg-terminal-red/10 px-4 py-2 text-center text-sm font-bold text-terminal-red">
          ⏹ The event has ended.{' '}
          <button onClick={() => setShowPodium(true)} className="underline">
            🏁 Show final results
          </button>
        </div>
      )}

      {/* GO! overlay on start */}
      {showGo && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-terminal-bg/70 backdrop-blur-sm">
          <div className="animate-pop text-center">
            <div className="text-7xl font-extrabold tracking-widest text-terminal-green drop-shadow-[0_0_20px_rgb(var(--c-green)/0.7)] sm:text-9xl">
              GO!
            </div>
            <div className="mt-2 text-sm uppercase tracking-[0.3em] text-terminal-green">
              The hunt begins
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <section>
          {game.loading ? (
            <p className="py-20 text-center text-terminal-dim">Loading challenges…</p>
          ) : (
            <>
              {/* Rest days */}
              {restDays.map(renderRestDay)}

              {/* Active days (labs + bonus live together per day) */}
              {activeDays.map(renderDay)}

              {/* Locked days */}
              {lockedDays.map((d) => (
                <div
                  key={d.day}
                  className="mb-6 rounded-xl border border-dashed border-terminal-border bg-terminal-panel/50 p-6 text-center"
                >
                  <div className="text-3xl">{d.is_rest ? '😴' : '🔒'}</div>
                  <h2 className="mt-2 text-lg font-bold text-terminal-dim">{d.title}</h2>
                  <p className="text-sm text-terminal-dim">
                    {d.subtitle ?? (d.is_rest ? 'Rest day — not open yet.' : 'Locked — coming soon.')}
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

      {/* Profile modal */}
      {showProfile && player && (
        <ProfileModal
          player={player}
          leaderboard={game.leaderboard}
          solves={game.solves}
          challenges={game.challenges}
          myPoints={game.myPoints}
          onClose={() => setShowProfile(false)}
          onLogout={handleLogout}
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
