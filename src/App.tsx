import { useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppContext } from './lib/app-context';
import { loadPlayer, savePlayer } from './lib/session';
import { isMuted, setMuted } from './lib/sounds';
import type { Player } from './lib/types';
import Play from './pages/Play';
import CookieChallenge from './pages/CookieChallenge';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [player, setPlayerState] = useState<Player | null>(() => loadPlayer());
  const [muted, setMutedState] = useState<boolean>(() => isMuted());

  const setPlayer = useCallback((p: Player | null) => {
    setPlayerState(p);
    if (p) savePlayer(p);
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const next = !m;
      setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  return (
    <AppContext.Provider value={{ player, setPlayer, muted, toggleMute }}>
      <Routes>
        <Route path="/" element={<Play />} />
        <Route path="/challenge/admin-panel" element={<CookieChallenge />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Play />} />
      </Routes>
    </AppContext.Provider>
  );
}
