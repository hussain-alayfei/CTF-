import { sha256Bytes } from '@/challenges/day5/dayfive';

// Day 7 (Web Applications) live-lab helpers. Never put plaintext answers here.
export { xorDecryptHex, looksLikeToken, sha256Bytes } from '@/challenges/day5/dayfive';

export async function sha256HexPrefix(input: string, n = 16): Promise<string> {
  const bytes = await sha256Bytes(input);
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, n);
}
