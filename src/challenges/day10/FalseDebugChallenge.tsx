import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_false_debug';
const TRAP_KEY = 'd10_analysis_trap';
const BYPASS_KEY = 'd10_core_bypass';

/** Hard: fake plaque when analysis trap is on; bypass to reach real core. */
export default function FalseDebugChallenge() {
  const { player } = useApp();
  const [trap, setTrap] = useState(true);
  const [bypass, setBypass] = useState(false);
  const [plaque, setPlaque] = useState('');

  useEffect(() => {
    if (localStorage.getItem(TRAP_KEY) == null) localStorage.setItem(TRAP_KEY, '1');
    const tick = () => {
      setTrap(localStorage.getItem(TRAP_KEY) !== '0');
      setBypass(localStorage.getItem(BYPASS_KEY) === '1');
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setPlaque('');
    // Real core only when trap is off AND bypass is set
    if (trap || !bypass || !player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material?.reveal_hex) return;
        const txt = await xorDecryptHex(String(r.material.reveal_hex), 'core');
        if (alive && looksLikeToken(txt)) setPlaque(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trap, bypass, player]);

  function openCore() {
    unlockAudio();
    playClick();
  }

  const showFake = trap;

  return (
    <ChallengeFrame
      challengeId={ID}
      title="False Debugger"
      blurb="The core vault shows a convincing plaque if analysis mode is still armed. Turn the analysis trap off and raise the core bypass mark in this browser, then open the real core."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-xs text-terminal-dim">
          Storage marks: <code>{TRAP_KEY}</code> (1=armed) · <code>{BYPASS_KEY}</code> (1=ready)
        </p>
        <p className="mt-2">
          Analysis trap: <code className="text-terminal-amber">{trap ? 'armed' : 'clear'}</code>
          {' · '}
          Bypass: <code className="text-terminal-amber">{bypass ? 'ready' : 'missing'}</code>
        </p>
        <button
          type="button"
          onClick={openCore}
          className="mt-3 rounded-lg border border-terminal-green bg-terminal-green/10 px-4 py-2 text-sm font-bold text-terminal-green"
        >
          Open core
        </button>
        {showFake && (
          <p className="mt-3 text-terminal-red">
            Plaque: <code className="font-mono">TryAgain_not_real</code>
          </p>
        )}
        {!showFake && !bypass && (
          <p className="mt-3 text-xs text-terminal-dim">Trap clear — core bypass mark still missing.</p>
        )}
        {plaque && (
          <p className="mt-3 text-terminal-green">
            True core: <code className="font-mono text-terminal-amber">{plaque}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
