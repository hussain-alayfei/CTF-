import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayseven';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_claim_ticket';
const COOKIE = 'd7_claim';

function b64url(obj: unknown) {
  const s = btoa(JSON.stringify(obj));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(s: string) {
  const pad = s + '==='.slice((s.length + 3) % 4);
  const b64 = pad.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64)) as Record<string, unknown>;
}

async function hmacHex(message: string, key: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Hard — issue a real HS256-style guest ticket, but the verifier skips the
 * signature entirely when alg is "none" / "NONE". Forge admin + alg none.
 */
export default function ClaimTicketChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [issued, setIssued] = useState('');
  const [status, setStatus] = useState('');
  const [revealed, setRevealed] = useState('');
  const pepper = 'desk-ink-never-guess'; // used only for honest HS256 guest tickets

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
  }, [player]);

  async function issueGuest() {
    unlockAudio();
    playClick();
    const header = b64url({ alg: 'HS256', typ: 'DESK' });
    const payload = b64url({ role: 'guest', desk: 'front' });
    const sig = (await hmacHex(`${header}.${payload}`, pepper)).slice(0, 24);
    const ticket = `${header}.${payload}.${sig}`;
    document.cookie = `${COOKIE}=${ticket}; path=/; SameSite=Lax`;
    setIssued(ticket);
    setStatus('guest ticket issued (cookie d7_claim)');
    setRevealed('');
  }

  async function openVault() {
    unlockAudio();
    playClick();
    const ticket = readCookie(COOKIE) || issued;
    if (!ticket) {
      setStatus('no ticket');
      return;
    }
    const parts = ticket.split('.');
    if (parts.length !== 3) {
      setStatus('malformed ticket');
      return;
    }
    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
      header = fromB64url(parts[0]);
      payload = fromB64url(parts[1]);
    } catch {
      setStatus('decode failed');
      return;
    }
    const alg = String(header.alg ?? '');
    // Lazy shortcut: alg "none" skips the ink check entirely.
    if (alg.toLowerCase() !== 'none') {
      const expect = (await hmacHex(`${parts[0]}.${parts[1]}`, pepper)).slice(0, 24);
      if (parts[2] !== expect) {
        setStatus('bad signature');
        return;
      }
    }
    if (payload.role !== 'admin') {
      setStatus(`role=${String(payload.role)} — vault sealed`);
      return;
    }
    if (!revealHex) return;
    const txt = await xorDecryptHex(revealHex, 'admin');
    if (looksLikeToken(txt)) {
      setRevealed(txt);
      setStatus('vault open');
    } else setStatus('vault refused');
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Claim Ticket"
      blurb="The desk issues signed claim tickets. Guests get a valid ticket for free. The vault only opens for a ticket that claims the admin seat — and the verifier has one lazy shortcut when it trusts a ticket too much."
    >
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void issueGuest()}
          className="rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan"
        >
          Issue guest ticket
        </button>
        <button
          type="button"
          onClick={() => void openVault()}
          className="rounded-lg border border-terminal-amber/50 px-3 py-2 text-sm font-bold text-terminal-amber"
        >
          Open vault with cookie
        </button>
      </div>
      {issued && (
        <pre className="mt-3 overflow-x-auto break-all rounded-lg border border-terminal-border bg-black/40 p-3 font-mono text-[11px] text-terminal-green">
          {issued}
        </pre>
      )}
      <p className="mt-2 text-xs text-terminal-dim">{status}</p>
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
