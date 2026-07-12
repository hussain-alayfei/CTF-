import { useEffect, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { looksLikeToken, xorDecryptHex } from '../../lib/dayseven';

const ID = 'd7_role_chip';
const COOKIE = 'd7_role';
const NEED = 'analyst';

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function encodeRole(role: string) {
  return btoa(JSON.stringify({ role, desk: 'front', v: 1 }));
}

function decodeRole(raw: string): string {
  try {
    const j = JSON.parse(atob(raw));
    return typeof j.role === 'string' ? j.role : '';
  } catch {
    return '';
  }
}

export default function RoleChipChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [role, setRole] = useState('');
  const [revealed, setRevealed] = useState('');

  useEffect(() => {
    if (!readCookie(COOKIE)) {
      document.cookie = `${COOKIE}=${encodeRole('guest')}; path=/; SameSite=Lax`;
    }
  }, []);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    const tick = () => setRole(decodeRole(readCookie(COOKIE)));
    tick();
    const id = window.setInterval(tick, 800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    if (role !== NEED || !revealHex) {
      setRevealed('');
      return;
    }
    xorDecryptHex(revealHex, NEED)
      .then((txt) => {
        if (alive && looksLikeToken(txt)) setRevealed(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [role, revealHex]);

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Role Chip"
      blurb="This portal trusts a small chip it left in your browser. Guests see a locked cabinet. Analysts who have stepped away from the front desk may open it — and the portal never re-checks with a server. Fix the chip on your side."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          Current role reading: <span className="font-mono text-terminal-amber">{role || '(none)'}</span>
        </p>
        <p className="mt-2 text-terminal-dim">Cabinet: {revealed ? 'OPEN' : 'LOCKED'}</p>
        {revealed && (
          <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
