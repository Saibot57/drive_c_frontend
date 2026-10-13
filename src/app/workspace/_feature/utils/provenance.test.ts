import { describe, expect, it } from 'vitest';
import type { ThemeWheel } from '@/types/themeWheel';
import { buildWheelParts } from './wheelExplode';
import { currentWheelPart, currentWheelParts, wheelPartSignature } from './provenance';

const wheel = (blocks: ThemeWheel['blocks']): ThemeWheel => ({
  id: 'w1',
  name: 'Läsåret',
  startWeek: 34,
  startYear: 2026,
  weekCount: 40,
  holidayWeeks: [],
  blocks,
});

const blocks: ThemeWheel['blocks'] = [
  { instanceId: 'a', title: 'Antiken', color: '#fde68a', startWeek: 0, endWeek: 6 },
  { instanceId: 'b', title: 'Medeltiden', color: '#bfdbfe', startWeek: 7, endWeek: 14 },
  { instanceId: 'c', title: 'Ringen ovanför', color: '#bbf7d0', startWeek: 3, endWeek: 9 },
];

describe('currentWheelPart', () => {
  it('ger samma del ur en gemensam uppslagning som en egen byggning', () => {
    const frozen = buildWheelParts(wheel(blocks), 'explode', '2026-01-01T00:00:00.000Z')
      .map((d) => d.content);
    const parts = currentWheelParts(wheel(blocks), 'explode');

    expect(frozen).toHaveLength(blocks.length);
    frozen.forEach((part) => {
      const fresh = currentWheelPart(parts, part);
      expect(fresh).toEqual(part);
    });
  });

  it('behåller kortets capturedAt', () => {
    const [part] = buildWheelParts(wheel(blocks), 'unroll', '2025-08-01T00:00:00.000Z');
    const fresh = currentWheelPart(currentWheelParts(wheel(blocks), 'unroll'), part.content);

    expect(fresh?.capturedAt).toBe('2025-08-01T00:00:00.000Z');
  });

  it('ger null när blocket är borta', () => {
    const [part] = buildWheelParts(wheel(blocks), 'explode');
    const parts = currentWheelParts(wheel(blocks.slice(1)), 'explode');

    expect(currentWheelPart(parts, part.content)).toBeNull();
  });

  it('ser en ändring i hjulet', () => {
    const [part] = buildWheelParts(wheel(blocks), 'explode');
    const renamed = blocks.map((b) => (b.instanceId === 'a' ? { ...b, title: 'Grekland' } : b));
    const fresh = currentWheelPart(currentWheelParts(wheel(renamed), 'explode'), part.content);

    expect(fresh && wheelPartSignature(fresh)).not.toBe(wheelPartSignature(part.content));
  });
});
