import { describe, expect, it } from 'vitest';
import { MINDMAP_PALETTE, MINDMAP_PALETTE_ROWS } from './mindmapPalette';

describe('mindmapens palett', () => {
  it('har tre rader om tolv, med giltiga och olika färger', () => {
    expect(MINDMAP_PALETTE_ROWS.map((row) => row.length)).toEqual([12, 12, 12]);
    expect(MINDMAP_PALETTE).toHaveLength(36);
    MINDMAP_PALETTE.forEach((hex) => expect(hex).toMatch(/^#[0-9a-f]{6}$/));
    expect(new Set(MINDMAP_PALETTE).size).toBe(36);
    expect(MINDMAP_PALETTE).toEqual(MINDMAP_PALETTE_ROWS.flat().map((color) => color.hex));
  });
});
