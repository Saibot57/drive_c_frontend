/**
 * Kryptering för Närvarorutor. Allt som sparas på servern krypteras här först,
 * så att servern aldrig ser elevnamn eller noteringar.
 *
 * - Nyckeln tas fram ur lösenfrasen med PBKDF2-SHA256 och ett slumpat salt.
 *   Saltet och antalet varv sparas på servern som `keyinfo`; de är inte
 *   hemliga.
 * - Varje dokument krypteras med AES-GCM-256 och en ny slumpad IV. GCM
 *   upptäcker om chiffertexten ändrats.
 * - `keyinfo` har också ett kontrollvärde, en känd text krypterad med
 *   nyckeln. Går den att dekryptera är lösenfrasen rätt.
 *
 * Glöms lösenfrasen går datan inte att få tillbaka. Det är meningen.
 */

/** OWASP:s rekommendation för PBKDF2-HMAC-SHA256 (2023). */
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 10;

const CHECK_TEXT = 'narvarorutor-v1';
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type KeyInfo = { v: 1; salt: string; iterations: number; check: string };

export class WrongPassphraseError extends Error {
  constructor() {
    super('Fel lösenfras.');
    this.name = 'WrongPassphraseError';
  }
}

export class DecryptError extends Error {
  constructor() {
    super('Kunde inte läsa det krypterade dokumentet.');
    this.name = 'DecryptError';
  }
}

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Webbläsaren saknar stöd för kryptering. Använd https och en nyare webbläsare.');
  return s;
};

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
};

const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Nyckeln går inte att läsa ut ur webbläsaren, bara att använda. */
export async function deriveKey(passphrase: string, salt: string, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Krypterar ett JSON-värde till en sträng: `{"v":1,"iv":…,"ct":…}`. */
export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, plain));
  return JSON.stringify({ v: 1, iv: toBase64(iv), ct: toBase64(ct) });
}

/** Dekrypterar det `encryptJson` gav. Kastar DecryptError om något inte stämmer. */
export async function decryptJson(key: CryptoKey, payload: string): Promise<unknown> {
  try {
    const parsed = JSON.parse(payload) as { v?: unknown; iv?: unknown; ct?: unknown };
    if (parsed.v !== 1 || typeof parsed.iv !== 'string' || typeof parsed.ct !== 'string') throw new DecryptError();
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(parsed.iv) }, key, fromBase64(parsed.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new DecryptError();
  }
}

export function parseKeyInfo(raw: string): KeyInfo | null {
  try {
    const k = JSON.parse(raw) as Partial<KeyInfo>;
    if (k.v !== 1 || typeof k.salt !== 'string' || typeof k.check !== 'string') return null;
    if (typeof k.iterations !== 'number' || !Number.isInteger(k.iterations) || k.iterations < 1) return null;
    return { v: 1, salt: k.salt, iterations: k.iterations, check: k.check };
  } catch {
    return null;
  }
}

/** Ny lösenfras: nytt salt, en nyckel och ett kontrollvärde. */
export async function createKeyInfo(
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<{ keyInfo: KeyInfo; key: CryptoKey }> {
  const salt = toBase64(randomBytes(SALT_BYTES));
  const key = await deriveKey(passphrase, salt, iterations);
  const check = await encryptJson(key, CHECK_TEXT);
  return { keyInfo: { v: 1, salt, iterations, check }, key };
}

/** Stämmer nyckeln mot kontrollvärdet? */
export async function keyMatches(key: CryptoKey, keyInfo: KeyInfo): Promise<boolean> {
  try {
    return (await decryptJson(key, keyInfo.check)) === CHECK_TEXT;
  } catch {
    return false;
  }
}

/** Nyckeln för lösenfrasen, eller WrongPassphraseError. */
export async function unlockKey(passphrase: string, keyInfo: KeyInfo): Promise<CryptoKey> {
  const key = await deriveKey(passphrase, keyInfo.salt, keyInfo.iterations);
  if (!(await keyMatches(key, keyInfo))) throw new WrongPassphraseError();
  return key;
}
