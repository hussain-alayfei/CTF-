import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { queryAnonDb, verifyChallengeAnswer, verifyReident } from '../lib/api';
import type { QueryAnonResult } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

const CHALLENGE_ID = 'p5_reidentified';

// Public voter roll — "freely available" data that is safe on its own.
// The anonymized hospital data is NOT here; it lives only inside the
// query_anon_db RPC and never reaches the client. That separation is the
// whole point of this challenge: combining two safe-looking datasets
// re-identifies a real person.
const PUBLIC_ROLL = [
  { id: 'V-1001', name: 'David Cohen',   age: 34, zip: '11201', gender: 'M' },
  { id: 'V-1002', name: 'Marcus Lee',    age: 34, zip: '11201', gender: 'M' },
  { id: 'V-1010', name: 'Sara Weiss',    age: 41, zip: '11205', gender: 'F' },
  { id: 'V-1011', name: 'Rina Adler',    age: 41, zip: '11205', gender: 'F' },
  { id: 'V-1020', name: 'Yuki Tan',      age: 27, zip: '11201', gender: 'F' },
  { id: 'V-1021', name: 'Mona Diallo',   age: 27, zip: '11201', gender: 'F' },
  { id: 'V-2050', name: 'Nadia Osman',   age: 29, zip: '11215', gender: 'F' },
  { id: 'V-1030', name: 'Omar Farid',    age: 52, zip: '11205', gender: 'M' },
  { id: 'V-1031', name: 'Paul Genovese', age: 52, zip: '11205', gender: 'M' },
  { id: 'V-1040', name: 'Ken Ito',       age: 34, zip: '11215', gender: 'M' },
  { id: 'V-1041', name: 'Leo Marsh',     age: 34, zip: '11215', gender: 'M' },
  { id: 'V-1050', name: 'Aisha Rahman',  age: 45, zip: '11201', gender: 'F' },
  { id: 'V-1051', name: 'Tara Nyx',      age: 45, zip: '11201', gender: 'F' },
  { id: 'V-1060', name: 'Sam Park',      age: 27, zip: '11205', gender: 'M' },
  { id: 'V-1061', name: 'Rex Hollis',    age: 27, zip: '11205', gender: 'M' },
];

type HistoryEntry = {
  id: number;
  age: string; zip: string; gender: string;
  result: QueryAnonResult;
};

