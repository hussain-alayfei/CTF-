import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';

const ID = 'd8_cookie_lounge';
const COOKIE = 'd8_lounge';

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function pack(tier: string) {
  return btoa(`guest:${tier}`);
}

function unpack(raw: string): string {
  try {
    const s = atob(raw);
    const parts = s.split(':');
    return parts[1] ?? '';
  } catch {
    return '';
  }
}

export default function CookieLoungeChallenge() {
  const { player } = useApp();
  const [tier, setTier] = useState('');
  const [plaque, setPlaque] = useState('');

  useEffect(() => {
    if (!readCookie(COOKIE)) {
      document.cookie = `${COOKIE}=${pack('free')}; path=/; SameSite=Lax`;
    }
  }, []);

  useEffect(() => {
    const tick = () => setTier(unpack(readCookie(COOKIE)));
    tick();
    const id = window.setInterval(tick, 700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    if (tier !== 'vip' || !player) {
      setPlaque('');
      return;
    }
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material) return;
        const txt = await xorDecryptHex(String(r.material.reveal_hex ?? ''), 'vip');
        if (alive && looksLikeToken(txt)) setPlaque(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tier, player]);

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Cookie Lounge"
      blurb="Signed in as a guest. Theme preferences live in a cookie the lounge trusts too much. VIP plaque appears only when the server-side check (there is none) would have accepted VIP."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          Current lounge tier (from cookie):{' '}
          <code className="text-terminal-amber">{tier || '…'}</code>
        </p>
        {plaque ? (
          <p className="mt-3 text-terminal-green">
            VIP plaque: <code className="font-mono text-terminal-amber">{plaque}</code>
          </p>
        ) : (
          <p className="mt-3 text-xs text-terminal-dim">VIP plaque locked.</p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
