import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { d7LeakyUser } from '@/lib/api';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_leaky_desk';
const MY_DESK = 4188;

export default function LeakyDeskChallenge() {
  const { player } = useApp();
  const [json, setJson] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadMine() {
    if (!player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    setErr('');
    try {
      const r = await d7LeakyUser(player, MY_DESK);
      setJson(JSON.stringify(r, null, 2));
      if (r.error) setErr(String(r.message ?? r.error));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Leaky Desk"
      blurb="Your desk portal shows a welcome card and will fetch your profile when you ask. The portal talks to a background desk directory to do that. See whose records that directory will hand over — then recover what the custodian filed."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p className="font-bold text-terminal-green">Arena Visitor</p>
        <p className="mt-1">Desk seat #{MY_DESK}</p>
        <p className="mt-1 text-xs">Member since 2026-03-14</p>
        <button
          type="button"
          disabled={busy || !player}
          onClick={() => void loadMine()}
          className="mt-4 rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan disabled:opacity-50"
        >
          {busy ? '…' : 'View My Profile Data'}
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-terminal-red">{err}</p>}
      {json && (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-terminal-border bg-black/40 p-3 font-mono text-xs text-terminal-green">
          {json}
        </pre>
      )}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