export default function ReidentifiedChallenge() {
  const { player } = useApp();

  // Query form
  const [ageInput, setAgeInput] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [genderInput, setGenderInput] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryErr, setQueryErr] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyId, setHistoryId] = useState(0);

  // When a unique match is found
  const [found, setFound] = useState<{ anon_id: string; condition: string } | null>(null);

  // Final submission
  const [anonId, setAnonId] = useState('');
  const [publicId, setPublicId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);

  // Public roll filter
  const [rollFilter, setRollFilter] = useState('');
  const rf = rollFilter.trim().toLowerCase();
  const filteredRoll = PUBLIC_ROLL.filter((r) =>
    !rf || `${r.id} ${r.name} ${r.age} ${r.zip} ${r.gender}`.toLowerCase().includes(rf),
  );

  const remaining = history.length > 0 ? history[0].result.remaining : undefined;

  async function runQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!player || querying) return;
    const age = ageInput.trim() ? parseInt(ageInput.trim(), 10) : null;
    const zip = zipInput.trim() || null;
    const gender = genderInput.trim() || null;
    if (age === null && zip === null && gender === null) {
      setQueryErr('Specify at least one filter — querying with no filters returns the full count, not useful.');
      return;
    }
    unlockAudio();
    playClick();
    setQuerying(true);
    setQueryErr('');
    try {
      const r = await queryAnonDb(player, age, zip, gender);
      const entry: HistoryEntry = {
        id: historyId,
        age: ageInput.trim() || '—',
        zip: zipInput.trim() || '—',
        gender: genderInput.trim() || '—',
        result: r,
      };
      setHistoryId((n) => n + 1);
      setHistory((prev) => [entry, ...prev].slice(0, 20));
      if (r.ok && r.count === 1 && r.anon_id) {
        setFound({ anon_id: r.anon_id, condition: r.condition ?? '?' });
        setAnonId(r.anon_id);
      }
      if (!r.ok) setQueryErr(r.message ?? 'Query failed.');
    } catch (err) {
      setQueryErr(err instanceof Error ? err.message : 'Query failed.');
    } finally {
      setQuerying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!anonId.trim() || !publicId.trim() || submitting || !player) return;
    unlockAudio();
    playClick();
    setSubmitting(true);
    setResult(null);
    try {
      const link = await verifyReident(player, anonId.trim(), publicId.trim());
      if (!link.ok || !link.token) {
        setResult({ ok: false, message: link.message ?? 'No unique linkage for that pair.' });
        playWrong();
        return;
      }
      const r = await verifyChallengeAnswer(player, CHALLENGE_ID, link.token);
      setResult({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) playCorrect();
      else playWrong();
    } catch {
      setResult({ ok: false, message: 'Verification failed — try again.' });
      playWrong();
    } finally {
      setSubmitting(false);
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to={`/?c=${CHALLENGE_ID}`} className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the challenge
      </Link>

      <div className="mt-4 space-y-6">
        {/* Scenario */}
        <div className="rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
          <h1 className="text-2xl font-extrabold text-terminal-green">☠ Re-Identified</h1>
          <p className="mt-2 text-sm text-terminal-dim leading-relaxed">
            A hospital published an "anonymised" patient dataset — names stripped, but age, zip code
            and gender kept. A public voter roll lists real names with those same three details. Most
            patients are safe because they share their exact combination with at least one other person
            (plausible deniability). Exactly one patient does not.
          </p>
          <p className="mt-2 text-sm text-terminal-dim leading-relaxed">
            Use the query tool below to probe the anonymised database. You get back a count only — no
            names, no records. When you find a combination where the count is&nbsp;1, you've found the
            k-anonymity failure. Cross-reference that with the public roll to name the person.
          </p>
          {remaining !== undefined && (
            <div className="mt-3 text-xs text-terminal-amber">
              Query budget: <span className="font-bold">{remaining}</span> / 40 remaining
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Query interface */}
          <div className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-terminal-cyan">
              ▸ Query the anonymised database
            </h2>
            <p className="mb-4 text-xs text-terminal-dim">
              Leave a field blank to not filter on it. Results show counts only.
            </p>
            <form onSubmit={runQuery} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col text-xs text-terminal-dim">
                  Age
                  <input
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value)}
                    placeholder="e.g. 34"
                    type="number"
                    min="0"
                    max="120"
                    disabled={querying}
                    className="mt-1 rounded border border-terminal-border bg-terminal-input px-2 py-1.5 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
                  />
                </label>
                <label className="flex flex-col text-xs text-terminal-dim">
                  ZIP code
                  <input
                    value={zipInput}
                    onChange={(e) => setZipInput(e.target.value)}
                    placeholder="e.g. 11215"
                    disabled={querying}
                    className="mt-1 rounded border border-terminal-border bg-terminal-input px-2 py-1.5 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
                  />
                </label>
                <label className="flex flex-col text-xs text-terminal-dim">
                  Gender
                  <select
                    value={genderInput}
                    onChange={(e) => setGenderInput(e.target.value)}
                    disabled={querying}
                    className="mt-1 rounded border border-terminal-border bg-terminal-input px-2 py-1.5 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
                  >
                    <option value="">Any</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </label>
              </div>
              {queryErr && <p className="text-xs text-terminal-red">{queryErr}</p>}
              <button
                type="submit"
                disabled={querying}
                className="w-full rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 py-2 text-sm font-bold uppercase tracking-widest text-terminal-cyan transition hover:bg-terminal-cyan/20 disabled:opacity-50"
              >
                {querying ? 'Querying…' : 'Run query ▸'}
              </button>
            </form>

            {/* Query history */}
            {history.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-terminal-dim">Query history</div>
                {history.map((h) => (
                  <div
                    key={h.id}
                    className={`flex items-center gap-2 rounded border px-3 py-2 font-mono text-xs ${
                      h.result.ok && h.result.count === 1
                        ? 'border-terminal-green/60 bg-terminal-green/10 text-terminal-green'
                        : h.result.ok
                          ? 'border-terminal-border bg-terminal-input/30 text-terminal-dim'
                          : 'border-terminal-red/40 bg-terminal-red/5 text-terminal-red'
                    }`}
                  >
                    <span className="shrink-0 text-terminal-dim">
                      age={h.age} zip={h.zip} gender={h.gender}
                    </span>
                    <span className="ml-auto shrink-0 font-bold">
                      {h.result.ok
                        ? h.result.count === 1
                          ? '✓ COUNT = 1 — unique!'
                          : `count = ${h.result.count}`
                        : h.result.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public roll */}
          <div className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-terminal-cyan">
              ▸ Public voter roll
            </h2>
            <p className="mb-3 text-xs text-terminal-dim">
              Freely available public data — names included.
            </p>
            <input
              value={rollFilter}
              onChange={(e) => setRollFilter(e.target.value)}
              placeholder="filter…"
              className="mb-3 w-full rounded border border-terminal-border bg-terminal-input px-3 py-1.5 font-mono text-xs text-terminal-green outline-none focus:border-terminal-green"
            />
            <div className="max-h-96 overflow-auto rounded border border-terminal-border">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-terminal-panel text-terminal-dim">
                  <tr>
                    <th className="px-2 py-1.5 text-left">ID</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Age</th>
                    <th className="px-2 py-1.5 text-left">ZIP</th>
                    <th className="px-2 py-1.5 text-left">Sex</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoll.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-terminal-border/50 text-terminal-green/90"
                    >
                      <td className="px-2 py-1">{r.id}</td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1">{r.age}</td>
                      <td className="px-2 py-1">{r.zip}</td>
                      <td className="px-2 py-1">{r.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Exposed record — only shown once count=1 is reached via the query tool */}
        {found && (
          <div className="animate-pop rounded-xl border border-terminal-green/60 bg-terminal-green/5 p-5">
            <div className="text-xs font-bold uppercase tracking-widest text-terminal-green">
              ✓ Unique record found via query
            </div>
            <div className="mt-2 font-mono text-sm text-terminal-green">
              Anonymised ID: <span className="font-bold">{found.anon_id}</span>
              {' · '}Condition: <span className="font-bold">{found.condition}</span>
            </div>
            <p className="mt-2 text-xs text-terminal-dim">
              Now cross-reference this person's demographics with the public roll to name them, then submit below.
            </p>
          </div>
        )}

        {/* Final confirmation */}
        <div className="rounded-xl border border-terminal-border bg-terminal-panel p-5">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-terminal-cyan">
            ▸ Confirm the linkage
          </h2>
          <p className="mb-4 text-xs text-terminal-dim">
            Submit the anonymised ID (from your query results) and the public roll ID you matched it to.
            The server confirms the unique linkage and releases your flag.
          </p>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-terminal-dim">
              Anonymised ID
              <input
                value={anonId}
                onChange={(e) => setAnonId(e.target.value)}
                placeholder="A-…"
                disabled={submitting}
                className="mt-1 w-32 rounded border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col text-xs text-terminal-dim">
              Public roll ID
              <input
                value={publicId}
                onChange={(e) => setPublicId(e.target.value)}
                placeholder="V-…"
                disabled={submitting}
                className="mt-1 w-32 rounded border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green disabled:opacity-50"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-2.5 font-bold uppercase tracking-widest text-terminal-green hover:bg-terminal-green/20 disabled:opacity-50"
            >
              {submitting ? '…' : 'Confirm linkage ▸'}
            </button>
          </form>

          {result?.ok && result.flag && (
            <div className="mt-5 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
              <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
                {result.flag}
              </code>
              <p className="mt-3 text-xs text-terminal-dim">Paste it into the arena flag box to score.</p>
            </div>
          )}
          {result && !result.ok && (
            <div className="mt-4 rounded-lg border border-terminal-red/50 bg-terminal-red/10 p-4 text-sm text-terminal-red">
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
