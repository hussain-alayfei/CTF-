import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_proxy_price';
const LIST_PRICE = 9999;
const BALANCE = 50;

export default function ProxyPriceChallenge() {
  const { player } = useApp();
  const [msg, setMsg] = useState('');
  const [slip, setSlip] = useState('');

  async function buy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    unlockAudio();
    playClick();
    const fd = new FormData(e.currentTarget);
    const price = Number(fd.get('price'));
    setSlip('');
    if (price > BALANCE) {
      setMsg(`Payment refused · charged ${price} but balance is ${BALANCE}.`);
      return;
    }
    if (price < 1) {
      setMsg('Payment refused · invalid amount.');
      return;
    }
    setMsg(`Payment accepted · charged ${price}.`);
    if (!player) return;
    try {
      const mat = await fetchChallengeLiveMaterial(player, ID);
      if (!mat.ok || !mat.material) return;
      const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'price=1');
      if (looksLikeToken(txt)) setSlip(txt);
    } catch {
      setMsg('Checkout error');
    }
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Proxy Price"
      blurb="Sealed item costs more than your balance. Editing the number on the shelf is not enough — the checkout request carries its own price. Change what is sent when you buy."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p>
          Sealed item · shelf price <strong className="text-terminal-amber">{LIST_PRICE}</strong>
        </p>
        <p className="text-terminal-dim">Your balance: {BALANCE}</p>
        <form onSubmit={(e) => void buy(e)} className="space-y-2">
          {/* Hidden field is what the "server" trusts — intercept / edit this */}
          <input type="hidden" name="price" defaultValue={String(LIST_PRICE)} />
          <input type="hidden" name="item" defaultValue="sealed-kit" />
          <button
            type="submit"
            className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
          >
            Buy
          </button>
        </form>
        {msg && <p className="text-xs text-terminal-amber">{msg}</p>}
        {slip && (
          <p className="text-sm text-terminal-green">
            Packing slip: <code className="font-mono text-terminal-amber">{slip}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
