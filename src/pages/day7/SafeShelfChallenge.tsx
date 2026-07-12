import { useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { d7SafeFile } from '../../lib/api';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_safe_shelf';

const GUIDES = [
  { id: 'tos.txt', label: 'Terms of Service' },
  { id: 'privacy.txt', label: 'Privacy Policy' },
  { id: 'welcome.txt', label: 'Welcome Guide' },
];

export default function SafeShelfChallenge() {
  const { player } = useApp();
  const [selected, setSelected] = useState('tos.txt');
  const [body, setBody] = useState('');
  const [meta, setMeta] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function openGuide(name: string) {
    if (!player) return;
    unlockAudio();
    playClick();
    setSelected(name);
    setBusy(true);
    setErr('');
    try {
      const r = await d7SafeFile(player, name);
      if (r.error) {
        setBody('');
        setMeta(r.resolved ? `resolved → ${r.resolved}` : '');
        setErr(String(r.message ?? r.error));
      } else {
        setBody(String(r.body ?? ''));
        setMeta(r.path ? `opened ${r.path}` : '');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Safe Shelf"
      blurb="A documentation shelf loads public guides by name. The shelf claims it only opens files inside the guides cabinet. Prove otherwise and read what the custodian left on the shelf above."
    >
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-terminal-dim">
          Guide
          <select
            value={selected}
            onChange={(e) => void openGuide(e.target.value)}
            className="mt-1 block rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-sm text-terminal-green"
          >
            {GUIDES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !player}
          onClick={() => void openGuide(selected)}
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan disabled:opacity-50"
        >
          {busy ? '…' : 'Open guide'}
        </button>
      </div>
      <p className="mt-2 font-mono text-[11px] text-terminal-dim">
        request file={selected}
        {meta ? ` · ${meta}` : ''}
      </p>
      {err && <p className="mt-2 text-sm text-terminal-red">{err}</p>}
      {body && (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-terminal-border bg-black/40 p-3 font-mono text-xs text-terminal-green">
          {body}
        </pre>
      )}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
