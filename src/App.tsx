import { useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppContext } from './lib/app-context';
import { clearPlayer, loadPlayer, savePlayer } from './lib/session';
import { playerStillExists } from './lib/api';
import { isMuted, setMuted, unlockAudio } from './lib/sounds';
import { applyTheme, getTheme, type Theme } from './lib/theme';
import type { Player } from './lib/types';
import Play from './pages/Play';
import CookieChallenge from './pages/CookieChallenge';
import Board from './pages/Board';
import RouterConsoleChallenge from './pages/RouterConsoleChallenge';
import AnswerVerifyChallenge from './pages/AnswerVerifyChallenge';
import CachePhantomChallenge from './pages/CachePhantomChallenge';
import ConsentLabyrinthChallenge from './pages/ConsentLabyrinthChallenge';
import GhostProfileChallenge from './pages/GhostProfileChallenge';
import RefererBurnChallenge from './pages/RefererBurnChallenge';
import CookieJarChallenge from './pages/CookieJarChallenge';
import EntropyPortalChallenge from './pages/EntropyPortalChallenge';
import SupercookieChallenge from './pages/SupercookieChallenge';
import ReidentifiedChallenge from './pages/ReidentifiedChallenge';

export default function App() {
  const [player, setPlayerState] = useState<Player | null>(() => loadPlayer());
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  const setPlayer = useCallback((p: Player | null) => {
    setPlayerState(p);
    if (p) savePlayer(p);
    else clearPlayer();
  }, []);

  // If an admin deleted this account, sign the player out on next load.
  useEffect(() => {
    if (!player) return;
    let alive = true;
    (async () => {
      const exists = await playerStillExists(player.id);
      if (alive && !exists) {
        clearPlayer();
        setPlayerState(null);
      }
    })();
    return () => {
      alive = false;
    };
    // Only re-check when the player identity changes.
  }, [player?.id]);

  // Browsers keep the Web Audio context suspended until a genuine user gesture
  // resumes it. Without this, the very first thing to touch the audio context
  // was the countdown timer's per-second tick (a setInterval callback, NOT a
  // gesture), which silently poisoned it into staying suspended forever — so
  // sound never worked on the arena/board even though nothing was muted. This
  // listens for the player's very first click/tap/keypress anywhere on the
  // page and unlocks audio right then, before anything else can claim it.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const toggleMute = useCallback(() => {
    unlockAudio();
    setMutedState((m) => {
      const next = !m;
      setMuted(next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <AppContext.Provider value={{ player, setPlayer, muted, toggleMute, theme, toggleTheme }}>
      <Routes>
        <Route path="/" element={<Play />} />
        <Route path="/challenge/admin-panel" element={<CookieChallenge />} />
        <Route path="/challenge/router-console" element={<RouterConsoleChallenge />} />
        <Route path="/challenge/cache-phantom" element={<CachePhantomChallenge />} />
        <Route path="/challenge/consent-labyrinth" element={<ConsentLabyrinthChallenge />} />
        <Route path="/challenge/ghost-profile" element={<GhostProfileChallenge />} />
        <Route path="/challenge/referer-burn" element={<RefererBurnChallenge />} />
        <Route path="/challenge/cookie-jar" element={<CookieJarChallenge />} />
        <Route path="/challenge/entropy-portal" element={<EntropyPortalChallenge />} />
        <Route path="/challenge/supercookie" element={<SupercookieChallenge />} />
        <Route path="/challenge/re-identified" element={<ReidentifiedChallenge />} />
        <Route path="/challenge/verify/:challengeId" element={<AnswerVerifyChallenge />} />
        {/* /admin is no longer a route — the instructor panel opens as an in-page
            overlay from the arena (see Play.tsx) so the arena's realtime/game
            state never remounts. Any old /admin link falls through to Play below. */}
        <Route path="/board" element={<Board />} />
        <Route path="*" element={<Play />} />
      </Routes>
    </AppContext.Provider>
  );
}
