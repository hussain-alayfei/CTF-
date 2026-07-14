import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_header_mirror';
const PING = '/challenges/day8/ping.txt';

export default function HeaderMirrorChallenge() {
  const { player } = useApp();
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');

  async function ping() {
    unlockAudio();
    playClick();
    setStatus('Pinging…');
    setCode('');
    try {
      const res = await fetch(PING, { cache: 'no-store' });
      const ticket = res.headers.get('X-Desk-Ticket') ?? res.headers.get('x-desk-ticket') ?? '';
      setStatus(`HTTP ${res.status} · check response headers for the desk ticket`);
      if (!player || !ticket) return;
      const mat = await fetchChallengeLiveMaterial(player, ID);
      if (!mat.ok || !mat.material) return;
      const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), ticket);
      if (looksLikeToken(txt)) setCode(txt);
    } catch {
      setStatus('Ping failed');
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Header Mirror"
      blurb="The page body is boring. Ask the desk for a ping and read how the reply describes itself — not only the text it prints."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">Lobby mirror · nothing useful rendered here.</p>
        <button
          type="button"
          onClick={() => void ping()}
          className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
        >
          Ping desk
        </button>
        {status && <p className="text-xs text-terminal-dim">{status}</p>}
        {code && (
          <p className="text-sm text-terminal-green">
            Desk code unlocked: <code className="font-mono text-terminal-amber">{code}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
