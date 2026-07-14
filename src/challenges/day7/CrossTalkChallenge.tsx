import { useEffect, useRef, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayseven';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd7_cross_talk';

/**
 * Danger (multi-step):
 * 1) Null-origin { elevate: true } opens the channel and reveals a gate mark
 * 2) Null-origin { confirm: true, gate: "<mark>" } opens the vault
 * Same-origin posts are ignored.
 */
export default function CrossTalkChallenge() {
  const { player } = useApp();
  const [gate, setGate] = useState('');
  const [channelOpen, setChannelOpen] = useState(false);
  const [widgetHtml, setWidgetHtml] = useState(
    '<!-- paste a widget that can speak to the parent desk -->\n<div>widget</div>',
  );
  const [status, setStatus] = useState('waiting for a trusted elevate…');
  const [revealed, setRevealed] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef(false);
  const gateRef = useRef('');
  const revealRef = useRef('');

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) {
          const hex = String(r.material.reveal_hex ?? '');
          const g = String(r.material.gate ?? '');
          setGate(g);
          revealRef.current = hex;
          gateRef.current = g;
        }
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    function onMsg(event: MessageEvent) {
      if (event.origin && event.origin !== 'null') {
        setStatus(`ignored message from ${event.origin}`);
        return;
      }
      const data = event.data;
      if (!data || typeof data !== 'object') {
        setStatus('null-origin message ignored');
        return;
      }
      const msg = data as { elevate?: unknown; confirm?: unknown; gate?: unknown };

      // Step 1 — open channel
      if (msg.elevate === true && msg.confirm !== true) {
        unlockAudio();
        playClick();
        channelRef.current = true;
        setChannelOpen(true);
        setRevealed('');
        setStatus('channel open — confirm with the desk gate');
        return;
      }

      // Step 2 — confirm with gate from a null-origin speaker
      if (msg.confirm === true) {
        if (!channelRef.current) {
          setStatus('confirm ignored — channel is not open');
          return;
        }
        if (String(msg.gate ?? '') !== gateRef.current || !gateRef.current) {
          setStatus('confirm rejected — gate mismatch');
          return;
        }
        if (!revealRef.current) return;
        unlockAudio();
        playClick();
        xorDecryptHex(revealRef.current, 'null-origin')
          .then((txt) => {
            if (looksLikeToken(txt)) {
              setRevealed(txt);
              setStatus('elevate confirmed');
            }
          })
          .catch(() => setStatus('confirm failed'));
        return;
      }

      setStatus('null-origin message lacked a recognised shape');
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function loadWidget() {
    unlockAudio();
    playClick();
    setStatus('widget loaded — waiting…');
    const el = iframeRef.current;
    if (!el) return;
    el.setAttribute('sandbox', 'allow-scripts');
    el.srcdoc = widgetHtml;
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Cross Talk"
      blurb="The desk ignores elevates from its own origin — too many forged widgets. Open a channel from a speaker with no origin, read the gate the desk posts back, then confirm from that same kind of speaker."
    >
      <textarea
        value={widgetHtml}
        onChange={(e) => setWidgetHtml(e.target.value)}
        rows={7}
        className="mt-4 w-full rounded-lg border border-terminal-border bg-terminal-input px-3 py-2 font-mono text-xs text-terminal-green outline-none focus:border-terminal-green"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={loadWidget}
        className="mt-3 rounded-lg border border-terminal-cyan/50 px-3 py-2 text-sm font-bold text-terminal-cyan"
      >
        Load sandboxed widget
      </button>
      <iframe ref={iframeRef} title="widget" className="mt-3 h-28 w-full rounded-lg border border-terminal-border bg-black" />
      {channelOpen && gate && (
        <div className="mt-3 rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/10 p-3 text-sm text-terminal-dim">
          <p className="text-xs uppercase tracking-widest text-terminal-cyan">Channel open</p>
          <p className="mt-2">
            Desk gate:{' '}
            <code className="font-mono text-terminal-green">{gate}</code>
          </p>
          <p className="mt-1 text-xs opacity-70">Confirm must come from a no-origin speaker and carry this gate.</p>
        </div>
      )}
      <p className="mt-2 text-xs text-terminal-dim">{status}</p>
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
