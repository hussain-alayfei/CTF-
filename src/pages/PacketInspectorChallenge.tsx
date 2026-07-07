import { useState } from 'react';
import { Link } from 'react-router-dom';

const FLAG = 'KGSP{ssh}';

// A packet/flow inspector: the connection uses TCP/443 but the payload's first
// bytes are a protocol banner that is NOT TLS. Students read the ASCII column
// and identify the real protocol, then type it. No download required.
const bytes: { off: string; hex: string; ascii: string }[] = [
  { off: '0000', hex: '53 53 48 2d 32 2e 30 2d 4f 70 65 6e 53 53 48 5f', ascii: 'SSH-2.0-OpenSSH_' },
  { off: '0010', hex: '39 2e 33 0d 0a 00 00 00 2c 06 1f 00 00 00 00 00', ascii: '9.3.............' },
  { off: '0020', hex: '14 c1 9b 3e 7a 55 0e 88 62 21 aa 04 9f 3d 11 6b', ascii: '...>zU..b!...=.k' },
];

export default function PacketInspectorChallenge() {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'bad'>('idle');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const norm = answer.trim().toLowerCase();
    setStatus(norm === 'ssh' ? 'ok' : 'bad');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">🧬 Packet Inspector</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          Flow <strong className="text-terminal-strong">10.40.20.42 → 203.0.113.77</strong> ·
          destination port <strong className="text-terminal-strong">443</strong> ·
          TLS handshake: <span className="text-terminal-red">not seen</span>
        </p>

        <p className="mt-4 text-sm text-terminal-amber">
          Port 443 is supposed to be HTTPS — but no TLS handshake was captured. Read the raw payload
          below and identify what protocol is really running inside this connection.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-terminal-border bg-terminal-input/40 p-4 font-mono text-xs leading-relaxed">
          {bytes.map((b) => (
            <div key={b.off} className="flex gap-4 whitespace-pre">
              <span className="text-terminal-dim">{b.off}</span>
              <span className="text-terminal-green/80">{b.hex}</span>
              <span className="text-terminal-cyan">{b.ascii}</span>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="protocol name (lowercase)"
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-input px-4 py-3 text-terminal-green caret-terminal-green outline-none transition focus:border-terminal-green focus:shadow-neon"
          />
          <button
            type="submit"
            className="rounded-lg border border-terminal-green bg-terminal-green/10 px-5 py-3 font-bold uppercase tracking-widest text-terminal-green transition hover:bg-terminal-green/20"
          >
            Identify
          </button>
        </form>

        {status === 'ok' && (
          <div className="mt-5 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-5 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Protocol identified</div>
            <div className="mt-2 text-terminal-green">
              Correct — the banner gives it away. The port was a disguise. Flag:
            </div>
            <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
              {FLAG}
            </code>
          </div>
        )}
        {status === 'bad' && (
          <p className="mt-4 text-center text-sm text-terminal-red">
            Not quite. Ignore the port number — read the ASCII banner in the first bytes of the payload.
          </p>
        )}
      </div>
    </div>
  );
}
