import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayseven';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_inherited_trust';

type Dict = Record<string, unknown>;
type Proto = Dict & { deskRole?: string; deskSeal?: string };

/** Naive recursive merge — blocks only the literal key __proto__ at each level.
 *  Still recurses into functions (e.g. constructor) so constructor.prototype works. */
function merge(target: Dict, source: Dict): Dict {
  for (const key of Object.keys(source)) {
    if (key === '__proto__') continue;
    const sv = source[key];
    const tv = target[key];
    const tvMergeable =
      tv != null && (typeof tv === 'object' || typeof tv === 'function') && !Array.isArray(tv);
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tvMergeable) {
      merge(tv as Dict, sv as Dict);
    } else {
      (target as Dict)[key] = sv;
    }
  }
  return target;
}

function readPolluted(): { role: string; seal: string } {
  const proto = Object.prototype as Proto;
  const role = Object.prototype.hasOwnProperty.call(Object.prototype, 'deskRole')
    ? String(proto.deskRole ?? '')
    : '';
  const seal = Object.prototype.hasOwnProperty.call(Object.prototype, 'deskSeal')
    ? String(proto.deskSeal ?? '')
    : '';
  return { role, seal };
}

function clearPollution() {
  try {
    delete (Object.prototype as Proto).deskRole;
    delete (Object.prototype as Proto).deskSeal;
  } catch {
    /* ignore */
  }
}

/**
 * Danger (multi-step):
 * 1) Pollute deskRole=chief → unlocks stage-2 panel + reveals seal mark
 * 2) Pollute deskRole=chief AND deskSeal=<seal> → claim vault
 */
export default function InheritedTrustChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [seal, setSeal] = useState('');
  const [raw, setRaw] = useState('{\n  "theme": "dark"\n}');
  const [msg, setMsg] = useState('');
  const [stage2, setStage2] = useState(false);
  const [revealed, setRevealed] = useState('');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) {
          setRevealHex(String(r.material.reveal_hex ?? ''));
          setSeal(String(r.material.seal ?? ''));
        }
      })
      .catch(() => {});
    return () => clearPollution();
  }, [player]);

  function applyMerge() {
    unlockAudio();
    playClick();
    setRevealed('');
    setMsg('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setMsg('JSON rejected.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setMsg('Object required.');
      return;
    }
    const base: Dict = { theme: 'dark', desk: { name: 'front' } };
    merge(base, parsed as Dict);
    const { role, seal: pollutedSeal } = readPolluted();

    if (role !== 'chief') {
      setMsg('Desk settings saved. No elevated seat detected.');
      clearPollution();
      return;
    }

    // Stage 1: chief only → reveal the second mark the vault will demand.
    if (!stage2 || pollutedSeal !== seal || !seal) {
      setStage2(true);
      setMsg(
        pollutedSeal && seal && pollutedSeal !== seal
          ? 'Chief seat seen, but the second inherited mark does not match the desk seal.'
          : 'Chief seat recognised. A second inherited mark is still required before the vault opens.',
      );
      clearPollution();
      return;
    }

    // Stage 2: chief + matching seal on the prototype at the same time.
    if (!revealHex) return;
    xorDecryptHex(revealHex, 'chief')
      .then((txt) => {
        if (looksLikeToken(txt)) {
          setRevealed(txt);
          setMsg('Chief vault opened.');
        }
      })
      .catch(() => setMsg('Elevation failed.'))
      .finally(() => clearPollution());
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Inherited Trust"
      blurb="This desk merges visitor settings into its own config. It swears it blocked the one dangerous key everyone knows about. Taking the chief seat is only half the job — the vault still wants a second inherited mark before it opens."
    >
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={8}
        className="mt-4 w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={applyMerge}
        className="mt-3 rounded-lg border border-terminal-amber/50 px-3 py-2 text-sm font-bold text-terminal-amber"
      >
        Merge settings
      </button>
      {stage2 && seal && (
        <div className="mt-4 rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 p-3 text-sm text-terminal-dim">
          <p className="text-xs uppercase tracking-widest text-terminal-amber">Chief console</p>
          <p className="mt-2">
            Desk seal on file:{' '}
            <code className="font-mono text-terminal-green">{seal}</code>
          </p>
          <p className="mt-1 text-xs opacity-70">
            The vault checks for this mark the same way it checks the seat — through inheritance, not a normal field on the desk object.
          </p>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-terminal-dim">{msg}</p>}
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
