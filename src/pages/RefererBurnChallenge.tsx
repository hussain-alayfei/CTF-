import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { fetchChallengeLiveMaterial, verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

const CHALLENGE_ID = 'p5_referer_burn';

// The leaked identifier fragments come from the server (challenge_live_material)
// and are only ever placed into OUTBOUND tracking-pixel requests — never
// rendered on this page. The only way to read them is to watch the network
// requests this page fires. Nothing submittable exists in this bundle.
type Frags = { p1: string; p2: string; p3: string };

export default function RefererBurnChallenge() {
  const { player } = useApp();
  const [frags, setFrags] = useState<Frags | null>(null);
  const [shared, setShared] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, CHALLENGE_ID)
      .then((r) => {
        if (r.ok && r.material) {
          setFrags({
            p1: String(r.material.p1 ?? ''),
            p2: String(r.material.p2 ?? ''),
            p3: String(r.material.p3 ?? ''),
          });
        }
      })
      .catch(() => {});
  }, [player]);

  // Fire the tracking pixels. These are deliberately real requests so they show
  // up in the Network panel with their query strings; the endpoints don't need
  // to exist (a failed request still appears with its full URL).
  function share() {
    if (!frags) return;
    unlockAudio();
    playClick();
    const beacon = (seq: number, seg: string) => {
      const url = `/collect/partner-pixel?campaign=news_share&seq=${seq}&seg=${encodeURIComponent(seg)}`;
      fetch(url, { cache: 'no-store' }).catch(() => {});
    };
    // Fired out of order on purpose — the seq param, not the call order, is the truth.
    beacon(2, frags.p2);
    beacon(1, frags.p1);
    beacon(3, frags.p3);
    setShared(true);
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
        <h1 className="text-2xl font-extrabold text-terminal-green">🔗 Referer Burn</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          This "free" news page quietly hands your reading identity to its advertising partners the moment you share
          an article. It brags nothing on screen — but the partners hear plenty. Watch exactly what leaves your
          browser, then rebuild the identifier the partners just learned.
        </p>

        <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
          <div className="text-sm font-bold text-terminal-green">Breaking: City Council Approves New Data Bylaw</div>
          <p className="mt-1 text-xs text-terminal-dim">
            An in-depth report on what the new rules mean for residents… (sample article)
          </p>
          <button
            type="button"
            onClick={share}
            className="mt-3 rounded-lg border border-terminal-amber bg-terminal-amber/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-terminal-amber transition hover:bg-terminal-amber/20"
          >
            Share to partners
          </button>
          {shared && (
            <p className="mt-3 text-xs text-terminal-cyan">
              Shared. Three partner pixels just fired from your browser — nothing was shown to you. Inspect the
              outbound requests to see what each one carried, then order the pieces.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="reconstructed identifier"
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
