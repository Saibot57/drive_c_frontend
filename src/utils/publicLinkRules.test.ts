import { describe, expect, it } from 'vitest';
import type { ColorTriggerRule, PublicLinkDisplayConfig, RoomTriggerRule } from '@/types/schedule';
import { displayConfigFor, rulesSignature } from './publicLinkRules';

const color = (word: string): ColorTriggerRule => ({ id: `c-${word}`, word, color: 'red' });
const room = (word: string): RoomTriggerRule => ({ id: `r-${word}`, word, room: 'A1' });

const saved: PublicLinkDisplayConfig = {
  hiddenTitles: ['Lunch'],
  colorTriggers: [color('Matte')],
  roomTriggers: [room('Matte')],
};
const emptyHere = { colorTriggers: [], roomTriggers: [] };
const otherHere = { colorTriggers: [color('Svenska')], roomTriggers: [] };

describe('displayConfigFor', () => {
  // Dataintegritet F16: en dator utan reglerna tömde länkens färger och salar.
  it('behåller serverns regler när de inte ändrats här', () => {
    expect(displayConfigFor(['Rast'], saved, emptyHere, false)).toEqual({
      hiddenTitles: ['Rast'],
      colorTriggers: saved.colorTriggers,
      roomTriggers: saved.roomTriggers,
    });
  });

  it('skickar reglerna som ändrats på den här enheten', () => {
    expect(displayConfigFor(['Rast'], saved, otherHere, true)).toEqual({
      hiddenTitles: ['Rast'],
      ...otherHere,
    });
  });

  it('ger en ny länk den här enhetens regler', () => {
    expect(displayConfigFor([], null, otherHere, false)).toEqual({ hiddenTitles: [], ...otherHere });
  });
});

describe('rulesSignature', () => {
  it('är lika för samma regler i nya objekt', () => {
    expect(rulesSignature({ colorTriggers: [color('Matte')], roomTriggers: [] }))
      .toBe(rulesSignature({ colorTriggers: [color('Matte')], roomTriggers: [] }));
    expect(rulesSignature(otherHere)).not.toBe(rulesSignature(emptyHere));
  });
});
