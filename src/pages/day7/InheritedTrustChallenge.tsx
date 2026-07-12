import { useEffect, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { looksLikeToken, xorDecryptHex } from '../../lib/dayseven';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_inherited_trust';

type Dict = Record<string, unknown>;

/** Naive recursive merge — blocks only the literal key __proto__ at each level. */
function merge(target: Dict, source: Dict): Dict {
  for (const key of Object.keys(source)) {
    if (key === '__proto__') continue;
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      merge(tv as Dict, sv as Dict);
    } else {
      (target as Dict)[key] = sv;
    }
  }
  return target;
}

export default function InheritedTrustChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [raw, setRaw] = useState('{\n  "theme": "dark"\n}');
  const [msg, setMsg] = useState('');
  const [revealed, setRevealed] = useState('');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
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
    // Privilege check reads a field that honest JSON cannot set on the base
    // object — only a polluted prototype makes it appear.
    const role = (base as Dict & { deskRole?: string }).deskRole
      ?? (base.desk as Dict | undefined)?.role;
    const polluted = Object.prototype.hasOwnProperty.call(Object.prototype, 'deskRole')
      ? String((Object.prototype as Dict & { deskRole?: string }).deskRole ?? '')
      : '';
    const effective = polluted || (typeof role === 'string' ? role : '') || '';
    if (effective !== 'chief') {
      setMsg('Desk settings saved. No elevated seat detected.');
      // Clean accidental pollution attempts that weren't chief
      try {
        delete (Object.prototype as Dict).deskRole;
      } catch {
        /* ignore */
      }
      return;
    }
    if (!revealHex) return;
    xorDecryptHex(revealHex, 'chief')
      .then((txt) => {
        if (looksLikeToken(txt)) {
          setRevealed(txt);
          setMsg('Chief seat recognised.');
        }
      })
      .catch(() => setMsg('Elevation failed.'))
      .finally(() => {
        try {
          delete (Object.prototype as Dict).deskRole;
        } catch {
          /* ignore */
        }
      });
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Inherited Trust"
      blurb="This desk merges visitor settings into its own config. It swears it blocked the one dangerous key everyone knows about. Prove the swear was too narrow — then take the chief seat."
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
      {msg && <p className="mt-3 text-sm text-terminal-dim">{msg}</p>}
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
