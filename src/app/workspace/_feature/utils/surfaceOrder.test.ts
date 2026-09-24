import { describe, expect, it } from 'vitest';
import type { Surface } from '../types/workspace.types';
import { applySurfaceOrder, moveId, pickStartSurface } from './surfaceOrder';

function surface(id: string, sort_order: number, is_archived = false): Surface {
  return {
    id,
    user_id: 'u',
    name: id,
    sort_order,
    is_archived,
    viewport_x: 0,
    viewport_y: 0,
    viewport_zoom: 1,
    created_at: '',
    updated_at: '',
  };
}

describe('moveId', () => {
  it('flyttar framåt och bakåt', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('klämmer målet till listan', () => {
    expect(moveId(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a']);
    expect(moveId(['a', 'b', 'c'], 'c', -5)).toEqual(['c', 'a', 'b']);
  });

  it('lämnar listan orörd vid samma plats eller okänt id', () => {
    const ids = ['a', 'b', 'c'];
    expect(moveId(ids, 'b', 1)).toBe(ids);
    expect(moveId(ids, 'x', 0)).toBe(ids);
  });
});

describe('pickStartSurface', () => {
  const surfaces = [surface('a', 1), surface('b', 2), surface('c', 3, true)];

  it('väljer den senast öppnade', () => {
    expect(pickStartSurface(surfaces, 'b')?.id).toBe('b');
  });

  it('faller tillbaka på första fliken om den senaste är borta eller arkiverad', () => {
    expect(pickStartSurface(surfaces, 'gone')?.id).toBe('a');
    expect(pickStartSurface(surfaces, 'c')?.id).toBe('a');
    expect(pickStartSurface(surfaces, null)?.id).toBe('a');
  });

  it('ger ingenting när det inte finns någon öppen yta', () => {
    expect(pickStartSurface([surface('c', 1, true)], 'c')).toBeUndefined();
  });
});

describe('applySurfaceOrder', () => {
  it('numrerar om de öppna och lägger arkiverade sist', () => {
    const result = applySurfaceOrder(
      [surface('a', 1), surface('x', 2, true), surface('b', 3)],
      ['b', 'a'],
    );
    expect(result.map((s) => [s.id, s.sort_order])).toEqual([
      ['b', 1],
      ['a', 2],
      ['x', 2],
    ]);
  });
});
