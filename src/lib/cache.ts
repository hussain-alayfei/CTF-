// Stale-while-revalidate cache for the app's read paths.
//
// Every screen seeds its state from here so it paints instantly on refresh or on
// re-entry, while a live fetch runs underneath and overwrites it. sessionStorage
// (not localStorage) is deliberate: it is scoped to the tab and cleared when the
// tab closes, so nothing lingers on a shared classroom machine.
//
// Three rules keep a cache from becoming a liability:
//
//   VERSION  — bump it whenever a cached shape changes. A stale entry from an
//              older deploy is thrown away instead of being handed to code that
//              no longer understands it. (A cached event row from before
//              finale_stage existed is exactly the sort of thing that produces an
//              undefined-shaped bug three screens away.)
//   TTL      — an entry older than its TTL is ignored. The cache exists to avoid
//              a blank screen for a few hundred milliseconds, not to serve
//              yesterday's leaderboard to today's round.
//   SCOPE    — anything that isn't safe to sit in a DevTools-readable store (flags,
//              answers) must never be written here. Callers strip those first.
//
// Writes are best-effort by design: a full quota or a private-mode failure degrades
// to "no cache", never to a broken page.

const PREFIX = 'kgsp_ctf_cache:';

// Bump on any cached-shape change. v2: EventConfig gained finale_stage.
const VERSION = 2;

/** Entries older than this are treated as a miss. Long enough to cover a refresh
 *  or a navigation, far too short to survive into the next round. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface Entry<T> {
  v: number;
  t: number;
  d: T;
}

export function getCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    // Written by an older deploy, or by the pre-versioning cache — drop it.
    if (entry?.v !== VERSION || typeof entry.t !== 'number') {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    if (Date.now() - entry.t > ttlMs) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.d;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, value: T): void {
  try {
    const entry: Entry<T> = { v: VERSION, t: Date.now(), d: value };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded, private mode, or an unserializable value — caching is best-effort */
  }
}

/** Drop one key, or the whole cache. Used when an admin action invalidates
 *  everything (reset, day switch) and stale reads would be actively misleading. */
export function clearCache(key?: string): void {
  try {
    if (key) {
      sessionStorage.removeItem(PREFIX + key);
      return;
    }
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
