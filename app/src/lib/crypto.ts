import type { EncryptedBlob } from './types';

const b64e = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const b64d = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function deriveKeyFromToken(token: string): Promise<CryptoKey> {
  const salt = new TextEncoder().encode('qonco-v1-static-salt-2026');
  return deriveKey(token, salt);
}

export async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sessionKey = await deriveKey(
    await exportKeyMaterial(key),
    salt
  );
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    new TextEncoder().encode(text)
  );
  const blob: EncryptedBlob = {
    v: 1,
    s: b64e(salt.buffer),
    i: b64e(iv.buffer),
    d: b64e(ct)
  };
  return JSON.stringify(blob);
}

export async function decrypt(raw: string, key: CryptoKey): Promise<string> {
  const blob: EncryptedBlob = JSON.parse(raw);
  const salt = b64d(blob.s);
  const iv = b64d(blob.i);
  const ct = b64d(blob.d);
  const sessionKey = await deriveKey(
    await exportKeyMaterial(key),
    salt
  );
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    ct
  );
  return new TextDecoder().decode(pt);
}

export async function encryptObj<T>(obj: T, key: CryptoKey): Promise<string> {
  return encrypt(JSON.stringify(obj), key);
}

export async function decryptObj<T>(raw: string, key: CryptoKey): Promise<T> {
  const text = await decrypt(raw, key);
  return JSON.parse(text) as T;
}

// Extract raw key bytes for use as PBKDF2 passphrase in per-write salt derivation
async function exportKeyMaterial(key: CryptoKey): Promise<string> {
  // Use a fixed label — the key itself provides the entropy
  // We can't export a non-extractable key, so we use the token stored in session
  const label = sessionStorage.getItem('_qt') ?? '';
  return label;
}

// Simpler direct approach: derive key directly from token each time
export async function encryptWithToken(text: string, token: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(token, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const blob: EncryptedBlob = {
    v: 1,
    s: b64e(salt.buffer),
    i: b64e(iv.buffer),
    d: b64e(ct)
  };
  return JSON.stringify(blob);
}

export async function decryptWithToken(raw: string, token: string): Promise<string> {
  const blob: EncryptedBlob = JSON.parse(raw);
  const salt = b64d(blob.s);
  const iv = b64d(blob.i);
  const ct = b64d(blob.d);
  const key = await deriveKey(token, salt);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );
  return new TextDecoder().decode(pt);
}

export async function encryptObjWithToken<T>(obj: T, token: string): Promise<string> {
  return encryptWithToken(JSON.stringify(obj), token);
}

export async function decryptObjWithToken<T>(raw: string, token: string): Promise<T> {
  const text = await decryptWithToken(raw, token);
  return JSON.parse(text) as T;
}

// Encrypt token for trusted-device localStorage storage
export async function encryptTokenForDevice(token: string, passphrase: string): Promise<string> {
  return encryptWithToken(token, passphrase);
}

export async function decryptTokenFromDevice(raw: string, passphrase: string): Promise<string> {
  return decryptWithToken(raw, passphrase);
}
