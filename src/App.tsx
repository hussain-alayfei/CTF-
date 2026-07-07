import { useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppContext } from './lib/app-context';
import { clearPlayer, loadPlayer, savePlayer } from './lib/session';
import { playerStillExists } from './lib/api';
import { isMuted, setMuted } from './lib/sounds';
import { applyTheme, getTheme, type Theme } from './lib/theme';
import type { Player } from './lib/types';
import Play from './pages/Play';
import CookieChallenge from './pages/CookieChallenge';
import AdminPanel from './pages/AdminPanel';

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

  const toggleMute = useCallback(() => {
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
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Play />} />
      </Routes>
    </AppContext.Provider>
  );
}
