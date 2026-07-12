import { useEffect, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { looksLikeToken, xorDecryptHex } from '../../lib/dayseven';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_triple_lock';

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export default function TripleLockChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [netFrag, setNetFrag] = useState('');
  const [revealed, setRevealed] = useState('');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) {
          setRevealHex(String(r.material.reveal_hex ?? ''));
          setNetFrag(String(r.material.net_frag ?? ''));
        }
      })
      .catch(() => {});
  }, [player]);

  function plantCookie() {
    unlockAudio();
    playClick();
    document.cookie = 'd7_lock_c=hatch; path=/; SameSite=Lax';
  }

  function pingNet() {
    if (!netFrag) return;
    unlockAudio();
    playClick();
    // Outbound only — never drawn on screen. Student must watch the request.
    fetch(`/collect/desk-ping?lock=n&seg=${encodeURIComponent(netFrag)}`, { cache: 'no-store' }).catch(
      () => {},
    );
  }

  function plantStash() {
    unlockAudio();
    playClick();
    localStorage.setItem('d7_lock_s', 'lock');
  }

  function tryOpen() {
    unlockAudio();
    playClick();
    const c = readCookie('d7_lock_c');
    const s = localStorage.getItem('d7_lock_s') ?? '';
    // Network piece must be typed by the student (they recovered it from the ping).
    const n = (document.getElementById('d7-net-piece') as HTMLInputElement | null)?.value.trim() ?? '';
    const seed = `c:${c}|n:${n}|s:${s}`;
    if (!revealHex) return;
    xorDecryptHex(revealHex, seed)
      .then((txt) => {
        if (looksLikeToken(txt)) setRevealed(txt);
        else setRevealed('');
      })
      .catch(() => setRevealed(''));
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Triple Lock"
      blurb="Three locks, three different places this browser keeps secrets. Arm each lock, recover the piece that never appears on screen, then open the vault. The vault only yields when all three agree."
    >
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={plantCookie}
          className="rounded-lg border border-terminal-border px-3 py-3 text-sm text-terminal-dim hover:border-terminal-green"
        >
          1 · Stamp visit
        </button>
        <button
          type="button"
          onClick={pingNet}
          className="rounded-lg border border-terminal-border px-3 py-3 text-sm text-terminal-dim hover:border-terminal-green"
        >
          2 · Ping desk
        </button>
        <button
          type="button"
          onClick={plantStash}
          className="rounded-lg border border-terminal-border px-3 py-3 text-sm text-terminal-dim hover:border-terminal-green"
        >
          3 · Stash mark
        </button>
      </div>
      <div className="mt-4 space-y-2 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
        <label className="block text-xs text-terminal-dim">
          Middle piece (the one that left the browser)
          <input
            id="d7-net-piece"
            className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
            placeholder="what the ping carried"
          />
        </label>
        <button
          type="button"
          onClick={tryOpen}
          className="rounded-lg border border-terminal-amber/50 px-3 py-2 text-sm font-bold text-terminal-amber"
        >
          Open triple lock
        </button>
        {revealed && <code className="block font-mono text-lg text-terminal-green">{revealed}</code>}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
