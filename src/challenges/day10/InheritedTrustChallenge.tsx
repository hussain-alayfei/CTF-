import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_inherited_trust';

type Dict = Record<string, unknown>;
type Proto = Dict & { deskRole?: string; deskSeal?: string };

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

/** Danger: prototype pollution ×2 → seal → plaque. */
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
    const base: Dict = { theme: 'dark', desk: { name: 'final' } };
    merge(base, parsed as Dict);
    const { role, seal: pollutedSeal } = readPolluted();

    if (role !== 'chief') {
      setMsg('Desk settings saved. No elevated seat detected.');
      clearPollution();
      return;
    }

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

    if (!revealHex) return;
    xorDecryptHex(revealHex, 'chief')
      .then((txt) => {
        if (looksLikeToken(txt)) {
          setRevealed(txt);
          setMsg('Vault open.');
        }
      })
      .finally(() => clearPollution());
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Inherited Trust"
      blurb="Final-desk settings merge untrusted JSON into the live object graph. Inherit a chief seat, then inherit the desk seal shown on this page, in one merge — then recover the plaque."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
        {seal && (
          <p className="text-xs text-terminal-dim">
            Desk seal mark: <code className="text-terminal-amber">{seal}</code>
          </p>
        )}
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-terminal-border bg-terminal-input p-3 font-mono text-xs text-terminal-green outline-none focus:border-terminal-green"
        />
        <button
          type="button"
          onClick={applyMerge}
          className="rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green"
        >
          Merge settings
        </button>
        {msg && <p className="text-sm text-terminal-dim">{msg}</p>}
        {revealed && (
          <p className="text-sm text-terminal-green">
            Plaque: <code className="font-mono text-terminal-amber">{revealed}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
