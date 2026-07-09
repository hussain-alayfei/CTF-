import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { useGame } from '../lib/useGame';
import { getEventState } from '../lib/time';
import { checkDayCode } from '../lib/api';
import { playEventStart, playEventEnd } from '../lib/sounds';
import { clearPlayer } from '../lib/session';
import type { Challenge, Day, Difficulty } from '../lib/types';
import Register from '../components/Register';
import Timer, { ArenaTimerBanner } from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import ChallengeCard from '../components/ChallengeCard';
import ChallengeModal from '../components/ChallengeModal';
import Toasts from '../components/Toasts';
import Podium from '../components/Podium';
import ProfileModal from '../components/ProfileModal';
import GoOverlay from '../components/GoOverlay';

const order: Difficulty[] = ['easy', 'medium', 'hard', 'danger'];
const sectionTitle: Record<Difficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Very Hard',
  danger: '☠ Danger',
};

const UNLOCKED_DAYS_KEY = 'kgsp_ctf_unlocked_days';
// Remembers which round (by its starts_at) we've already played the "GO!" intro
// for, so navigating into a challenge page and back never replays it.
const GO_ROUND_KEY = 'kgsp_ctf_go_round';

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
  const [searchParams, setSearchParams] = useSearchParams();

  // A challenge page links back here as `/?c=<challengeId>` so pressing "back to
  // the challenge" reopens the exact challenge the player was on, instead of
  // dumping them at the top of the arena. This MUST be read synchronously in
  // the initial useState (not in a useEffect) — an effect only runs after the
  // very first paint, so the arena would render once with no modal and then
  // immediately re-render with it open, a visible "arena flashes then the
  // challenge appears" flicker. Reading it eagerly here means the modal is
  // already part of the very first render.
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get('c'));

  // Strip the `c` param from the URL once, independent of whether the
  // challenge list has finished loading, so a later close/refresh never
  // reopens it and the address bar doesn't linger on a stale param.
  const cleanedChallengeParam = useRef(false);
  useEffect(() => {
    if (cleanedChallengeParam.current) return;
    if (!searchParams.get('c')) return;
    cleanedChallengeParam.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('c');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Once the challenge list has actually loaded, if the id from the URL turns
  // out to not exist (bad link, deleted challenge, locked day), close it
  // instead of leaving the modal stuck trying to render a missing challenge.
  useEffect(() => {
    if (openId && game.challenges.length > 0 && !game.challenges.some((c) => c.id === openId)) {
      setOpenId(null);
    }
  }, [openId, game.challenges]);
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

  // Whenever a fresh event_config arrives (initial load, or a Realtime push
  // right after an admin action like "Start event"), resync `now` to the
  // real clock IMMEDIATELY. This is deliberately a separate effect from the
  // boundary scheduler below, keyed only on `game.event` (not `now`), so it
  // can't loop.
  //
  // Why this matters: `admin_start_event` sets `starts_at = now()` on the
  // server, so by the time that update reaches the browser, `starts_at` is
  // already a few hundred ms in the past. The scheduler below only arms a
  // timer for boundaries that are still in the FUTURE relative to the real
  // clock — so a start time that's already elapsed gets silently skipped and
  // no timer is ever armed for it. Without this effect, the stale `now` left
  // over from before the event started would keep `eventState.status`
  // pinned at 'idle' forever (only the far-future `ends_at` would still get
  // a timer, jumping straight to 'ended' later) — which is exactly why the
  // "LIVE" state and the 3-2-1/GO overlay never appeared until a manual
  // page refresh forced `now` to reset fresh at mount.
  useEffect(() => {
    if (!game.event) return;
    setNow(Date.now());
  }, [game.event]);

  // Re-render only at the event's start/end boundaries instead of every second.
  // The live countdown is driven independently by <Timer/>, so the arena tree
  // (leaderboard, cards, podium) no longer repaints once per second — that
  // per-second repaint, amplified by the podium's backdrop layer, was what made
  // the board visibly shimmer.
  useEffect(() => {
    const ev = game.event;
    if (!ev?.starts_at) return;
    const start = Date.parse(ev.starts_at);
    const end = ev.ends_at ? Date.parse(ev.ends_at) : null;
    const t = Date.now();
    const targets = [start, end].filter((x): x is number => x != null && x > t);
    if (targets.length === 0) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(...targets) - t + 60);
    return () => clearTimeout(id);
  }, [game.event, now]);

  const eventState = getEventState(game.event, now);

  // Collapsible day sections (arrow expanders). A day is expanded unless the
  // player has collapsed it; the live day starts expanded.
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  function toggleDay(day: number) {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  // Only auto-show the podium if the status transitioned to 'ended' while this
  // player was already on the page (prevStatus was 'running'). Logging in while
  // the event is already over must NOT pop the podium automatically — the player
  // missed the live reveal and can use "Show final results" if needed.
  useEffect(() => {
    if (
      eventState.status === 'ended' &&
      prevStatus.current === 'running' &&
      !podiumShown.current &&
      game.leaderboard.some((r) => r.total_points > 0)
    ) {
      podiumShown.current = true;
      setShowPodium(true);
    }
  }, [eventState.status, game.leaderboard]);

  // Announce the round start exactly ONCE per round. The marker is keyed by the
  // round's starts_at and persisted in sessionStorage, so opening a challenge
  // route and returning here (which remounts this whole component) does NOT
  // replay the "GO!" overlay/chime — that remount-replay was the "looping GO"
  // bug. A brand-new round has a new starts_at, so it legitimately announces
  // again. The end chime fires only on a live running->ended transition within
  // this session, never on a fresh mount into an already-ended round.
  useEffect(() => {
    const ev = game.event;
    const status = eventState.status;

    if (status === 'running' && ev?.starts_at) {
      let announced: string | null = null;
      try {
        announced = sessionStorage.getItem(GO_ROUND_KEY);
      } catch {
        /* sessionStorage unavailable — degrade gracefully */
      }
      if (announced !== ev.starts_at) {
        try {
          sessionStorage.setItem(GO_ROUND_KEY, ev.starts_at);
        } catch {
          /* ignore */
        }
        // A genuinely new round: allow its finale to trigger again later.
        podiumShown.current = false;
        setShowPodium(false);
        playEventStart();
        setShowGo(true);
        // GoOverlay runs its own 3-2-1-GO sequence and calls onDone when done.
        prevStatus.current = status;
        return;
      }
    }

    if (status === 'ended' && prevStatus.current === 'running') {
      playEventEnd();
    }
    prevStatus.current = status;
  }, [eventState.status, game.event?.starts_at]);

  const challengesByDay = useMemo(() => {
    const map = new Map<number, Challenge[]>();
    for (const c of game.challenges) {
      const arr = map.get(c.day) ?? [];
      arr.push(c);
      map.set(c.day, arr);
    }
    return map;
  }, [game.challenges]);

  // Only offer the leaderboard's day-picker for days that actually have a
  // board worth looking at (some scores) plus the live day — otherwise the
  // picker fills with empty, locked days. Memoized so the 1s clock tick doesn't
  // hand the (memoized) Leaderboard a fresh array every second.
  const boardDays = useMemo(() => {
    const challDay = new Map(game.challenges.map((c) => [c.id, c.day]));
    const withScore = new Set<number>();
    for (const s of game.solves) {
      const d = challDay.get(s.challenge_id);
      if (d != null) withScore.add(d);
    }
    if (game.event?.active_day != null) withScore.add(game.event.active_day);
    return game.days.filter((d) => withScore.has(d.day));
  }, [game.challenges, game.solves, game.days, game.event?.active_day]);

  // Which day is the live competition?
  const activeDay = game.event?.active_day ?? null;
  const sortedDays = [...game.days].sort((a, b) => a.sort_order - b.sort_order);
  const activeDayObj = sortedDays.find((d) => d.day === activeDay) ?? null;

  // After the event ends, treat the ended state as "idle" once 30 min have passed
  // so the page refreshes cleanly for the next day instead of showing "TIME'S UP" forever.
  const endedAt = game.event?.ends_at ? Date.parse(game.event.ends_at) : null;
  const staleEnded = eventState.status === 'ended' && endedAt != null && Date.now() - endedAt > 30 * 60 * 1000;
  const effectiveStatus = staleEnded ? 'idle' : eventState.status;

  // Fairness blur applies ONLY to the live competition day before/after its
  // round runs — never to completed/practice days. A day marked is_completed by
  // the admin is always readable so students can practice it, even with the
  // clock idle. Previously every open day blurred while idle, which wrongly hid
  // past days (3, 4) that students want to practice.
  const dayIsBlurred = (d: Day) =>
    !d.is_completed && d.day === activeDay && effectiveStatus !== 'running';

  // Day categories
  const restDays = sortedDays.filter((d) => d.is_rest && d.is_open);
  // The live section holds open, non-rest days that are NOT marked completed.
  const activeDays = sortedDays.filter((d) => d.is_open && !d.is_rest && !d.is_completed);
  const activeSortOrder = activeDayObj?.sort_order ?? -1;
  // Practice section: days the admin marked completed (still open) plus any past
  // closed days at/before the active day. All are always readable, never blurred.
  const finishedLockedDays = sortedDays.filter(
    (d) =>
      (d.is_open && !d.is_rest && d.is_completed) ||
      (!d.is_open && !d.is_rest && activeSortOrder >= 0 && d.sort_order <= activeSortOrder),
  );
  // Future locked days are intentionally not rendered — students shouldn't see them.

  const open = game.challenges.find((c) => c.id === openId) ?? null;
  const totalPossible = game.challenges.reduce((s, c) => s + c.points, 0);

  function handleLogout() {
    clearPlayer();
    setPlayer(null);
    setShowProfile(false);
  }

  async function submitDayCode(day: number) {
    if (!player) return;
    const code = (codeInputs[day] ?? '').trim();
    if (!code) return;
    setCodeBusy((p) => ({ ...p, [day]: true }));
    setCodeErrors((p) => ({ ...p, [day]: '' }));
    try {
      const ok = await checkDayCode(player, day, code);
      if (ok) {
        const next = new Set(unlockedDays);
        next.add(day);
        setUnlockedDays(next);
        saveUnlockedDays(next);
        // The server just recorded us as a competitor for this day — refresh so
        // we show up on the board (even at 0 points).
        void game.refreshBoard();
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

  // Has this player legally entered the live day?
  const enteredActiveDay = activeDayObj ? isDayAccessible(activeDayObj) : false;

  // `blurred` is decided per-day by the caller (dayIsBlurred) so only the live
  // day's cards are fairness-blurred; completed/practice days pass false.
  function renderChallengeGrid(list: Challenge[], blurred = false) {
    const shouldBlur = blurred;
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
                blurred={shouldBlur}
              />
            ))}
          </div>
        </div>
      );
    });
  }

  function renderDay(d: Day, finished = false) {
    const list = (challengesByDay.get(d.day) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const mainList = list.filter((c) => !c.is_extra);
    const extraList = list.filter((c) => c.is_extra);

    const isLive = d.day === activeDay;

    // Code gate — only for non-finished days (finished days are always accessible)
    if (!finished && d.requires_code && !isDayAccessible(d)) {
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

    const blurThisDay = dayIsBlurred(d);
    // Finished days start collapsed, live days start expanded
    const collapsed = finished ? !collapsedDays.has(d.day) : collapsedDays.has(d.day);
    function toggle() {
      // For finished days we invert the logic (default = collapsed, click = expanded)
      toggleDay(d.day);
    }

    return (
      <div key={d.day} className={`mb-10 ${finished ? 'opacity-70' : ''}`}>
        <button
          onClick={toggle}
          className="mb-3 flex w-full items-center justify-between gap-3 border-b border-terminal-border pb-2 text-left transition hover:border-terminal-green/50"
        >
          <h2 className={`flex items-center gap-2 text-lg font-extrabold ${finished ? 'text-terminal-dim line-through' : 'text-terminal-green'}`}>
            <span className={`text-terminal-dim transition-transform ${collapsed ? '' : 'rotate-90'}`}>▸</span>
            {d.title}
          </h2>
          <span className="flex items-center gap-2">
            <span className="text-[11px] text-terminal-dim">
              {list.length} challenge{list.length === 1 ? '' : 's'}
            </span>
            {isLive && effectiveStatus === 'running' ? (
              <span className="rounded border border-terminal-green/50 bg-terminal-green/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-green">
                ● Live · scoring
              </span>
            ) : finished ? (
              <span className="rounded border border-terminal-dim/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-dim">
                {d.is_completed ? '✓ Completed · practice' : '✓ Finished'}
              </span>
            ) : d.event_label ? (
              <span className="rounded border border-terminal-green/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-terminal-green">
                {d.event_label}
              </span>
            ) : null}
          </span>
        </button>

        {!collapsed && (
          <>
            {finished && (
              <p className="mb-4 rounded-lg border border-terminal-dim/30 bg-terminal-input/40 px-3 py-2 text-xs text-terminal-dim">
                {d.is_completed
                  ? '✓ This day is completed — open any challenge to practice, no waiting for the clock.'
                  : '✓ This day is finished. You can still open challenges for practice.'}
              </p>
            )}
            {d.subtitle && <p className="mb-4 text-xs text-terminal-dim">{d.subtitle}</p>}

            {list.length === 0 ? (
              <p className="text-sm text-terminal-dim">No challenges available for this day.</p>
            ) : (
              <>
                {mainList.length > 0 && renderChallengeGrid(mainList, blurThisDay)}

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
                    {renderChallengeGrid(extraList, blurThisDay)}
                  </div>
                )}
              </>
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

  // Not logged in: show ONLY the registration/login screen. Nothing else — no
  // arena, no leaderboard, no scores — renders behind it. The leaderboard must
  // never be visible to anyone who isn't a signed-in competitor.
  if (!player) {
    return <Register />;
  }

  return (
    <div className="min-h-full">
      <Toasts announcements={game.announcements} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-terminal-border bg-terminal-bg/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Logo — clickable home link */}
          <Link to="/" className="flex flex-col no-underline">
            <span className="text-xl font-extrabold tracking-tight text-terminal-green drop-shadow-[0_0_8px_rgb(var(--c-green)/0.5)]">
              KGSP<span className="text-terminal-strong">//</span>CTF
            </span>
            <span className="text-[9px] uppercase tracking-[0.25em] text-terminal-dim">
              KUAST Academy
            </span>
          </Link>

          {/* Sound-only timer — plays tick/time-up sounds, no visual */}
          <Timer event={game.event} />

          <div className="flex items-center gap-2">
            {player?.is_admin && (
              <>
                <Link
                  to="/admin"
                  className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-terminal-cyan transition hover:bg-terminal-cyan/10"
                >
                  🛠 Admin
                </Link>
                <Link
                  to="/board"
                  className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-terminal-cyan transition hover:bg-terminal-cyan/10"
                >
                  🖥 Board
                </Link>
              </>
            )}
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

      {/* Large prominent timer display */}
      <ArenaTimerBanner event={game.event} />

      {/* Event status banner */}
      {effectiveStatus === 'idle' && (
        <div className="animate-flicker border-b border-terminal-amber/40 bg-terminal-amber/10 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-terminal-amber">
          ◷ Waiting for the event to start… get ready, hacker.
        </div>
      )}
      {effectiveStatus === 'running' && (
        <div className="border-b border-terminal-green/40 bg-terminal-green/10 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-terminal-green">
          ● Event is LIVE — submissions are open. Go capture those flags!
        </div>
      )}
      {effectiveStatus === 'ended' && (
        <div className="border-b border-terminal-red/40 bg-terminal-red/10 px-4 py-2 text-center text-sm font-bold text-terminal-red">
          ⏹ The event has ended.{' '}
          <button onClick={() => setShowPodium(true)} className="underline">
            🏁 Show final results
          </button>
        </div>
      )}

      {/* 3-2-1 countdown + hurricane/fire GO! overlay — fires once per new round */}
      <GoOverlay show={showGo} onDone={() => setShowGo(false)} />

      {/* Main */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <section>
          {game.loading ? (
            <p className="py-20 text-center text-terminal-dim">Loading challenges…</p>
          ) : (
            <>
              {/* ── SECTION 1: Current / next day (open, active) ── */}
              {restDays.map(renderRestDay)}
              {activeDays.map((d) => renderDay(d))}

              {/* ── SECTION 2: Finished days (collapsed by default, strikethrough title) ── */}
              {finishedLockedDays.length > 0 && (
                <div className="mb-8">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-terminal-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-terminal-dim">
                      Completed days
                    </span>
                    <div className="h-px flex-1 bg-terminal-border" />
                  </div>
                  {finishedLockedDays.map((d) => renderDay(d, true))}
                </div>
              )}

              {/* ── Future / upcoming days are hidden — students don't see them ── */}
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
          {/* Show an empty leaderboard shell during initial load to avoid flashing
              LockedBoard → Leaderboard every time the player returns from a challenge. */}
          {game.loading ? (
            <div className="rounded-xl border border-terminal-border bg-terminal-panel">
              <div className="border-b border-terminal-border px-4 py-3">
                <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">▸ Leaderboard</h2>
              </div>
              <div className="flex items-center justify-center py-10 text-sm text-terminal-dim">
                <span className="animate-pulse">Loading…</span>
              </div>
            </div>
          ) : effectiveStatus === 'idle' ? (
            <LockedBoard
              icon="⏳"
              title="Leaderboard"
              text="The leaderboard will appear here when the next round starts. Get ready!"
            />
          ) : activeDay == null ? (
            <LockedBoard
              icon="⏳"
              title="Leaderboard"
              text="The leaderboard opens when the instructor makes a day live."
            />
          ) : !enteredActiveDay ? (
            <LockedBoard
              icon="🔒"
              title="Leaderboard locked"
              text={`Enter the access code for ${activeDayObj?.title ?? 'the live day'} to join the competition.`}
            />
          ) : effectiveStatus === 'running' ? (
            <LockedBoard
              icon="🙈"
              title="Standings hidden"
              text="The leaderboard stays hidden while the round is live — no peeking! Keep hacking; the full results are revealed the moment time runs out."
            />
          ) : (
            <Leaderboard
              rows={game.leaderboard}
              meId={player?.id ?? null}
              days={boardDays}
              activeDay={activeDay}
            />
          )}
        </aside>
      </main>

      {/* Challenge modal */}
      {open && player && (
        <ChallengeModal
          challenge={open}
          player={player}
          solved={game.mySolvedIds.has(open.id)}
          firstBloodBy={game.firstBloodByChallenge.get(open.id)}
          eventStatus={effectiveStatus}
          hidden={
            open.day === activeDay &&
            effectiveStatus !== 'running' &&
            !(sortedDays.find((d) => d.day === open.day)?.is_completed ?? false)
          }
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
    </div>
  );
}

// Shown in the leaderboard slot when the viewer hasn't unlocked the live day
// (or no day is live yet) — so only legitimate competitors see the standings.
function LockedBoard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel">
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <h2 className="font-bold uppercase tracking-widest text-terminal-cyan">▸ Leaderboard</h2>
      </div>
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="text-4xl">{icon}</span>
        <p className="font-bold text-terminal-amber">{title}</p>
        <p className="text-xs leading-relaxed text-terminal-dim">{text}</p>
      </div>
    </div>
  );
}
