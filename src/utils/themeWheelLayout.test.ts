import { describe, expect, it } from 'vitest';
import { ThemeBlock } from '@/types/themeWheel';
import { applyBlockPatch } from './themeWheelLayout';

const block = (instanceId: string, startWeek: number, endWeek: number, extra: Partial<ThemeBlock> = {}): ThemeBlock => ({
  instanceId,
  title: instanceId,
  color: '#bae6fd',
  startWeek,
  endWeek,
  ...extra,
});

const byId = (blocks: ThemeBlock[], id: string) => blocks.find(b => b.instanceId === id)!;

describe('applyBlockPatch', () => {
  it('lämnar listan orörd när inget ändras eller blocket saknas', () => {
    const blocks = [block('a', 0, 3)];
    expect(applyBlockPatch(blocks, 'a', { startWeek: 0 })).toBe(blocks);
    expect(applyBlockPatch(blocks, 'x', { startWeek: 2 })).toBe(blocks);
  });

  it('håller ett delområde inom föräldern och tar bort dess egen ring', () => {
    const blocks = [block('p', 2, 6), block('c', 3, 4, { parentId: 'p', ring: 2 })];
    const next = byId(applyBlockPatch(blocks, 'c', { startWeek: 0, endWeek: 9 }), 'c');
    expect([next.startWeek, next.endWeek]).toEqual([2, 6]);
    expect(next.ring).toBeUndefined();
  });

  it('avbryter en ändring som lägger ett delområde över ett syskon', () => {
    const blocks = [
      block('p', 0, 9),
      block('c1', 0, 2, { parentId: 'p' }),
      block('c2', 5, 6, { parentId: 'p' }),
    ];
    expect(applyBlockPatch(blocks, 'c1', { endWeek: 5 })).toBe(blocks);
    expect(byId(applyBlockPatch(blocks, 'c1', { endWeek: 4 }), 'c1').endWeek).toBe(4);
  });

  it('flyttar milstolpen med blocket och drar in den när blocket krymper', () => {
    const blocks = [block('a', 0, 4, { milestone: { label: 'Prov', week: 3 } })];
    expect(byId(applyBlockPatch(blocks, 'a', { startWeek: 2, endWeek: 6 }), 'a').milestone?.week).toBe(5);
    expect(byId(applyBlockPatch(blocks, 'a', { endWeek: 1 }), 'a').milestone?.week).toBe(1);
  });

  it('flyttar delområden med sitt arbetsområde och drar in dem när det krymper', () => {
    const blocks = [block('p', 0, 5), block('c', 1, 2, { parentId: 'p' }), block('other', 0, 1)];

    const moved = applyBlockPatch(blocks, 'p', { startWeek: 3, endWeek: 8 });
    expect([byId(moved, 'c').startWeek, byId(moved, 'c').endWeek]).toEqual([4, 5]);
    expect(byId(moved, 'other')).toBe(byId(blocks, 'other'));

    const shrunk = applyBlockPatch(blocks, 'p', { endWeek: 1 });
    expect([byId(shrunk, 'c').startWeek, byId(shrunk, 'c').endWeek]).toEqual([1, 1]);
  });
});
