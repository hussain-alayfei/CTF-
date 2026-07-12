import { useEffect, useRef, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { looksLikeToken, xorDecryptHex } from '../../lib/dayseven';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_flash_seat';
const ROLE_KEY = 'd7_flash_role';
const WINDOW_MS = 180;

type Snap = { at: number; role: string };

/**
 * Danger — TOCTOU race. Reserve snapshots role while it must be "guest".
 * Confirm requires the snapshot to still be fresh (<180ms) AND the live role
 * to have become "admin". Setting admin before Reserve fails the snapshot check.
 */
export default function FlashSeatChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [status, setStatus] = useState('idle');
  const [revealed, setRevealed] = useState('');
  const [liveRole, setLiveRole] = useState('guest');
  const snapRef = useRef<Snap | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(ROLE_KEY)) localStorage.setItem(ROLE_KEY, 'guest');
    const tick = () => setLiveRole(localStorage.getItem(ROLE_KEY) ?? 'guest');
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

  function reserve() {
    unlockAudio();
    playClick();
    setRevealed('');
    const role = localStorage.getItem(ROLE_KEY) ?? 'guest';
    snapRef.current = { at: performance.now(), role };
    setStatus(`reserved as ${role}`);
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
    // Must have reserved as guest, flipped to admin, and confirmed inside the window.
    if (snap.role !== 'guest' || nowRole !== 'admin' || elapsed > WINDOW_MS) {
      setStatus(`rejected (snap=${snap.role}, now=${nowRole}, ${Math.round(elapsed)}ms)`);
      snapRef.current = null;
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
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Flash Seat"
      blurb="The desk lets a guest reserve a seat, then confirm it — but the confirm step is picky about who you are *now* versus who you were when you reserved. The window is short. Win the seat."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p>
          Live role reading:{' '}
          <span className="font-mono text-terminal-amber">{liveRole}</span>
        </p>
        <p className="mt-2 text-xs opacity-70">
          The desk planted a lasting role mark in this browser. Guests may reserve; only a flipped mark survives confirm.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
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
