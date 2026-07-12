import { useEffect, useRef, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';
import { looksLikeToken, xorDecryptHex } from '../../lib/dayseven';
import { playClick, unlockAudio } from '../../lib/sounds';

const ID = 'd7_cross_talk';

/**
 * Danger — the desk only accepts an elevate message from a *null* origin
 * (sandboxed frame without allow-same-origin). Same-origin widgets are ignored.
 * Student must supply sandboxed widget HTML that posts { elevate: true }.
 */
export default function CrossTalkChallenge() {
  const { player } = useApp();
  const [revealHex, setRevealHex] = useState('');
  const [widgetHtml, setWidgetHtml] = useState(
    '<!-- paste a widget that can speak to the parent desk -->\n<div>widget</div>',
  );
  const [status, setStatus] = useState('waiting for a trusted elevate…');
  const [revealed, setRevealed] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setRevealHex(String(r.material.reveal_hex ?? ''));
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    function onMsg(event: MessageEvent) {
      // Reject same-origin chatter. Only a null-origin sandboxed frame qualifies.
      if (event.origin && event.origin !== 'null') {
        setStatus(`ignored message from ${event.origin}`);
        return;
      }
      const data = event.data;
      if (!data || typeof data !== 'object' || (data as { elevate?: unknown }).elevate !== true) {
        setStatus('null-origin message lacked elevate');
        return;
      }
      if (!revealHex) return;
      unlockAudio();
      playClick();
      xorDecryptHex(revealHex, 'null-origin')
        .then((txt) => {
          if (looksLikeToken(txt)) {
            setRevealed(txt);
            setStatus('elevate accepted');
          }
        })
        .catch(() => setStatus('elevate failed'));
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [revealHex]);

  function loadWidget() {
    unlockAudio();
    playClick();
    setRevealed('');
    setStatus('widget loaded — waiting…');
    const el = iframeRef.current;
    if (!el) return;
    // Sandbox WITHOUT allow-same-origin → unique opaque origin (reported as "null").
    el.setAttribute('sandbox', 'allow-scripts');
    el.srcdoc = widgetHtml;
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Cross Talk"
      blurb="The desk ignores elevates from its own origin — too many forged widgets. It only listens to a speaker that has no origin at all. Build that speaker, load it below, and make it ask for elevation."
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
      <p className="mt-2 text-xs text-terminal-dim">{status}</p>
      {revealed && <code className="mt-3 block font-mono text-lg text-terminal-green">{revealed}</code>}
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
