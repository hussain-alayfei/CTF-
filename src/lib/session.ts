import type { Player } from './types';

const KEY = 'kgsp_ctf_player';

export function loadPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Player;
    if (p && p.id && p.token && p.username) {
      if (!p.avatar) p.avatar = '🕵️';
      if (typeof p.is_admin !== 'boolean') p.is_admin = false;
      if (p.admin_token === undefined) p.admin_token = null;
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePlayer(p: Player): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearPlayer(): void {
  localStorage.removeItem(KEY);
}
