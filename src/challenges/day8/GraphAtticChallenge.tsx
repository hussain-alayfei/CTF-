import { useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayeight';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd8_graph_attic';

type Schema = {
  queryType: { name: string };
  mutationType: { name: string };
  types: { name: string; fields?: { name: string; type: { name: string } }[] }[];
};

const SCHEMA: Schema = {
  queryType: { name: 'Query' },
  mutationType: { name: 'Mutation' },
  types: [
    {
      name: 'Query',
      fields: [
        { name: 'me', type: { name: 'User' } },
        { name: '__schema', type: { name: '__Schema' } },
      ],
    },
    {
      name: 'User',
      fields: [
        { name: 'name', type: { name: 'String' } },
        { name: 'avatar', type: { name: 'String' } },
        { name: 'createdAt', type: { name: 'String' } },
        { name: 'isStaff', type: { name: 'Boolean' } },
        { name: 'atticNote', type: { name: 'String' } },
      ],
    },
    {
      name: 'Mutation',
      fields: [{ name: 'setStaff', type: { name: 'Boolean' } }],
    },
  ],
};

export default function GraphAtticChallenge() {
  const { player } = useApp();
  const [query, setQuery] = useState('{ me { name avatar createdAt } }');
  const [out, setOut] = useState('');
  const [staff, setStaff] = useState(false);
  const [attic, setAttic] = useState('');

  async function run() {
    unlockAudio();
    playClick();
    const q = query.trim();
    if (q.includes('__schema') || q.includes('Introspection')) {
      setOut(JSON.stringify({ data: { __schema: SCHEMA } }, null, 2));
      return;
    }
    if (/setStaff\s*\(\s*true\s*\)/i.test(q) || /setStaff\s*\(\s*isStaff\s*:\s*true\s*\)/i.test(q)) {
      setStaff(true);
      setOut(JSON.stringify({ data: { setStaff: true } }, null, 2));
      return;
    }
    if (staff && /atticNote/i.test(q)) {
      if (!player) {
        setOut(JSON.stringify({ errors: [{ message: 'login required' }] }, null, 2));
        return;
      }
      try {
        const mat = await fetchChallengeLiveMaterial(player, ID);
        if (!mat.ok || !mat.material) return;
        const txt = await xorDecryptHex(String(mat.material.reveal_hex ?? ''), 'staff');
        if (looksLikeToken(txt)) {
          setAttic(txt);
          setOut(JSON.stringify({ data: { me: { atticNote: txt, isStaff: true } } }, null, 2));
        }
      } catch {
        setOut(JSON.stringify({ errors: [{ message: 'error' }] }, null, 2));
      }
      return;
    }
    if (/me\s*\{/.test(q)) {
      setOut(
        JSON.stringify(
          {
            data: {
              me: {
                name: 'guest',
                avatar: '/img/guest.png',
                createdAt: '2026-01-01',
                ...(staff ? { isStaff: true } : {}),
              },
            },
          },
          null,
          2,
        ),
      );
      return;
    }
    setOut(JSON.stringify({ errors: [{ message: 'Unknown query' }] }, null, 2));
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Graph Attic"
      blurb="Profiles load through a modern API. The card only shows public fields. The same endpoint can answer questions about its own shape. Elevate, then read the attic note."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          Endpoint: <code>/graphql</code> (simulated). Staff: {staff ? 'yes' : 'no'}
        </p>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          className="w-full rounded border border-terminal-border bg-terminal-input p-2 font-mono text-xs text-terminal-green"
        />
        <button
          type="button"
          onClick={() => void run()}
          className="rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-4 py-2 text-sm font-bold text-terminal-cyan"
        >
          Send
        </button>
        {out && (
          <pre className="max-h-48 overflow-auto rounded border border-terminal-border bg-black/40 p-2 text-[10px] text-terminal-dim">
            {out}
          </pre>
        )}
        {attic && (
          <p className="text-sm text-terminal-green">
            Attic: <code className="font-mono text-terminal-amber">{attic}</code>
          </p>
        )}
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
