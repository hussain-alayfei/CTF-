import { useEffect, useRef, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayseven';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_flash_seat';
const ROLE_KEY = 'd7_flash_role';
const ARM_COOKIE = 'd7_flash_arm';
const TICKET_KEY = 'd7_flash_ticket';
const WINDOW_MS = 450;

type Snap = { at: number; role: string; ticket: string };

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Danger (multi-step + timed finish):
 * 1) Arm the desk (cookie)
 * 2) Reserve as guest → writes a one-shot ticket
 * 3) Flip lasting role to admin and Confirm inside 450ms with ticket intact
 */
export default function FlashSeatChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [status, setStatus] = useState('idle');
  const [revealed, setRevealed] = useState('');
  const [liveRole, setLiveRole] = useState('guest');
  const [armed, setArmed] = useState(false);
  const snapRef = useRef<Snap | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(ROLE_KEY)) localStorage.setItem(ROLE_KEY, 'guest');
    const tick = () => {
      setLiveRole(localStorage.getItem(ROLE_KEY) ?? 'guest');
      setArmed(readCookie(ARM_COOKIE) === '1');
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
  }, [player]);

  function armDesk() {
    unlockAudio();
    playClick();
    document.cookie = `${ARM_COOKIE}=1; path=/; SameSite=Lax`;
    setArmed(true);
    setStatus('desk armed');
  }

  function reserve() {
    unlockAudio();
    playClick();
    setRevealed('');
    if (readCookie(ARM_COOKIE) !== '1') {
      setStatus('reserve blocked — desk is not armed');
      return;
    }
    const role = localStorage.getItem(ROLE_KEY) ?? 'guest';
    if (role !== 'guest') {
      setStatus('reserve blocked — only a guest may reserve');
      return;
    }
    const ticket = [...crypto.getRandomValues(new Uint8Array(4))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    try {
      sessionStorage.setItem(TICKET_KEY, ticket);
    } catch {
      setStatus('reserve failed — short-term storage blocked');
      return;
    }
    snapRef.current = { at: performance.now(), role, ticket };
    setStatus(`reserved as guest · ticket ${ticket}`);
  }

  function confirm() {
    unlockAudio();
    playClick();
    const snap = snapRef.current;
    if (!snap) {
      setStatus('nothing reserved');
      return;
    }
    const elapsed = performance.now() - snap.at;
    const nowRole = localStorage.getItem(ROLE_KEY) ?? 'guest';
    const ticketNow = sessionStorage.getItem(TICKET_KEY) ?? '';
    const stillArmed = readCookie(ARM_COOKIE) === '1';

    if (
      !stillArmed ||
      snap.role !== 'guest' ||
      nowRole !== 'admin' ||
      ticketNow !== snap.ticket ||
      elapsed > WINDOW_MS
    ) {
      setStatus(
        `rejected (armed=${stillArmed}, snap=${snap.role}, now=${nowRole}, ticket=${
          ticketNow === snap.ticket ? 'ok' : 'bad'
        }, ${Math.round(elapsed)}ms)`,
      );
      snapRef.current = null;
      try {
        sessionStorage.removeItem(TICKET_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!revealHex) return;
    xorDecryptHex(revealHex, 'guest|admin')
      .then((txt) => {
        if (looksLikeToken(txt)) {
          setRevealed(txt);
          setStatus('seat claimed');
        }
      })
      .catch(() => setStatus('claim failed'));
    snapRef.current = null;
    try {
      sessionStorage.removeItem(TICKET_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Flash Seat"
      blurb="Arm the desk first. Then a guest may reserve a seat — but confirm only works if who you are now is not who you were when you reserved, the one-shot ticket still matches, and you finish before the desk forgets."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p>
          Live role reading:{' '}
          <span className="font-mono text-terminal-amber">{liveRole}</span>
        </p>
        <p className="mt-1">
          Desk arm:{' '}
          <span className="font-mono text-terminal-amber">{armed ? 'armed' : 'idle'}</span>
        </p>
        <p className="mt-2 text-xs opacity-70">
          A lasting role mark and a short-lived reservation ticket both matter. The finish window is short.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={armDesk}
          className="rounded-lg border border-terminal-green/50 px-3 py-2 text-sm font-bold text-terminal-green"
        >
          Arm desk
        </button>
        <button
          type="button"
          onClick={reserve}
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan"
        >
          Reserve
        </button>
        <button
          type="button"
          onClick={confirm}
          className="rounded-lg border border-terminal-amber/50 px-3 py-2 text-sm font-bold text-terminal-amber"
        >
          Confirm
        </button>
      </div>
      <p className="mt-3 text-xs text-terminal-dim">{status}</p>
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
