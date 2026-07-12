import { useEffect, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { sha256HexPrefix } from '../../lib/dayseven';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_blind_counter';
const LEN = 8;

export default function BlindCounterChallenge() {
  const { player } = useApp();
  const [hashes, setHashes] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [guess, setGuess] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [built, setBuilt] = useState<string[]>(Array(LEN).fill(''));

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material && Array.isArray(r.material.pos_hashes)) {
          setHashes(r.material.pos_hashes.map(String));
        }
      })
      .catch(() => {});
  }, [player]);

  async function probe(e: React.FormEvent) {
    e.preventDefault();
    if (!guess || hashes.length !== LEN) return;
    unlockAudio();
    playClick();
    const ch = guess.slice(0, 1);
    const dig = await sha256HexPrefix(`${ch}|${pos}`);
    const ok = dig === hashes[pos];
    setLog((L) => [`pos ${pos}: '${ch}' → ${ok ? 'YES' : 'no'}`, ...L].slice(0, 12));
    if (ok) {
      setBuilt((b) => {
        const n = [...b];
        n[pos] = ch;
        return n;
      });
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Blind Counter"
      blurb="The desk will not show the code. It will only answer yes or no for one character at one position. Work the counter yourself — eight seats, one glyph each — then submit what you rebuilt."
    >
      <form onSubmit={probe} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-terminal-border bg-terminal-input/30 p-4">
        <label className="text-xs text-terminal-dim">
          Position
          <input
            type="number"
            min={0}
            max={LEN - 1}
            value={pos}
            onChange={(e) => setPos(Math.max(0, Math.min(LEN - 1, Number(e.target.value) || 0)))}
            className="mt-1 block w-20 rounded border border-terminal-border bg-terminal-input px-2 py-1 font-mono text-sm text-terminal-green"
          />
        </label>
        <label className="text-xs text-terminal-dim">
          Glyph
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value.slice(0, 1))}
            maxLength={1}
            className="mt-1 block w-16 rounded border border-terminal-border bg-terminal-input px-2 py-1 font-mono text-sm text-terminal-green"
          />
        </label>
        <button type="submit" className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan">
          Ask
        </button>
      </form>
      <p className="mt-3 font-mono text-sm text-terminal-amber">
        Seats: {built.map((c) => (c ? c : '_')).join(' ')}
      </p>
      <ul className="mt-2 space-y-1 font-mono text-xs text-terminal-dim">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
