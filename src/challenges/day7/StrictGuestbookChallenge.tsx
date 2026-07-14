import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayseven';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_strict_book';
const VAULT_SEED = 'strict-vault';

declare global {
  interface Window {
    __D7_STRICT?: string;
  }
}

function scrub(input: string) {
  // Stricter than the old guestbook: strips script/javascript and the most
  // common event hook names. Animation / pointer hooks are intentionally not
  // all covered — that is the gap.
  return input
    .replace(/script/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\son(?:error|load|click|focus|mouseover|mouseenter|toggle|submit|change|input|blur|keydown|keyup|keypress)\s*=/gi, ' data-blocked=');
}

export default function StrictGuestbookChallenge() {
  const { player } = useApp();
  const [note, setNote] = useState('hello desk');
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!player) return;
    let alive = true;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!alive || !r.ok || !r.material) return;
        const hex = String(r.material.reveal_hex ?? '');
        if (!hex) return;
        const txt = await xorDecryptHex(hex, VAULT_SEED);
        if (alive && looksLikeToken(txt)) window.__D7_STRICT = txt;
      })
      .catch(() => {});
    return () => {
      alive = false;
      delete window.__D7_STRICT;
    };
  }, [player]);

  function preview(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    playClick();
    setHtml(scrub(note));
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Strict Guestbook"
      blurb="This guestbook prints visitor notes back onto the page, but the scrubber is stricter than the last one the floor used. Something valuable sits in page memory — make the guestbook read it without using the obvious hooks the scrubber already knows."
    >
      <form onSubmit={preview} className="mt-4 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
        />
        <button
          type="submit"
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan"
        >
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
