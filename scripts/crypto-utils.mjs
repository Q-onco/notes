// Shared crypto helpers — same scheme as app/src/lib/crypto.ts
import { webcrypto } from 'node:crypto';
export const crypto = webcrypto;

const b64e = buf => Buffer.from(buf).toString('base64');
const b64d = s => Uint8Array.from(Buffer.from(s, 'base64'));

async function deriveKey(passphrase, salt) {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encryptText(text, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(passphrase, salt);
  const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return JSON.stringify({ v: 1, s: b64e(salt), i: b64e(iv), d: b64e(new Uint8Array(ct)) });
}

export async function decryptText(blob, passphrase) {
  const { s, i, d } = JSON.parse(blob);
  const key = await deriveKey(passphrase, b64d(s));
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(i) }, key, b64d(d));
  return new TextDecoder().decode(pt);
}
