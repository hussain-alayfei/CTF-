import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_gallery_lock';
const ROLE_KEY = 'd10_gallery_role';

/** Medium: find vault route, then elevate role chip. */
export default function GalleryLockChallenge() {
  const loc = useLocation();
  const { player } = useApp();
  const onVault = loc.pathname.endsWith('/vault');
  const [role, setRole] = useState('visitor');
  const [plaque, setPlaque] = useState('');

  useEffect(() => {
    if (!localStorage.getItem(ROLE_KEY)) localStorage.setItem(ROLE_KEY, 'visitor');
    const tick = () => setRole(localStorage.getItem(ROLE_KEY) ?? 'visitor');
    tick();
    const id = window.setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setPlaque('');
    if (!onVault || role !== 'curator' || !player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material?.reveal_hex) return;
        const txt = await xorDecryptHex(String(r.material.reveal_hex), 'curator');
        if (alive && looksLikeToken(txt)) setPlaque(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [onVault, role, player]);

  if (onVault) {
    return (
      <ChallengeFrame
        challengeId={ID}
        title="Gallery Lock"
        blurb="Curator vault. A visitor chip cannot open the note — elevate the role stored in this browser, then reload the vault."
      >
        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
          <p>
            Role chip: <code className="text-terminal-amber">{role}</code>
          </p>
          {plaque ? (
            <p className="mt-3 text-terminal-green">
              Curator note: <code className="font-mono text-terminal-amber">{plaque}</code>
            </p>
          ) : (
            <p className="mt-3 text-xs text-terminal-dim">Vault sealed for your current chip.</p>
          )}
        </div>
        <AnswerBox challengeId={ID} />
      </ChallengeFrame>
    );
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Gallery Lock"
      blurb="The public gallery locked after the curator upload. A quieter vault path still exists under this challenge. Open it, then make your role chip read curator."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p>Public wall: “The Silence of the Woods” — locked.</p>
        <p className="mt-2 text-xs">
          Role chip key in storage: <code className="text-terminal-amber">{ROLE_KEY}</code> (starts as visitor)
        </p>
        <p className="mt-3">
          <Link
            to="/challenge/gallery-lock/vault"
            className="text-terminal-green underline decoration-dotted"
            onClick={() => {
              unlockAudio();
              playClick();
            }}
          >
            try the vault annex
          </Link>
        </p>
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
