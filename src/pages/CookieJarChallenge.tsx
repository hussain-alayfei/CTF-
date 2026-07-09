import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { fetchChallengeLiveMaterial, verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';
import { looksLikeToken, xorDecryptHex } from '../lib/dayfive';

const CHALLENGE_ID = 'p5_cookie_jar';

// The dossier unlocks only for this exact cookie posture. The key that decrypts
// the dossier text is derived from the posture itself, so the plaintext answer
// never ships in this bundle nor in the RPC response — only a browser holding
// the right cookies can produce it.
const NEED_TIER = 'member';
const NEED_CONSENT = 'revoked';
function keySeed() {
  return `${NEED_TIER}|${NEED_CONSENT}`;
}

function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export default function CookieJarChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [tier, setTier] = useState('');
  const [consent, setConsent] = useState('');
  const [revealed, setRevealed] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  // Seed a default "guest" posture so the cookies exist for the student to find
  // and edit in the Application tab. Never overwrites edits the student made.
  useEffect(() => {
    if (!readCookie('cw_tier')) document.cookie = 'cw_tier=guest; path=/; SameSite=Lax';
    if (!readCookie('cw_consent')) document.cookie = 'cw_consent=granted; path=/; SameSite=Lax';
  }, []);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, CHALLENGE_ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    const tick = () => {
      setTier(readCookie('cw_tier'));
      setConsent(readCookie('cw_consent'));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const unlocked = tier === NEED_TIER && consent === NEED_CONSENT;

  useEffect(() => {
    let alive = true;
    if (!unlocked || !revealHex) {
      setRevealed('');
      return;
    }
    xorDecryptHex(revealHex, keySeed())
      .then((txt) => {
        if (alive && looksLikeToken(txt)) setRevealed(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [unlocked, revealHex]);

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
        <h1 className="text-2xl font-extrabold text-terminal-green">🍪 Cookie Jar</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          This data-broker portal decides what it shows you purely from cookies it set on your own machine — it never
          re-checks with its server. Members who have withdrawn consent may view their full dossier. You are neither.
          Fix that, on your side, and reload.
        </p>

        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 font-mono text-xs">
          <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-dim">Account state (from your cookies)</div>
          <div className="mt-2 flex justify-between">
            <span className="text-terminal-dim">membership tier</span>
            <span className={tier === NEED_TIER ? 'text-terminal-green' : 'text-terminal-amber'}>{tier || '—'}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-terminal-dim">tracking consent</span>
            <span className={consent === NEED_CONSENT ? 'text-terminal-green' : 'text-terminal-amber'}>{consent || '—'}</span>
          </div>
        </div>

        {unlocked && revealed ? (
          <div className="mt-4 animate-pop rounded-lg border border-terminal-green/50 bg-terminal-green/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-terminal-green">Full dossier — recovery tag</div>
            <div className="mt-1 select-all break-all font-mono text-lg text-terminal-green">{revealed}</div>
            <p className="mt-1 text-xs text-terminal-dim">Submit this tag below to claim your flag.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-terminal-amber/40 bg-terminal-amber/5 p-4 text-xs text-terminal-amber">
            🔒 Dossier restricted. It is released only to the correct account state — and it is never sent to your
            browser until your cookies say so.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="recovery tag"
            disabled={busy}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green outline-none focus:border-terminal-green disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20 disabled:opacity-40"
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
