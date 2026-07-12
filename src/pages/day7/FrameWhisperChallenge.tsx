import { useEffect, useRef, useState } from 'react';
import ChallengeFrame from '../../components/ChallengeFrame';
import AnswerBox from '../../components/AnswerBox';
import { useApp } from '../../lib/app-context';
import { fetchChallengeLiveMaterial } from '../../lib/api';

const ID = 'd7_frame_whisper';

export default function FrameWhisperChallenge() {
  const { player } = useApp();
  const [frag, setFrag] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then((r) => {
        if (r.ok && r.material) setFrag(String(r.material.frag ?? ''));
      })
      .catch(() => {});
  }, [player]);

  useEffect(() => {
    if (!frag || !iframeRef.current) return;
    const html = `<!doctype html><html><body style="font:14px monospace;background:#0a0a0a;color:#6f6;padding:12px">
widget online
<script>
setTimeout(function(){
  parent.postMessage({channel:'desk-widget',note:${JSON.stringify(frag)}}, '*');
}, 600);
<\/script>
</body></html>`;
    iframeRef.current.srcdoc = html;
  }, [frag]);

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Frame Whisper"
      blurb="A tiny widget loads beside the desk. It never prints its note on this page — it only speaks once to whoever is listening. Catch what it says, then submit that note."
    >
      <div className="mt-4 overflow-hidden rounded-lg border border-terminal-border">
        <iframe ref={iframeRef} title="desk-widget" className="h-28 w-full bg-black" sandbox="allow-scripts" />
      </div>
      <p className="mt-2 text-xs text-terminal-dim">The outer page deliberately does not display the note.</p>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
