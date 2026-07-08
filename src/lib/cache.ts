// Tiny sessionStorage-backed cache for stale-while-revalidate rendering.
//
// Pages seed their initial state from here so they paint instantly on remount
// (navigating away and back) or on a page refresh within the same tab, while a
// fresh network fetch still runs in the background to revalidate and overwrite.
// sessionStorage (not localStorage) is deliberate: it is scoped to the tab and
// cleared when the tab closes, so nothing lingers on shared machines.

const PREFIX = 'kgsp_ctf_cache:';

export function getCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded or serialization error — caching is best-effort */
  }
}
