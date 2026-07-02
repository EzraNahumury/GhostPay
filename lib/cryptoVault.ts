/**
 * cryptoVault — client-side encryption for private Vault files.
 *
 * Approach: derive an AES-256-GCM key from a deterministic wallet signature over
 * a fixed domain message. Only the wallet owner can reproduce the signature, so
 * only they can decrypt. Blobs are encrypted BEFORE they touch IPFS, so the
 * public gateway only ever holds ciphertext.
 *
 * Tradeoff vs Lit Protocol: this gives real owner-only privacy with zero heavy
 * deps and works inside MiniPay. It does NOT do threshold key management or
 * third-party selective disclosure — the on-chain Compliance view-keys +
 * Lit access-control conditions are the future upgrade for auditor access.
 *
 * Caveat: relies on the wallet producing deterministic ECDSA signatures
 * (RFC 6979 — standard for MiniPay/Valora/most wallets). If a wallet randomizes
 * signatures, previously-encrypted files can't be re-derived.
 */

export const VAULT_SIGN_MESSAGE =
  "GhostPay Vault — sign to derive your private encryption key.\n" +
  "This does not cost gas and only proves wallet ownership.\n" +
  "v1";

const MAGIC = "GPV1";
const magicBytes = new TextEncoder().encode(MAGIC);

/** Derive a non-extractable AES-GCM key from a wallet signature (hex string). */
export async function deriveAesKey(signature: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(signature);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt bytes → [MAGIC(4)][iv(12)][ciphertext]. */
export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource),
  );
  const out = new Uint8Array(magicBytes.length + iv.length + ct.length);
  out.set(magicBytes, 0);
  out.set(iv, magicBytes.length);
  out.set(ct, magicBytes.length + iv.length);
  return out;
}

/** True if the blob was produced by encryptBytes. */
export function isEncrypted(data: Uint8Array): boolean {
  if (data.length < magicBytes.length + 12) return false;
  for (let i = 0; i < magicBytes.length; i++) {
    if (data[i] !== magicBytes[i]) return false;
  }
  return true;
}

/** Decrypt a blob produced by encryptBytes. */
export async function decryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = data.slice(magicBytes.length, magicBytes.length + 12);
  const ct = data.slice(magicBytes.length + 12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct as BufferSource);
  return new Uint8Array(pt);
}
