import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, readCookie, writeCookie, xorDecryptHex } from './dayten';

const ID = 'd10_poisoned_prefs';
const COOKIE = 'd10_prefs';

type Prefs = { theme: string; role: string };

function pack(p: Prefs) {
  return btoa(JSON.stringify(p));
}

function unpack(raw: string): Prefs | null {
  try {
    const o = JSON.parse(atob(raw)) as Prefs;
    if (!o || typeof o !== 'object') return null;
    return { theme: String(o.theme ?? 'light'), role: String(o.role ?? 'guest') };
  } catch {
    return null;
  }
}

/** Medium: structured cookie prefs — elevate role (safe deser parody). */
export default function PoisonedPrefsChallenge() {
  const { player } = useApp();
  const [prefs, setPrefs] = useState<Prefs>({ theme: 'dark', role: 'guest' });
  const [plaque, setPlaque] = useState('');

  useEffect(() => {
    const raw = readCookie(COOKIE);
    if (!raw) {
      writeCookie(COOKIE, pack({ theme: 'dark', role: 'guest' }));
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const p = unpack(readCookie(COOKIE));
      if (p) setPrefs(p);
    };
    tick();
    const id = window.setInterval(tick, 600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setPlaque('');
    if (prefs.role !== 'admin' || !player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material?.reveal_hex) return;
        const txt = await xorDecryptHex(String(r.material.reveal_hex), 'admin');
        if (alive && looksLikeToken(txt)) setPlaque(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [prefs.role, player]);

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Poisoned Prefs"
      blurb="Theme preferences are stored in a cookie as a small structured object the desk trusts. Reshape that object so the desk believes you hold an admin role — then read the plaque."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          Cookie <code className="text-terminal-amber">{COOKIE}</code> (packed preferences object)
        </p>
        <p className="mt-2">
          Live prefs: theme=<code>{prefs.theme}</code> · role=<code className="text-terminal-amber">{prefs.role}</code>
        </p>
        {plaque ? (
          <p className="mt-3 text-terminal-green">
            Exec token: <code className="font-mono text-terminal-amber">{plaque}</code>
          </p>
        ) : (
          <p className="mt-3 text-xs text-terminal-dim">Admin plaque locked.</p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
