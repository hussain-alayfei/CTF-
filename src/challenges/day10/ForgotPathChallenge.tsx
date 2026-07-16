import { Link, useLocation } from 'react-router-dom';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';

const ID = 'd10_forgot_path';

/** Easy: leftover public backup folder on a fake server map. */
export default function ForgotPathChallenge() {
  const loc = useLocation();
  const onTemp = loc.pathname.includes('/assets/backups/temp');

  if (onTemp) {
    return (
      <ChallengeFrame
        challengeId={ID}
        title="Forgot-Me-Not"
        blurb="You reached the leftover backup folder the map still lists. Read the developer note."
      >
        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 font-mono text-sm">
          <p className="text-terminal-dim">Index of /assets/backups/temp/</p>
          <ul className="mt-2 space-y-1 text-terminal-green">
            <li>programmer_notes.log</li>
            <li>avatar_001.bin</li>
          </ul>
          <pre className="mt-4 whitespace-pre-wrap text-xs text-terminal-amber">
            {`# programmer_notes.log
TODO: scrub this folder before prod.
recovery mark for desk drill: backup_temp_note
`}
          </pre>
        </div>
        <AnswerBox challengeId={ID} />
      </ChallengeFrame>
    );
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Forgot-Me-Not"
      blurb="NovaTech left a raw server layout note in the open. The tree still points at a temporary backup folder nobody locked down. Open that folder in this lab and recover the developer mark."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 font-mono text-xs text-terminal-dim">
        <p className="mb-2 font-bold text-terminal-green">server_structure.txt</p>
        <pre className="whitespace-pre-wrap">{`/
├── index.html
├── assets/
│   ├── css/
│   ├── img/
│   └── backups/
│       └── temp/          ← leftover debug tree
├── api/
└── robots.txt
`}</pre>
        <p className="mt-3">
          Try the leftover path on this same challenge URL:{' '}
          <Link
            to="/challenge/forgot-path/assets/backups/temp/"
            className="text-terminal-amber underline decoration-dotted"
          >
            …/assets/backups/temp/
          </Link>
        </p>
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
