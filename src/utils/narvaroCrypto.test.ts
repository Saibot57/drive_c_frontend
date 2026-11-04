import { describe, expect, it } from 'vitest';
import {
  DecryptError,
  WrongPassphraseError,
  createKeyInfo,
  decryptJson,
  encryptJson,
  keyMatches,
  parseKeyInfo,
  unlockKey,
} from '@/utils/narvaroCrypto';

// Få varv, så att testerna går fort. Riktiga nycklar använder PBKDF2_ITERATIONS.
const ITER = 1000;

describe('kryptering', () => {
  it('krypterar och dekrypterar, och chiffertexten röjer inget', async () => {
    const { key } = await createKeyInfo('en lång lösenfras', ITER);
    const value = { name: 'Amira Haddad', note: 'Behöver stöd' };
    const payload = await encryptJson(key, value);
    expect(payload).not.toContain('Amira');
    expect(payload).not.toContain('stöd');
    expect(await decryptJson(key, payload)).toEqual(value);
  });

  it('ger olika chiffertext för samma värde', async () => {
    const { key } = await createKeyInfo('en lång lösenfras', ITER);
    expect(await encryptJson(key, 'x')).not.toBe(await encryptJson(key, 'x'));
  });

  it('låser upp med rätt lösenfras och nekar fel', async () => {
    const { keyInfo } = await createKeyInfo('rätt lösenfras här', ITER);
    const stored = parseKeyInfo(JSON.stringify(keyInfo))!;
    const key = await unlockKey('rätt lösenfras här', stored);
    expect(await keyMatches(key, stored)).toBe(true);
    await expect(unlockKey('fel lösenfras här', stored)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('upptäcker ändrad chiffertext och fel nyckel', async () => {
    const a = await createKeyInfo('första lösenfrasen', ITER);
    const b = await createKeyInfo('andra lösenfrasen', ITER);
    const payload = await encryptJson(a.key, { x: 1 });
    await expect(decryptJson(b.key, payload)).rejects.toBeInstanceOf(DecryptError);
    const tampered = JSON.parse(payload);
    tampered.ct = tampered.ct.slice(0, -4) + (tampered.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(decryptJson(a.key, JSON.stringify(tampered))).rejects.toBeInstanceOf(DecryptError);
    await expect(decryptJson(a.key, 'inte json')).rejects.toBeInstanceOf(DecryptError);
  });

  it('läser bara giltig keyinfo', () => {
    expect(parseKeyInfo('{}')).toBeNull();
    expect(parseKeyInfo('trasig')).toBeNull();
    expect(parseKeyInfo(JSON.stringify({ v: 1, salt: 'a', iterations: 0, check: 'c' }))).toBeNull();
    expect(parseKeyInfo(JSON.stringify({ v: 1, salt: 'a', iterations: 5, check: 'c' })))
      .toEqual({ v: 1, salt: 'a', iterations: 5, check: 'c' });
  });
});
