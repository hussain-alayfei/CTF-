import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_hidden_ledger';

/**
 * Simulated desk query:
 *   SELECT * FROM ledger WHERE acct = '<input>' AND closed = 0
 *
 * - Odd unescaped quotes → syntax error (matches the TA draft symptom).
 * - Classic tautology WITHOUT commenting the trailing AND → still "not found"
 *   (smart: textbook admin' OR '1'='1 alone is not enough).
 * - Tautology + comment (-- / # / /*) → bypass.
 */
function tryLedgerLogin(acct: string): 'syntax' | 'notfound' | 'ok' {
  const noEscaped = acct.replace(/''/g, '');
  const quoteCount = (noEscaped.match(/'/g) || []).length;
  if (quoteCount % 2 === 1) return 'syntax';

  const tautology = /'\s*OR\s+(?:'1'\s*=\s*'1'|1\s*=\s*1)/i.test(acct);
  const commented = /(?:--|#|\/\*)/.test(acct);
  if (tautology && commented) return 'ok';
  return 'notfound';
}

export default function HiddenLedgerChallenge() {
  const { player } = useApp();
  const [acct, setAcct] = useState('');
  const [msg, setMsg] = useState('');
  const [flagWord, setFlagWord] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    playClick();
    setFlagWord('');
    const result = tryLedgerLogin(acct);
    if (result === 'syntax') {
      setMsg("Database Syntax Error near '''");
      return;
    }
    if (result === 'notfound') {
      setMsg('Account not found.');
      return;
    }
    setMsg('Welcome — primary ledger unlocked.');
    if (!player) return;
    try {
      const mat = await fetchChallengeLiveMaterial(player, ID);
      if (!mat.ok || !mat.material) return;
      const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'bypass');
      if (looksLikeToken(txt)) setFlagWord(txt);
    } catch {
      setMsg('Ledger error');
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Hidden Ledger"
      blurb="Campus ledger login asks only for an account number. Wrong numbers say the account was not found. Some inputs make the desk complain about broken wording near a quote. Reach the primary ledger."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-terminal-dim">
            Account number
          </label>
          <input
            value={acct}
            onChange={(e) => setAcct(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-sm text-terminal-green outline-none focus:border-terminal-green"
            placeholder="e.g. 104482"
          />
          <button
            type="submit"
            className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
          >
            Sign in
          </button>
        </form>
        {msg && (
          <p
            className={`text-xs ${
              msg.startsWith('Welcome') ? 'text-terminal-green' : 'text-terminal-amber'
            }`}
          >
            {msg}
          </p>
        )}
        {flagWord && (
          <p className="text-sm text-terminal-green">
            Ledger word:{' '}
            <code className="font-mono text-terminal-amber">{flagWord}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
