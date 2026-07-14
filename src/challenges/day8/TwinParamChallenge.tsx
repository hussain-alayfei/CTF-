import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_twin_param';

export default function TwinParamChallenge() {
  const { player } = useApp();
  const [params] = useSearchParams();
  const [ribbon, setRibbon] = useState('');
  const [msg, setMsg] = useState('');

  // Simulate WAF vs backend: first role= checked by gate; last role= applied by desk.
  const roles = useMemo(() => params.getAll('role'), [params]);
  const username = params.get('username') || 'employee1';

  async function apply() {
    unlockAudio();
    playClick();
    setRibbon('');
    if (roles.length === 0) {
      setMsg('No role in query.');
      return;
    }
    const first = roles[0];
    const last = roles[roles.length - 1];
    // Front gate: reject if the *first* role looks elevated alone
    if (first === 'admin' || first === 'staff') {
      setMsg('Security Alert: Malicious activity detected! (front gate)');
      return;
    }
    // Backend uses last
    if (last === 'staff' || last === 'admin') {
      setMsg(`Profile updated · ${username} elevated via last role=${last}`);
      if (!player) return;
      try {
        const mat = await fetchChallengeLiveMaterial(player, ID);
        if (!mat.ok || !mat.material) return;
        const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'role');
        if (looksLikeToken(txt)) setRibbon(txt);
      } catch {
        setMsg('Update failed');
      }
      return;
    }
    setMsg(`Saved role=${last} (not elevated).`);
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Twin Param"
      blurb="Profile updates refuse elevated roles when they appear alone. A loud front gate blocks that. The desk behind the gate may read parameters in a different order. Deliver a request that looks safe to the gate but elevates you on the desk."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          Try the address bar, e.g. append query parameters to this page URL, then press Apply.
        </p>
        <p className="text-xs break-all text-terminal-dim">
          Current roles parsed: [{roles.map((r) => JSON.stringify(r)).join(', ') || 'none'}]
        </p>
        <button
          type="button"
          onClick={() => void apply()}
          className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
        >
          Apply profile update
        </button>
        {msg && <p className="text-xs text-terminal-amber">{msg}</p>}
        {ribbon && (
          <p className="text-sm text-terminal-green">
            Staff ribbon: <code className="font-mono text-terminal-amber">{ribbon}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
