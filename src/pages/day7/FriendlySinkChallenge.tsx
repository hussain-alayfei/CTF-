import { useEffect, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_friendly_sink';

declare global {
  interface Window {
    __D7_VAULT?: string;
  }
}

function sanitize(input: string) {
  // Naive filter — blocks the obvious tag name and a common URI scheme, nothing else.
  return input.replace(/script/gi, '').replace(/javascript:/gi, '');
}

export default function FriendlySinkChallenge() {
  const { player } = useApp();
  const [note, setNote] = useState('hello desk');
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) {
          window.__D7_VAULT = String(r.material.vault ?? '');
        }
      })
      .catch(() => {});
    return () => {
      delete window.__D7_VAULT;
    };
  }, [player]);

  function preview(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    playClick();
    setHtml(sanitize(note));
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Friendly Sink"
      blurb="This guestbook prints whatever you type back onto the page. The desk tried to scrub dangerous words and failed in the usual ways. Something valuable sits in the page’s memory — make the guestbook read it for you."
    >
      <form onSubmit={preview} className="mt-4 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
        />
        <button type="submit" className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan">
          Post note
        </button>
      </form>
      <div className="mt-4 rounded-lg border border-dashed border-terminal-border p-3 text-sm text-terminal-dim">
        <p className="mb-2 text-xs uppercase tracking-widest">Live preview</p>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
