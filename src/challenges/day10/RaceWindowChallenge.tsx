import { useEffect, useRef, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, readCookie, writeCookie, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_race_window';
const ROLE_KEY = 'd10_race_role';
const ARM_COOKIE = 'd10_race_arm';
const TICKET_KEY = 'd10_race_ticket';
const WINDOW_MS = 450;

type Snap = { at: number; role: string; ticket: string };

/** Danger: arm → reserve guest → flip admin ≤450ms. */
export default function RaceWindowChallenge() {
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
    writeCookie(ARM_COOKIE, '1');
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
    const ticket = sessionStorage.getItem(TICKET_KEY) ?? '';
    if (elapsed > WINDOW_MS) {
      setStatus(`too slow (${Math.round(elapsed)}ms > ${WINDOW_MS}ms)`);
      snapRef.current = null;
      return;
    }
    if (nowRole !== 'admin' || ticket !== snap.ticket) {
      setStatus('confirm rejected — need admin seat with intact ticket');
      return;
    }
    if (!revealHex) {
      setStatus('desk material missing');
      return;
    }
    xorDecryptHex(revealHex, 'race').then((txt) => {
      if (looksLikeToken(txt)) {
        setRevealed(txt);
        setStatus('window won');
      }
    });
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Race Window"
      blurb="Arm the final desk, reserve a guest ticket, then flip your lasting role to admin and confirm while the ticket is still fresh. The confirm window is short."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p>
          Role: <code className="text-terminal-amber">{liveRole}</code>
          {' · '}
          Armed: <code className="text-terminal-amber">{armed ? 'yes' : 'no'}</code>
          {' · '}
          Storage key: <code>{ROLE_KEY}</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={armDesk}
            className="rounded border border-terminal-border px-3 py-1.5 text-xs font-bold"
          >
            Arm desk
          </button>
          <button
            type="button"
            onClick={reserve}
            className="rounded border border-terminal-border px-3 py-1.5 text-xs font-bold"
          >
            Reserve guest
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded border border-terminal-green bg-terminal-green/10 px-3 py-1.5 text-xs font-bold text-terminal-green"
          >
            Confirm
          </button>
        </div>
        <p className="text-xs text-terminal-dim">{status}</p>
        {revealed && (
          <p className="text-terminal-green">
            Plaque: <code className="font-mono text-terminal-amber">{revealed}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
