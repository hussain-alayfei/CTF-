import { useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { d7BlindLookup } from '../../lib/api';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_blind_lookup';

export default function QuietDirectoryChallenge() {
  const { player } = useApp();
  const [query, setQuery] = useState('admin');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    try {
      const r = await d7BlindLookup(player, query);
      if (r.error) setResult(String(r.message ?? r.error));
      else setResult(r.exists ? 'User exists.' : 'User not found.');
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Quiet Directory"
      blurb="A desk directory will only tell you whether a name is present — never why, never a row dump. The custodian filed a short recovery word in that same directory. Ask questions that have only yes-or-no answers until you can rebuild it."
    >
      <form onSubmit={(e) => void search(e)} className="mt-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          className="min-w-[18rem] flex-1 rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
          placeholder="search username…"
        />
        <button
          type="submit"
          disabled={busy || !player}
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan disabled:opacity-50"
        >
          {busy ? '…' : 'Lookup'}
        </button>
      </form>
      {result && (
        <p
          className={`mt-4 text-sm font-bold ${
            result.startsWith('User exists') ? 'text-terminal-green' : 'text-terminal-amber'
          }`}
        >
          {result}
        </p>
      )}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
