import { useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppContext } from '@/lib/app-context';
import { clearPlayer, loadPlayer, savePlayer } from '@/lib/session';
import { playerStillExists } from '@/lib/api';
import { isMuted, setMuted, unlockAudio } from '@/lib/sounds';
import { applyTheme, getTheme, type Theme } from '@/lib/theme';
import type { Player } from '@/lib/types';
import Play from '@/arena/Play';
import CookieChallenge from '@/challenges/day4/CookieChallenge';
import RouterConsoleChallenge from '@/challenges/day4/RouterConsoleChallenge';
import AnswerVerifyChallenge from '@/challenges/shared/AnswerVerifyChallenge';
import CachePhantomChallenge from '@/challenges/day5/CachePhantomChallenge';
import ConsentLabyrinthChallenge from '@/challenges/day5/ConsentLabyrinthChallenge';
import GhostProfileChallenge from '@/challenges/day5/GhostProfileChallenge';
import RefererBurnChallenge from '@/challenges/day5/RefererBurnChallenge';
import CookieJarChallenge from '@/challenges/day5/CookieJarChallenge';
import EntropyPortalChallenge from '@/challenges/day5/EntropyPortalChallenge';
import SupercookieChallenge from '@/challenges/day5/SupercookieChallenge';
import ReidentifiedChallenge from '@/challenges/day5/ReidentifiedChallenge';
import MarkupTrailChallenge from '@/challenges/day7/MarkupTrailChallenge';
import SideDoorChallenge from '@/challenges/day7/SideDoorChallenge';
import DeskWizardChallenge from '@/challenges/day7/DeskWizardChallenge';
import RoleChipChallenge from '@/challenges/day7/RoleChipChallenge';
import TwinCheckChallenge from '@/challenges/day7/TwinCheckChallenge';
import FrameWhisperChallenge from '@/challenges/day7/FrameWhisperChallenge';
import StashOrderChallenge from '@/challenges/day7/StashOrderChallenge';
import LeakyDeskChallenge from '@/challenges/day7/LeakyDeskChallenge';
import SafeShelfChallenge from '@/challenges/day7/SafeShelfChallenge';
import QuietDirectoryChallenge from '@/challenges/day7/QuietDirectoryChallenge';
import StrictGuestbookChallenge from '@/challenges/day7/StrictGuestbookChallenge';
import ClaimTicketChallenge from '@/challenges/day7/ClaimTicketChallenge';
import InheritedTrustChallenge from '@/challenges/day7/InheritedTrustChallenge';
import CrossTalkChallenge from '@/challenges/day7/CrossTalkChallenge';
import FlashSeatChallenge from '@/challenges/day7/FlashSeatChallenge';

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
        <Route path="/challenge/markup-trail" element={<MarkupTrailChallenge />} />
        <Route path="/challenge/side-door" element={<SideDoorChallenge />} />
        <Route path="/challenge/side-door/hatch" element={<SideDoorChallenge />} />
        <Route path="/challenge/desk-wizard" element={<DeskWizardChallenge />} />
        <Route path="/challenge/role-chip" element={<RoleChipChallenge />} />
        <Route path="/challenge/twin-check" element={<TwinCheckChallenge />} />
        <Route path="/challenge/frame-whisper" element={<FrameWhisperChallenge />} />
        <Route path="/challenge/stash-order" element={<StashOrderChallenge />} />
        <Route path="/challenge/leaky-desk" element={<LeakyDeskChallenge />} />
        <Route path="/challenge/safe-shelf" element={<SafeShelfChallenge />} />
        <Route path="/challenge/quiet-directory" element={<QuietDirectoryChallenge />} />
        <Route path="/challenge/strict-guestbook" element={<StrictGuestbookChallenge />} />
        <Route path="/challenge/claim-ticket" element={<ClaimTicketChallenge />} />
        <Route path="/challenge/inherited-trust" element={<InheritedTrustChallenge />} />
        <Route path="/challenge/cross-talk" element={<CrossTalkChallenge />} />
        <Route path="/challenge/flash-seat" element={<FlashSeatChallenge />} />
        <Route path="/challenge/verify/:challengeId" element={<AnswerVerifyChallenge />} />
        {/* Neither /admin nor /board are routes anymore — the instructor panel and
            the projector board both open as in-page overlays from the arena (see
            Play.tsx) so the arena's realtime/game state never remounts. Any old
            /admin or /board link falls through to Play below. */}
        <Route path="*" element={<Play />} />
      </Routes>
    </AppContext.Provider>
  );
}
