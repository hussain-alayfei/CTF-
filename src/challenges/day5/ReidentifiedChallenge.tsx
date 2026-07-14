import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/app-context';
import { verifyChallengeAnswer, verifyReident } from '@/lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '@/lib/sounds';
import { ANON_EXPORT, PUBLIC_ROLL } from './reidentData';

const CHALLENGE_ID = 'p5_reidentified';

export default function ReidentifiedChallenge() {
  const { player } = useApp();
  const [anonId, setAnonId] = useState('');
  const [publicId, setPublicId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  const q = query.trim().toLowerCase();
  const anonRows = useMemo(
    () =>
      ANON_EXPORT.filter(
        (r) => !q || `${r.anon_id} ${r.age} ${r.zip} ${r.gender} ${r.condition}`.toLowerCase().includes(q),
      ),
    [q],
  );
  const publicRows = useMemo(
    () => PUBLIC_ROLL.filter((r) => !q || `${r.public_id} ${r.name} ${r.age} ${r.zip} ${r.gender}`.toLowerCase().includes(q)),
    [q],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!anonId.trim() || !publicId.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    setResult(null);
    try {
      // Step 1: the server confirms this is the one unique linkage and only then
      // hands back the recovery token.
      const link = await verifyReident(player, anonId.trim(), publicId.trim());
      if (!link.ok || !link.token) {
        setResult({ ok: false, message: link.message ?? 'No unique linkage for that pair.' });
        playWrong();
        return;
      }
      // Step 2: exchange the token for the personal flag through the normal path.
      const r = await verifyChallengeAnswer(player, CHALLENGE_ID, link.token);
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to={`/?c=${CHALLENGE_ID}`} className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🎯 Re-Identified</h1>
        <p className="mt-2 text-sm text-terminal-dim">
          A hospital published an "anonymised" discharge release — names stripped, but age, postal code and gender
          kept. A public voter roll lists real names with the same three details. Most patients hide safely in a
          crowd who share their exact details. Exactly one does not. Find the single patient who can be re-identified
          with certainty, link them to their real identity, and submit the pair. The system will only confirm the one
          truly unique match.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter both tables (e.g. 11215, or F, or 29)…"
          className="mt-4 w-full rounded-lg border border-terminal-border bg-terminal-input px-4 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-terminal-border bg-terminal-input/20 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">
              Anonymised release ({anonRows.length})
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="text-terminal-dim">
                  <tr>
                    <th className="px-1 py-1 text-left">anon_id</th>
                    <th className="px-1 py-1 text-left">age</th>
                    <th className="px-1 py-1 text-left">zip</th>
                    <th className="px-1 py-1 text-left">sex</th>
                    <th className="px-1 py-1 text-left">condition</th>
                  </tr>
                </thead>
                <tbody className="text-terminal-green/90">
                  {anonRows.map((r) => (
                    <tr key={r.anon_id} className="border-t border-terminal-border/50">
                      <td className="px-1 py-1">{r.anon_id}</td>
                      <td className="px-1 py-1">{r.age}</td>
                      <td className="px-1 py-1">{r.zip}</td>
                      <td className="px-1 py-1">{r.gender}</td>
                      <td className="px-1 py-1">{r.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-terminal-border bg-terminal-input/20 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-terminal-cyan">
              Public voter roll ({publicRows.length})
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="text-terminal-dim">
                  <tr>
                    <th className="px-1 py-1 text-left">public_id</th>
                    <th className="px-1 py-1 text-left">name</th>
                    <th className="px-1 py-1 text-left">age</th>
                    <th className="px-1 py-1 text-left">zip</th>
                    <th className="px-1 py-1 text-left">sex</th>
                  </tr>
                </thead>
                <tbody className="text-terminal-green/90">
                  {publicRows.map((r) => (
                    <tr key={r.public_id} className="border-t border-terminal-border/50">
                      <td className="px-1 py-1">{r.public_id}</td>
                      <td className="px-1 py-1">{r.name}</td>
                      <td className="px-1 py-1">{r.age}</td>
                      <td className="px-1 py-1">{r.zip}</td>
                      <td className="px-1 py-1">{r.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-terminal-dim">
            anonymised id
            <input
              value={anonId}
              onChange={(e) => setAnonId(e.target.value)}
              placeholder="A-…"
              disabled={busy}
              className="mt-1 w-32 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col text-xs text-terminal-dim">
            public id
            <input
              value={publicId}
              onChange={(e) => setPublicId(e.target.value)}
              placeholder="V-…"
              disabled={busy}
              className="mt-1 w-32 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-2.5 font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20 disabled:opacity-50"
          >
            {busy ? '…' : 'Confirm linkage ▸'}
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
