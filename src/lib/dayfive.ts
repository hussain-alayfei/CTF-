// Shared helpers for the Day 5 (Privacy) interactive challenges.
//
// Design note (anti-AI): the medium/hard challenges never ship the answer
// string in this bundle. For the fingerprint challenges the answer is stored
// ONLY as ciphertext in challenge_live_material, and the decryption key is
// derived at runtime from the player's REAL browser environment. The plaintext
// answer therefore materialises only inside a browser that has genuinely been
// reconfigured to match — it exists neither in the JS bundle nor in the RPC
// response. Pasting the page source into a chatbot yields nothing submittable.

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** SHA-256 of a UTF-8 string, as raw bytes. Matches Python hashlib.sha256(s.encode()).digest(). */
export async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

/**
 * Decrypt a hex ciphertext with a SHA-256 keystream derived from `keySeed`.
 * cipher[i] = plain[i] XOR sha256(keySeed)[i]. Answers are <= 32 bytes so a
 * single SHA-256 block is enough keystream. Returns the decoded UTF-8 string.
 */
export async function xorDecryptHex(cipherHex: string, keySeed: string): Promise<string> {
  const cipher = hexToBytes(cipherHex);
  const key = await sha256Bytes(keySeed);
  const out = new Uint8Array(cipher.length);
  for (let i = 0; i < cipher.length; i++) {
    out[i] = cipher[i] ^ key[i % key.length];
  }
  return bytesToText(out);
}

/** True if the decrypted bytes look like a valid answer token (printable ascii). */
export function looksLikeToken(s: string): boolean {
  return /^[\x20-\x7e]{3,40}$/.test(s) && /[a-z0-9]/i.test(s);
}
