import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/app-context';
import { verifyChallengeAnswer } from '@/lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '@/lib/sounds';

// Fragments are written only after the visitor accepts tracking — never in this
// source as a combined answer. Recovery requires inspecting cookie, local storage,
// and IndexedDB in the real browser (Application tab).
const DB_NAME = 'ctf_cache_phantom_v1';
const STORE = 'shards';

function b64(s: string) {
  return btoa(s);
}

async function plantFragments() {
  document.cookie = `_ck=${b64('crum')}; path=/; SameSite=Lax`;
  localStorage.setItem('_ls', 'sbmors'.split('').reverse().join(''));
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put('trail', 'c');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

export default function CachePhantomChallenge() {
  const { player } = useApp();
  const [accepted, setAccepted] = useState(false);
  const [planting, setPlanting] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  useEffect(() => {
    setAccepted(document.cookie.includes('_ck='));
  }, []);

  async function acceptTracking() {
    unlockAudio();
    playClick();
    setPlanting(true);
    try {
      await plantFragments();
      setAccepted(true);
    } finally {
      setPlanting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, 'p5_cache_phantom', answer.trim());
      setResult({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) playCorrect();
      else playWrong();
    } catch {
      setResult({ ok: false, message: 'Verification failed — try again.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-terminal-dim">Log in from the arena first, then reopen this challenge.</p>
        <Link to="/?c=p5_cache_phantom" className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted">
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/?c=p5_cache_phantom" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">👻 Cache Phantom</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          A marketing site wrote tracking residue across three browser stores after consent. Nothing is shown on
          this page — recover every shard from your own session state and rebuild the label.
        </p>

        {!accepted ? (
          <button
            type="button"
            onClick={acceptTracking}
            disabled={planting}
            className="mt-5 rounded-lg border border-terminal-amber bg-terminal-amber/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-50"
          >
            {planting ? 'Planting…' : 'Accept all tracking'}
          </button>
        ) : (
          <p className="mt-4 text-xs text-terminal-cyan">
            Tracking enabled — shards are in your browser now. Inspect every store this origin can write to.
          </p>
        )}

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="recovered label"
            disabled={busy}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green outline-none focus:border-terminal-green focus:shadow-neon disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20 disabled:opacity-50"
          >
            {busy ? '…' : 'Verify ▸'}
          </button>
        </form>

        {result?.ok && result.flag && (
          <div className="mt-6 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Correct</div>
            <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
              {result.flag}
            </code>
            <p className="mt-3 text-xs text-terminal-dim">Paste it into the arena flag box to score.</p>
          </div>
        )}
        {result && !result.ok && (
          <div className="mt-6 rounded-lg border border-terminal-red/50 bg-terminal-red/10 p-4 text-center text-sm text-terminal-red">
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
