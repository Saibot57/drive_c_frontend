import { describe, expect, it } from 'vitest';
import { findExact, normalizeAutofill, uniquePrefixMatch } from './autocomplete';

const names = ['Anders Svensson', 'Anna Berg', 'Åsa Lind', 'Örjan Ek'];

describe('normalizeAutofill', () => {
  it('tar bort versaler, accenter och blanksteg runt om', () => {
    expect(normalizeAutofill('  Åsa ÖRJAN ')).toBe('asa orjan');
  });
});

describe('uniquePrefixMatch', () => {
  it('kräver minst tre tecken', () => {
    expect(uniquePrefixMatch('Ör', names)).toBeNull();
    expect(uniquePrefixMatch('Örj', names)).toBe('Örjan Ek');
  });

  it('ger inget när flera matchar', () => {
    expect(uniquePrefixMatch('an', names, 2)).toBeNull();
    expect(uniquePrefixMatch('ann', names)).toBe('Anna Berg');
  });

  it('bortser från versaler och accenter', () => {
    expect(uniquePrefixMatch('ASA', names)).toBe('Åsa Lind');
    expect(uniquePrefixMatch('orj', names)).toBe('Örjan Ek');
  });

  it('matchar bara början av hela namnet', () => {
    expect(uniquePrefixMatch('Svensson', names)).toBeNull();
  });

  it('ger inget när inget matchar eller listan är tom', () => {
    expect(uniquePrefixMatch('Bertil', names)).toBeNull();
    expect(uniquePrefixMatch('Anders', [])).toBeNull();
  });

  it('räknar inte blanksteg runt texten', () => {
    expect(uniquePrefixMatch('  An ', names)).toBeNull();
    expect(uniquePrefixMatch(' And', names)).toBe('Anders Svensson');
  });
});

describe('findExact', () => {
  it('hittar namnet oavsett versaler och blanksteg', () => {
    expect(findExact(' anna berg ', names)).toBe('Anna Berg');
  });

  it('ger inget för en del av ett namn eller tom text', () => {
    expect(findExact('Anna', names)).toBeNull();
    expect(findExact('  ', names)).toBeNull();
  });
});
