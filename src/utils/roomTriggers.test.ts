import { describe, expect, it } from 'vitest';
import { createRoomResolver, findRoomTrigger, sanitizeRoomTriggers } from '@/utils/roomTriggers';
import { RoomTriggerRule } from '@/types/schedule';

const rule = (word: string, room: string): RoomTriggerRule => ({
  id: `${word}-${room}`,
  word,
  room
});

describe('createRoomResolver', () => {
  it('lämnar en ifylld sal orörd även när titeln matchar en regel', () => {
    const resolve = createRoomResolver([rule('idrott', 'Sporthallen')]);
    expect(resolve('Idrott åk 8', 'A12')).toBe('A12');
  });

  it('fyller tomma salfält från regeln', () => {
    const resolve = createRoomResolver([rule('idrott', 'Sporthallen')]);
    expect(resolve('Idrott åk 8', '')).toBe('Sporthallen');
    expect(resolve('Idrott åk 8', undefined)).toBe('Sporthallen');
  });

  it('behandlar blanktecken som tomt, så ett rensat fält går tillbaka till regeln', () => {
    const resolve = createRoomResolver([rule('idrott', 'Sporthallen')]);
    expect(resolve('Idrott åk 8', '   ')).toBe('Sporthallen');
  });

  it('ger tom sträng när ingen regel matchar', () => {
    const resolve = createRoomResolver([rule('idrott', 'Sporthallen')]);
    expect(resolve('Matte 1', '')).toBe('');
  });

  it('matchar hela ord, inte början av ord', () => {
    const resolve = createRoomResolver([rule('prov', 'Aulan')]);
    expect(resolve('Prov kap 3', '')).toBe('Aulan');
    expect(resolve('Provisorisk lösning', '')).toBe('');
  });

  it('kräver att ett flerordsvillkor står i följd', () => {
    const resolve = createRoomResolver([rule('nationellt prov', 'Aulan')]);
    expect(resolve('Nationellt prov svenska', '')).toBe('Aulan');
    expect(resolve('Prov om nationellt arv', '')).toBe('');
  });

  it('låter den översta regeln vinna när flera matchar', () => {
    const resolve = createRoomResolver([
      rule('prov', 'Aulan'),
      rule('idrott', 'Sporthallen')
    ]);
    expect(resolve('Idrott prov', '')).toBe('Aulan');
  });

  it('bryr sig inte om skiftläge eller skiljetecken', () => {
    const resolve = createRoomResolver([rule('PROV', 'Aulan')]);
    expect(resolve('Prov: kap 3', '')).toBe('Aulan');
  });

  it('klarar en tom regellista och en tom titel', () => {
    expect(createRoomResolver([])('Idrott', '')).toBe('');
    expect(createRoomResolver([rule('idrott', 'Sporthallen')])('', '')).toBe('');
  });
});

describe('sanitizeRoomTriggers', () => {
  it('slänger regler som saknar ord eller sal', () => {
    const cleaned = sanitizeRoomTriggers([
      { id: 'a', word: 'idrott', room: 'Sporthallen' },
      { id: 'b', word: '   ', room: 'Aulan' },
      { id: 'c', word: 'prov', room: '' },
      { id: 'd', word: 'slöjd' },
      null,
      'inte ett objekt'
    ]);
    expect(cleaned).toEqual([{ id: 'a', word: 'idrott', room: 'Sporthallen' }]);
  });

  it('trimmar och sätter ett id när det saknas', () => {
    expect(sanitizeRoomTriggers([{ word: '  idrott ', room: ' Sporthallen ' }])).toEqual([
      { id: 'room-trigger-0', word: 'idrott', room: 'Sporthallen' }
    ]);
  });

  it('ger en tom lista för allt som inte är en array', () => {
    expect(sanitizeRoomTriggers(undefined)).toEqual([]);
    expect(sanitizeRoomTriggers({ word: 'idrott' })).toEqual([]);
  });
});

describe('findRoomTrigger', () => {
  it('pekar ut regeln som styr titeln, för hinten i redigeringsrutan', () => {
    const triggers = [rule('idrott', 'Sporthallen')];
    expect(findRoomTrigger('Idrott åk 8', triggers)?.room).toBe('Sporthallen');
    expect(findRoomTrigger('Matte 1', triggers)).toBeNull();
  });
});
