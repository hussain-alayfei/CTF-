import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayseven';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_stash_order';
const KEYS = ['d7_stash_a', 'd7_stash_b', 'd7_stash_c'] as const;

type Slots = { a: string; b: string; c: string };

export default function StashOrderChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [slots, setSlots] = useState<Slots | null>(null);
  const [revealed, setRevealed] = useState('');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) {
          setRevealHex(String(r.material.reveal_hex ?? ''));
          setSlots({
            a: String(r.material.a ?? ''),
            b: String(r.material.b ?? ''),
            c: String(r.material.c ?? ''),
          });
        }
      })
      .catch(() => {});
  }, [player]);

  function leakPlan() {
    if (!slots) return;
    unlockAudio();
    playClick();
    // Real requests so the Network panel shows the drawer labels. Fired out of order.
    const ping = (seq: number, seg: string) => {
      fetch(`/collect/desk-drawers?seq=${seq}&seg=${encodeURIComponent(seg)}`, { cache: 'no-store' }).catch(
        () => {},
      );
    };
    ping(2, slots.b);
    ping(3, slots.c);
    ping(1, slots.a);
    setStatus('plan broadcast');
  }

  function wipe() {
    KEYS.forEach((k) => localStorage.removeItem(k));
    setRevealed('');
    setStatus('wiped');
  }

  function openVault() {
    unlockAudio();
    playClick();
    if (!slots || !revealHex) return;
    const vals = KEYS.map((k) => localStorage.getItem(k) ?? '');
    const ok = vals[0] === slots.a && vals[1] === slots.b && vals[2] === slots.c;
    if (!ok) {
      setRevealed('');
      setStatus('vault refused');
      return;
    }
    xorDecryptHex(revealHex, `${slots.a}|${slots.b}|${slots.c}`)
      .then((txt) => {
        if (looksLikeToken(txt)) {
          setRevealed(txt);
          setStatus('vault open');
        } else setStatus('vault refused');
      })
      .catch(() => setStatus('vault refused'));
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Stash Order"
      blurb="The vault expects three named drawers in this browser’s lasting storage — in a fixed order. The building quietly broadcasts the drawer labels when you ask for the plan. Rebuild the stash yourself, then open the vault."
    >
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={leakPlan}
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan"
        >
          Request floor plan
        </button>
        <button
          type="button"
          onClick={openVault}
          className="rounded-lg border border-terminal-amber/50 px-3 py-2 text-sm font-bold text-terminal-amber"
        >
          Open vault
        </button>
        <button type="button" onClick={wipe} className="rounded-lg border border-terminal-border px-3 py-2 text-xs text-terminal-dim">
          Wipe stash
        </button>
      </div>
      <p className="mt-3 text-xs text-terminal-dim">Status: {status}</p>
      <p className="mt-1 text-xs text-terminal-dim opacity-70">Drawer keys the vault checks: d7_stash_a → d7_stash_b → d7_stash_c</p>
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
