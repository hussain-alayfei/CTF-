import { useEffect, useState } from 'react';
import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';
import { useApp } from '@/lib/app-context';
import { fetchChallengeLiveMaterial } from '@/lib/api';
import { looksLikeToken, xorDecryptHex } from './dayten';
import { playClick, unlockAudio } from '@/lib/sounds';

const ID = 'd10_secret_album';
const MY_ID = 105;

const ALBUMS: Record<number, { title: string; private?: boolean; note?: string }> = {
  101: { title: 'Team picnic' },
  102: { title: 'Office plants' },
  103: { title: 'Ship day' },
  104: { title: 'Admin private', private: true, note: 'admin' },
  105: { title: 'Your album' },
  106: { title: 'Empty draft' },
};

/** Medium: sequential album IDOR. */
export default function SecretAlbumChallenge() {
  const { player } = useApp();
  const [id, setId] = useState(MY_ID);
  const [plaque, setPlaque] = useState('');
  const album = ALBUMS[id];

  useEffect(() => {
    let alive = true;
    setPlaque('');
    if (!album?.private || !player) return;
    fetchChallengeLiveMaterial(player, ID)
      .then(async (r) => {
        if (!r.ok || !r.material?.reveal_hex) return;
        const txt = await xorDecryptHex(String(r.material.reveal_hex), '104');
        if (alive && looksLikeToken(txt)) setPlaque(txt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [album, player]);

  function openAlbum(next: number) {
    unlockAudio();
    playClick();
    setId(next);
  }

  return (
    <ChallengeFrame
      challengeId={ID}
      title="Admin Album"
      blurb="Albums are served as /view?id=N with sequential numbers. Your album is 105. Walk the id window until the administrator's private album opens."
    >
      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm">
        <p className="text-terminal-dim">
          api_routes.md — album ids increment by one. Yours: <code className="text-terminal-amber">{MY_ID}</code>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs uppercase text-terminal-dim">id</label>
          <input
            type="number"
            value={id}
            onChange={(e) => openAlbum(Number(e.target.value))}
            className="w-24 rounded border border-terminal-border bg-terminal-input px-2 py-1 font-mono text-terminal-green"
          />
          <button
            type="button"
            onClick={() => openAlbum(id - 1)}
            className="rounded border border-terminal-border px-2 py-1 text-xs"
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => openAlbum(id + 1)}
            className="rounded border border-terminal-border px-2 py-1 text-xs"
          >
            +1
          </button>
        </div>
        <div className="mt-4 rounded border border-terminal-border/60 p-3">
          {album ? (
            <>
              <p className="font-semibold text-terminal-green">{album.title}</p>
              {album.private ? (
                <p className="mt-2 text-terminal-amber">Private album unlocked.</p>
              ) : (
                <p className="mt-2 text-xs text-terminal-dim">Public thumbnails only.</p>
              )}
              {plaque && (
                <p className="mt-2 text-sm text-terminal-green">
                  Seal: <code className="font-mono text-terminal-amber">{plaque}</code>
                </p>
              )}
            </>
          ) : (
            <p className="text-terminal-red">No album for this id.</p>
          )}
        </div>
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
