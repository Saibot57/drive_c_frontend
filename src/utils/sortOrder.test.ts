import { describe, expect, it } from 'vitest';
import { applyStoredOrder, moveId, nextStoredOrder, sanitizeIdList } from '@/utils/sortOrder';

describe('moveId', () => {
  it('flyttar före och efter', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'b', false)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 'c', true)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('lämnar listan orörd när målet är sig självt eller saknas', () => {
    expect(moveId(['a', 'b'], 'a', 'a', true)).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 'a', 'x', true)).toEqual(['a', 'b']);
  });
});

describe('applyStoredOrder', () => {
  it('följer sparad ordning och lägger nya sist', () => {
    expect(applyStoredOrder(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('hoppar över sparade id:n som inte finns', () => {
    expect(applyStoredOrder(['a', 'b'], ['x', 'b'])).toEqual(['b', 'a']);
  });
});

describe('nextStoredOrder', () => {
  it('behåller id:n som inte syns just nu', () => {
    expect(nextStoredOrder(['b', 'a'], ['a', 'x', 'b'])).toEqual(['b', 'a', 'x']);
  });
});

describe('sanitizeIdList', () => {
  it('tar bara unika strängar', () => {
    expect(sanitizeIdList(['a', 1, 'a', '', null, 'b'])).toEqual(['a', 'b']);
    expect(sanitizeIdList('a')).toEqual([]);
  });
});
