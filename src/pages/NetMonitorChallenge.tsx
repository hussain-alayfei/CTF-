import { useState } from 'react';
import { Link } from 'react-router-dom';

const FLAG = 'KGSP{telnet}';

// Each row is a live "service" on the audited host. Exactly one still carries
// credentials in cleartext (Telnet / port 23). Students must recognise the
// insecure protocol and click it — no download, pure hands-on inspection.
const services = [
  { service: 'https', port: 443, transport: 'TCP', encryption: 'TLS 1.3', secure: true },
  { service: 'ssh', port: 22, transport: 'TCP', encryption: 'AES-256', secure: true },
  { service: 'dns', port: 53, transport: 'UDP', encryption: 'DNSSEC', secure: true },
  { service: 'telnet', port: 23, transport: 'TCP', encryption: 'NONE (cleartext)', secure: false },
  { service: 'rdp', port: 3389, transport: 'TCP', encryption: 'TLS', secure: true },
  { service: 'imaps', port: 993, transport: 'TCP', encryption: 'TLS', secure: true },
];

export default function NetMonitorChallenge() {
  const [picked, setPicked] = useState<string | null>(null);

  const solved = picked === 'telnet';
  const wrong = picked != null && picked !== 'telnet';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-terminal-dim underline decoration-dotted hover:text-terminal-green">
        ‹ back to the arena
      </Link>

      <div className="mt-4 rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-neon">
        <h1 className="text-2xl font-extrabold text-terminal-green">📡 Network Services Monitor</h1>
        <p className="mt-1 text-sm text-terminal-dim">
          Live services detected on host <strong className="text-terminal-strong">10.40.20.9</strong>.
          Security policy forbids any service that transmits credentials in the clear.
        </p>

        <p className="mt-4 text-sm text-terminal-amber">
          ⚠ One of these services exposes usernames and passwords to anyone sniffing the wire.
          Click the offending service to quarantine it.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-terminal-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-terminal-input/60 text-[11px] uppercase tracking-widest text-terminal-dim">
              <tr>
                <th className="px-4 py-2">Service</th>
                <th className="px-4 py-2">Port</th>
                <th className="px-4 py-2">Transport</th>
                <th className="px-4 py-2">Encryption</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.service}
                  onClick={() => setPicked(s.service)}
                  className={`cursor-pointer border-t border-terminal-border/50 transition hover:bg-terminal-green/5 ${
                    picked === s.service ? 'bg-terminal-green/10' : ''
                  }`}
                >
                  <td className="px-4 py-2 font-bold text-terminal-green">{s.service}</td>
                  <td className="px-4 py-2 tabular-nums text-terminal-dim">{s.port}</td>
                  <td className="px-4 py-2 text-terminal-dim">{s.transport}</td>
                  <td className={`px-4 py-2 ${s.secure ? 'text-terminal-dim' : 'text-terminal-red'}`}>
                    {s.encryption}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {solved && (
          <div className="mt-6 animate-pop rounded-lg border border-terminal-green/60 bg-terminal-green/10 p-6 text-center shadow-neon">
            <div className="text-sm uppercase tracking-widest text-terminal-dim">Insecure service quarantined</div>
            <div className="mt-2 text-terminal-green">
              Correct — that protocol sends everything, including passwords, as plain text. Flag:
            </div>
            <code className="mt-3 inline-block select-all rounded bg-terminal-input px-4 py-2 text-lg font-bold text-terminal-green">
              {FLAG}
            </code>
          </div>
        )}
        {wrong && (
          <div className="mt-6 rounded-lg border border-terminal-red/50 bg-terminal-red/10 p-4 text-center text-sm text-terminal-red">
            That service is encrypted — sniffing it would only reveal ciphertext. Look for the one with no encryption.
          </div>
        )}
      </div>
    </div>
  );
}
