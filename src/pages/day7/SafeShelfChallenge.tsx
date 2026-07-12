import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

/**
 * Classic ?file= viewer: dropdown fills the path, Open loads whatever is in the
 * path field (so traversal can be typed here — not Network-only). Auto-opens
 * the current path once the player session is ready.
 */
export default function SafeShelfChallenge() {
  const { player } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('file') || 'tos.txt';
  const [path, setPath] = useState(initial);
  const [body, setBody] = useState('');
  const [meta, setMeta] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const openedOnce = useRef(false);

  async function openPath(name: string, fromUser = true) {
    if (!player) return;
    const file = name.trim() || 'tos.txt';
    if (fromUser) {
      unlockAudio();
      playClick();
    }
    setPath(file);
    setSearchParams({ file }, { replace: true });
    setBusy(true);
    setErr('');
    try {
      const r = await d7SafeFile(player, file);
      if (r.error) {
        setBody('');
        setMeta(r.resolved ? `resolved → ${r.resolved}` : '');
        setErr(String(r.message ?? r.error));
      } else {
        setBody(String(r.body ?? ''));
        setMeta(r.path ? `opened ${r.path}` : '');
      }
    } catch (e) {
      setBody('');
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  // Open whatever is in the path (or default guide) as soon as we have a session.
  useEffect(() => {
    if (!player || openedOnce.current) return;
    openedOnce.current = true;
    void openPath(path, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional first-load only
  }, [player]);

  const dropdownValue = GUIDES.some((g) => g.id === path) ? path : '';

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
            value={dropdownValue}
            onChange={(e) => void openPath(e.target.value)}
            className="mt-1 block rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 text-sm text-terminal-green"
          >
            <option value="" disabled>
              — pick a public guide —
            </option>
            {GUIDES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[16rem] flex-1 text-xs text-terminal-dim">
          file=
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void openPath(path)}
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
            placeholder="tos.txt"
          />
        </label>

        <button
          type="button"
          disabled={busy || !player}
          onClick={() => void openPath(path)}
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan disabled:opacity-50"
        >
          {busy ? '…' : 'Open guide'}
        </button>
      </div>

      <p className="mt-2 font-mono text-[11px] text-terminal-dim">
        request file={path}
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
