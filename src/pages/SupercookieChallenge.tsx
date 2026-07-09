import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { fetchChallengeLiveMaterial, verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

const CHALLENGE_ID = 'p5_supercookie';
const IDB_NAME = 'ctf_supercookie_v1';
const IDB_STORE = 'vault';
const CACHE_NAME = 'ctf-sc-v1';

// Fragments are fetched from the server and scattered across five storage
// vectors — never concatenated in this source. Recovery requires reading each
// vector by hand in the Application/Storage panel and ordering by the stated
// persistence sequence.
type Segs = {
  seg_cookie: string;
  seg_local: string;
  seg_session: string;
  seg_idb: string;
  seg_cache: string;
};

async function plant(segs: Segs) {
  document.cookie = `sc_id=${segs.seg_cookie}; path=/; SameSite=Lax`;
  localStorage.setItem('sc_id', segs.seg_local);
  sessionStorage.setItem('sc_id', segs.seg_session);

  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(segs.seg_idb, 'seg');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });

  if ('caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(new Request('/sc/segment'), new Response(segs.seg_cache));
  }
}

export default function SupercookieChallenge() {
  const { player } = useApp();
  const [segs, setSegs] = useState<Segs | null>(null);
  const [planted, setPlanted] = useState(false);
  const [working, setWorking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, CHALLENGE_ID)
      .then((r) => {
        if (r.ok && r.material) {
          setSegs({
            seg_cookie: String(r.material.seg_cookie ?? ''),
            seg_local: String(r.material.seg_local ?? ''),
            seg_session: String(r.material.seg_session ?? ''),
            seg_idb: String(r.material.seg_idb ?? ''),
            seg_cache: String(r.material.seg_cache ?? ''),
          });
        }
      })
      .catch(() => {});
  }, [player]);

  async function trackMe() {
    if (!segs) return;
    unlockAudio();
    playClick();
    setWorking(true);
    try {
      await plant(segs);
      setPlanted(true);
    } finally {
      setWorking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await verifyChallengeAnswer(player, CHALLENGE_ID, answer.trim());
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
        <Link to={`/?c=${CHALLENGE_ID}`} className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted">
          ‹ back to the challenge
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to={`/?c=${CHALLENGE_ID}`} className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🧟 Supercookie</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          A tracker that refuses to die: it copies your visitor id into every corner of the browser it can reach, so
          clearing one place never forgets you. Let it tag you, then prove it really scattered your id by rebuilding
          it from every hiding place.
        </p>

        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-xs text-terminal-dim">
          It persists your id across these vectors, in this exact order:
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-terminal-green/90">
            <li>a cookie</li>
            <li>local storage</li>
            <li>session storage</li>
            <li>an IndexedDB record</li>
            <li>the Cache Storage API</li>
          </ol>
          Read each fragment from its store, then join them in that order.
        </div>

        {!planted ? (
          <button
            type="button"
            onClick={trackMe}
            disabled={working || !segs}
            className="mt-4 rounded-lg border border-terminal-amber bg-terminal-amber/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20 disabled:opacity-50"
          >
            {working ? 'Tagging…' : 'Let the tracker tag me'}
          </button>
        ) : (
          <p className="mt-4 text-xs text-terminal-cyan">
            Tagged. Your id now lives in all five vectors — go dig every fragment out and reassemble it.
          </p>
        )}

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="reassembled visitor id"
            disabled={busy}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
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
