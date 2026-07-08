import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { verifyChallengeAnswer } from '../lib/api';
import { playClick, playCorrect, playWrong, unlockAudio } from '../lib/sounds';

// Static decoy data for the read-only community — not secret, safe to ship.
const RO_OIDS = [
  { oid: '1.3.6.1.2.1.1.5.0', name: 'sysName', value: 'edge-rtr-04' },
  { oid: '1.3.6.1.2.1.1.1.0', name: 'sysDescr', value: 'CorpOS 12.4, edge router' },
  { oid: '1.3.6.1.4.1.9.99.FLAG', name: 'flagOid', value: '<access denied: rw required>' },
];

// Live SNMP-console challenge (net_router_live). No flag string lives in
// this file — the recovered community string is verified server-side by the
// shared verify_challenge_answer RPC, which mints a personal flag only for
// the player who solved it.
export default function RouterConsoleChallenge() {
  const { player } = useApp();
  const [community, setCommunity] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; flag?: string } | null>(null);
  const [showDecoy, setShowDecoy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!community.trim() || busy || !player) return;
    unlockAudio();
    playClick();
    setBusy(true);
    setShowDecoy(false);
    try {
      const r = await verifyChallengeAnswer(player, 'net_router_live', community.trim());
      setResult({ ok: !!r.ok, message: r.message ?? '', flag: r.flag });
      if (r.ok) {
        playCorrect();
      } else {
        playWrong();
        if (community.trim().toLowerCase() === 'public') setShowDecoy(true);
      }
    } catch {
      setResult({ ok: false, message: 'Console unreachable — try again.' });
      playWrong();
    } finally {
      setBusy(false);
    }
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-terminal-dim">Log in from the arena first, then reopen this challenge.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-terminal-green underline decoration-dotted">
          ‹ back to the arena
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🛰 SNMP Console — edge-rtr-04</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          Live agent at <strong className="text-terminal-strong">10.40.0.1 : 161/udp</strong>. Send a
          community string to walk the OID tree. The flag OID is read-write protected.
        </p>

        <p className="mt-4 text-sm text-terminal-amber">
          ⚠ The read-only community won’t reach the flag OID. Recover the read-<strong>write</strong>{' '}
          community from the router’s config backup (download it on the challenge card), then query it here.
        </p>

        <form onSubmit={send} className="mt-5 flex gap-2">
          <input
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            placeholder="community string"
            disabled={busy}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 font-mono text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20 disabled:opacity-50"
          >
            {busy ? '…' : 'snmpwalk ▸'}
          </button>
        </form>

        {result?.ok && result.flag && (
          <div className="mt-6 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Read-write access granted</div>
            <div className="mt-2 text-terminal-green">This flag is personal to your account:</div>
            <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
              {result.flag}
            </code>
            <p className="mt-3 text-xs text-terminal-dim">Paste it into the arena flag box to score.</p>
          </div>
        )}

        {result && !result.ok && (
          <div className="mt-6 rounded-lg border border-terminal-red/40 bg-terminal-red/5 p-4">
            <p className="text-sm text-terminal-red">{result.message}</p>
            {showDecoy && (
              <table className="mt-3 w-full text-left font-mono text-xs">
                <tbody>
                  {RO_OIDS.map((o) => (
                    <tr key={o.oid} className="border-t border-terminal-border/40">
                      <td className="py-1 pr-3 text-terminal-dim">{o.oid}</td>
                      <td className="py-1 pr-3 text-terminal-cyan">{o.name}</td>
                      <td className="py-1 text-terminal-green/80">{o.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-terminal-dim">
          Hint: in SNMP, <span className="text-terminal-amber">ro</span> = read-only and{' '}
          <span className="text-terminal-amber">rw</span> = read-write. The backup lists both.
        </p>
      </div>
    </div>
  );
}
