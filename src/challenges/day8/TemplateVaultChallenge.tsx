import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_template_vault';

const DENY = [/class/i, /mro/i, /import/i, /\bos\b/i, /subprocess/i, /system/i, /\[/ , /\]/];

function renderBio(input: string, vault: string): string {
  // Deny dangerous SSTI gadgets — allow math and {{ vault }}
  for (const d of DENY) {
    if (d.test(input)) return '[rejected: filtered expression]';
  }
  let out = input;
  out = out.replace(/\{\{\s*(\d+)\s*\*\s*(\d+)\s*\}\}/g, (_, a, b) => String(Number(a) * Number(b)));
  out = out.replace(/\{\{\s*vault\s*\}\}/gi, vault || '[vault empty]');
  out = out.replace(/\{\{\s*user\.name\s*\}\}/gi, 'guest');
  if (/\{\{/.test(out)) return '[rejected: unknown placeholder]';
  return out;
}

export default function TemplateVaultChallenge() {
  const { player } = useApp();
  const [bio, setBio] = useState('Hello, my name is {{ user.name }}');
  const [rendered, setRendered] = useState('');
  const [vaultWord, setVaultWord] = useState('');

  async function preview() {
    unlockAudio();
    playClick();
    let vault = '';
    if (player) {
      try {
        const mat = await fetchChallengeLiveMaterial(player, ID);
        if (mat.ok && mat.material) {
          const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'vault');
          if (looksLikeToken(txt)) vault = txt;
        }
      } catch {
        /* ignore */
      }
    }
    const html = renderBio(bio, vault);
    setRendered(html);
    if (vault && html.includes(vault)) setVaultWord(vault);
    else setVaultWord('');
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Template Vault"
      blurb="Profile bios support friendly placeholders. Some expressions are rejected. Shell gadgets are rejected. Make the renderer print the vault line that already exists in server context."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full rounded border border-terminal-border bg-terminal-input p-2 font-mono text-xs text-terminal-green"
        />
        <button
          type="button"
          onClick={() => void preview()}
          className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
        >
          Render profile
        </button>
        {rendered && (
          <div className="rounded border border-terminal-border bg-black/30 p-3 text-terminal-dim">
            Preview: {rendered}
          </div>
        )}
        {vaultWord && (
          <p className="text-sm text-terminal-green">
            Vault line visible: <code className="font-mono text-terminal-amber">{vaultWord}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
