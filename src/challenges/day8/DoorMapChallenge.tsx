import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';

const ID = 'd8_door_map';

function Lobby() {
  return (
    <ChallengeFrame
      challengeId={ID}
      title="Door Map"
      blurb="Public lobby only. Staff doors are not on the menu. Walk carefully — crawlers are told about doors people usually miss."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p>Welcome to the campus desk lobby.</p>
        <ul className="list-disc pl-5">
          <li>Hours · 09:00–17:00</li>
          <li>Lost &amp; found · Front counter</li>
          <li>
            Crawler notice ·{' '}
            <a className="text-terminal-cyan underline" href="/challenges/day8/robots.txt" target="_blank" rel="noreferrer">
              robots.txt
            </a>
          </li>
        </ul>
        <p className="text-xs opacity-70">No staff links here on purpose.</p>
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}

function StaffCloset() {
  const { player } = useApp();
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material) return;
        const hex = String(r.material.reveal_hex ?? '');
        const txt = await xorDecryptHex(hex, 'staff');
        if (looksLikeToken(txt)) setLabel(txt);
      })
      .catch(() => {});
  }, [player]);

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Staff Closet"
      blurb="You found a door the menu never listed."
    >
      <div className="mt-4 rounded-lg border border-terminal-green/40 bg-terminal-green/10 p-4 text-sm text-terminal-green">
        {label ? (
          <>
            Door label: <code className="font-mono text-terminal-amber">{label}</code>
          </>
        ) : (
          'Unlocking label…'
        )}
      </div>
      <p className="mt-3 text-xs text-terminal-dim">
        <Link to="/challenge/door-map" className="underline decoration-dotted">
          ‹ lobby
        </Link>
      </p>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}

export default function DoorMapChallenge() {
  const loc = useLocation();
  const isCloset = loc.pathname.endsWith('/staff-closet');
  return isCloset ? <StaffCloset /> : <Lobby />;
}
