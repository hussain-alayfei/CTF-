import { Link } from 'react-router-dom';
import type { Player } from '../lib/types';

/** Which full-screen view is on top. Board and Admin are overlays on the arena, but
 *  to the instructor they behave like tabs, so the header treats them as tabs. */
export type View = 'arena' | 'board' | 'admin';

/**
 * The header is the one thing on screen for the whole event, so it says what it is
 * and where you are — loudly. The old one hid Admin and Board as two identical
 * outline buttons floating between the logo and the player chip, with nothing marking
 * which view you were actually in.
 *
 * Now: a segmented nav with a lit-up active tab, the player chip pushed to its own
 * group on the right, and the utility toggles reduced to icons so they stop competing
 * with the navigation.
 */
export default function HeaderBar({
  player,
  view,
  onView,
  myPoints,
  totalPoints,
  muted,
  toggleMute,
  theme,
  toggleTheme,
  onProfile,
}: {
  player: Player;
  view: View;
  onView: (v: View) => void;
  myPoints: number;
  totalPoints: number;
  muted: boolean;
  toggleMute: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onProfile: () => void;
}) {
  const pct = totalPoints > 0 ? Math.min(100, Math.round((myPoints / totalPoints) * 100)) : 0;

  return (
    <header className="ctf-header sticky top-0 z-20 border-b border-terminal-green/25 bg-terminal-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        {/* ── Identity ── */}
        <Link to="/" className="group flex shrink-0 items-baseline gap-2 no-underline">
          <span
            className="ctf-glitch font-mono text-lg font-black tracking-tight text-terminal-green sm:text-xl"
            data-text="KGSP//CTF"
          >
            KGSP<span className="text-terminal-strong">//</span>CTF
          </span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.3em] text-terminal-dim sm:inline">
            /kuast_academy
          </span>
        </Link>

        {/* ── Navigation — the actual tabs ── */}
        <nav className="order-3 flex w-full items-center gap-1 rounded-lg border border-terminal-border bg-terminal-input/50 p-1 sm:order-none sm:ml-auto sm:w-auto">
          <Tab active={view === 'arena'} onClick={() => onView('arena')} glyph="▚" label="Arena" />
          {player.is_admin && (
            <>
              <Tab active={view === 'board'} onClick={() => onView('board')} glyph="▣" label="Board" />
              <Tab active={view === 'admin'} onClick={() => onView('admin')} glyph="⚙" label="Admin" />
            </>
          )}
        </nav>

        {/* ── You ── */}
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <button
            onClick={onProfile}
            title="Your profile"
            className="group flex items-center gap-2.5 rounded-lg border border-terminal-border bg-terminal-input/60 py-1.5 pl-2.5 pr-3 transition hover:border-terminal-green hover:shadow-neon"
          >
            <span className="text-lg leading-none">{player.avatar}</span>
            <span className="text-left">
              <span className="block max-w-[8.5rem] truncate font-mono text-xs font-bold text-terminal-green group-hover:underline">
                {player.username}
              </span>
              {/* A score you can read at a glance beats a fraction you have to do
                  arithmetic on: the bar is the point, the numbers are the detail. */}
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1 w-14 overflow-hidden rounded-full bg-terminal-border">
                  <span
                    className="block h-full rounded-full bg-terminal-amber transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="font-mono text-[10px] tabular-nums text-terminal-dim">
                  <span className="text-terminal-amber">{myPoints}</span>/{totalPoints}
                </span>
              </span>
            </span>
          </button>

          <div className="flex items-center gap-1">
            <IconButton
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </IconButton>
            <IconButton onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? '🔇' : '🔊'}
            </IconButton>
          </div>
        </div>
      </div>
    </header>
  );
}

function Tab({
  active,
  onClick,
  glyph,
  label,
}: {
  active: boolean;
  onClick: () => void;
  glyph: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-widest transition sm:flex-none ${
        active
          ? 'bg-terminal-green/15 text-terminal-green shadow-neon ring-1 ring-terminal-green/60'
          : 'text-terminal-dim hover:bg-terminal-green/5 hover:text-terminal-green/80'
      }`}
    >
      <span aria-hidden className={active ? 'animate-flicker' : ''}>
        {glyph}
      </span>
      {label}
    </button>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-terminal-border text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green"
    >
      {children}
    </button>
  );
}
