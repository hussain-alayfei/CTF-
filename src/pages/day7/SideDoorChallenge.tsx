import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_side_door';
const COOKIE = 'd7_desk_visit';

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export default function SideDoorChallenge() {
  const loc = useLocation();
  const onHatch = loc.pathname.endsWith('/hatch');

  useEffect(() => {
    if (!onHatch && !readCookie(COOKIE)) {
      document.cookie = `${COOKIE}=1; path=/; SameSite=Lax`;
    }
  }, [onHatch]);

  if (onHatch) {
    const allowed = readCookie(COOKIE) === '1';
    return (
      <ChallengeFrame
        challengeId={ID}
        title="Side Door"
        blurb="You found the hatch. Whether it opens depends on whether the front desk already marked your visit."
      >
        {allowed ? (
          <div className="mt-4 rounded-lg border border-terminal-green/40 bg-terminal-green/10 p-4">
            <p className="text-sm text-terminal-dim">Hatch unlocked. Recovery:</p>
            <code className="mt-2 block font-mono text-lg text-terminal-green">service_hatch</code>
          </div>
        ) : (
          <p className="mt-4 text-sm text-terminal-red">
            No visit mark on this browser. Start from the front desk page first, then come back here.
          </p>
        )}
        <AnswerBox challengeId={ID} />
      </ChallengeFrame>
    );
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Side Door"
      blurb="Every public lobby has a door the directory does not list. Take a look around this desk — then try the path the map forgot. You must pass through the lobby in this browser before the hatch will open."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p>Front desk lobby.</p>
        <p className="mt-2">
          Public links:{' '}
          <button
            type="button"
            className="underline decoration-dotted"
            onClick={() => {
              unlockAudio();
              playClick();
            }}
          >
            queue status
          </button>
          {' · '}
          <span className="opacity-50">staff directory (offline)</span>
        </p>
      </div>
      <div className="mt-2 text-xs text-terminal-dim">
        <Link to="/challenge/side-door" className="underline decoration-dotted">
          refresh lobby
        </Link>
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
