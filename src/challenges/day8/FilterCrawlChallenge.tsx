import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_filter_crawl';
const ROOT = '/var/brochure/';
const SEALED = '/var/sealed/note.txt';

/** Stacked filters — each removes one class of lie. */
function resolvePath(input: string): { ok: boolean; path: string; reason?: string } {
  let p = input.trim();
  // Filter A: reject absolute paths
  if (p.startsWith('/') || p.startsWith('\\')) {
    return { ok: false, path: p, reason: 'absolute paths blocked' };
  }
  // Filter B: strip the first ../ only (non-recursive)
  p = p.replace(/\.\.\//, '');
  let joined = (ROOT + p).replace(/\\/g, '/');
  // Normalize remaining parent segments
  let guard = 0;
  while (joined.includes('/../') && guard++ < 20) {
    const next = joined.replace(/\/[^/]+\/\.\.\//, '/');
    if (next === joined) break;
    joined = next;
  }
  joined = joined.replace(/\/\.\//g, '/').replace(/\/+/g, '/');
  // Filter C: extension
  if (!joined.endsWith('.txt')) {
    return { ok: false, path: joined, reason: 'extension must be .txt' };
  }
  // Filter D: must land exactly on the sealed note (outside brochure root)
  if (joined === SEALED) {
    return { ok: true, path: SEALED };
  }
  if (joined.startsWith(ROOT)) {
    return { ok: false, path: joined, reason: 'still inside brochure folder' };
  }
  return { ok: false, path: joined, reason: 'path not allowed' };
}

export default function FilterCrawlChallenge() {
  const { player } = useApp();
  const [file, setFile] = useState('welcome.txt');
  const [msg, setMsg] = useState('');
  const [body, setBody] = useState('');

  async function openFile() {
    unlockAudio();
    playClick();
    setBody('');
    const r = resolvePath(file);
    if (!r.ok) {
      setMsg(`Blocked · ${r.reason} · resolved ${r.path}`);
      return;
    }
    setMsg(`Opened ${r.path}`);
    if (!player) return;
    try {
      const mat = await fetchChallengeLiveMaterial(player, ID);
      if (!mat.ok || !mat.material) return;
      const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), '../');
      if (looksLikeToken(txt)) setBody(txt);
    } catch {
      setMsg('Read error');
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Filter Crawl"
      blurb="A brochure viewer loads files from a folder. Simple traversal is blocked. Absolute paths are blocked. One layer strips ../ only once. Another cares about the ending. Read the sealed note outside the brochure folder."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-xs text-terminal-dim">Viewer root: {ROOT}</p>
        <input
          value={file}
          onChange={(e) => setFile(e.target.value)}
          className="w-full rounded border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-xs text-terminal-green"
        />
        <button
          type="button"
          onClick={() => void openFile()}
          className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
        >
          Open brochure file
        </button>
        {msg && <p className="text-xs text-terminal-amber">{msg}</p>}
        {body && (
          <p className="text-sm text-terminal-green">
            Sealed note: <code className="font-mono text-terminal-amber">{body}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
