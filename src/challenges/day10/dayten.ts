// Day 10 (Final CTF) live-lab helpers. Never put plaintext answers here.
export { xorDecryptHex, looksLikeToken, sha256Bytes, hexToBytes } from '@/challenges/day5/dayfive';

export function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}

/** Artifact download card used inside Day 10 labs (evidence stays in-lab). */
export function artifactHref(name: string): string {
  return `/challenges/day10/${name}`;
}
