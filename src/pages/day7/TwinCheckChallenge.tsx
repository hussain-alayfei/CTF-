import { useEffect, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { looksLikeToken, xorDecryptHex } from '../../lib/dayseven';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_twin_check';
const COOKIE = 'd7_pair';

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function TwinCheckChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [pair, setPair] = useState('');
  const [field, setField] = useState('');
  const [revealed, setRevealed] = useState('');

  useEffect(() => {
    let v = readCookie(COOKIE);
    if (!v) {
      v = randomToken();
      document.cookie = `${COOKIE}=${v}; path=/; SameSite=Lax`;
    }
    setPair(v);
  }, []);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
  }, [player]);

  function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    playClick();
    const cookieNow = readCookie(COOKIE);
    if (!cookieNow || field.trim() !== cookieNow || !revealHex) {
      setRevealed('');
      return;
    }
    xorDecryptHex(revealHex, 'paired')
      .then((txt) => {
        if (looksLikeToken(txt)) setRevealed(txt);
      })
      .catch(() => setRevealed(''));
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Twin Check"
      blurb="This form only accepts a request when two copies of the same desk token agree — one the browser already holds, and one you place in the form. They must match exactly. Find the one that was planted, mirror it, then unlock."
    >
      <form onSubmit={tryUnlock} className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
        <input type="hidden" name="noise" value="ignore" />
        <label className="block text-xs text-terminal-dim">
          Desk confirmation
          <input
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
            placeholder="paste the twin here"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan"
        >
          Check twins
        </button>
        {revealed ? (
          <code className="block font-mono text-lg text-terminal-green">{revealed}</code>
        ) : (
          pair && <p className="text-xs text-terminal-dim">Waiting for a matching pair…</p>
        )}
      </form>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
