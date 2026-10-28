import { describe, expect, it } from 'vitest';
import { MENU_EDGE_MARGIN, placeContextMenu } from './contextMenuPlacement';

const viewport = { width: 1200, height: 800 };
const menu = { width: 200, height: 300 };

describe('placeContextMenu', () => {
  it('öppnar nedåt och åt höger från ett klick i övre halvan', () => {
    expect(placeContextMenu(100, 100, menu, viewport)).toEqual({ left: 100, top: 100 });
  });

  it('öppnar uppåt från ett klick i nedre halvan, även när menyn hade fått plats nedåt', () => {
    expect(placeContextMenu(100, 450, menu, viewport)).toEqual({ left: 100, top: 150 });
  });

  it('öppnar nedåt från ett klick precis på mitten', () => {
    expect(placeContextMenu(100, 400, menu, viewport).top).toBe(400);
  });

  it('vänder åt vänster när menyn annars går utanför högerkanten', () => {
    expect(placeContextMenu(1100, 100, menu, viewport).left).toBe(900);
  });

  it('skjuts in från vänsterkanten när den inte får plats åt något håll', () => {
    const narrow = { width: 300, height: 800 };
    expect(placeContextMenu(200, 100, { width: 250, height: 100 }, narrow).left).toBe(MENU_EDGE_MARGIN);
  });

  it('skjuts ner från överkanten när den inte får plats uppåt', () => {
    expect(placeContextMenu(100, 500, { width: 200, height: 600 }, viewport).top).toBe(MENU_EDGE_MARGIN);
  });

  it('skjuts upp från nederkanten när den inte får plats nedåt', () => {
    const top = placeContextMenu(100, 300, { width: 200, height: 600 }, viewport).top;
    expect(top + 600).toBe(viewport.height - MENU_EDGE_MARGIN);
  });

  it('får en maxhöjd när den är högre än fönstret', () => {
    expect(placeContextMenu(100, 700, { width: 200, height: 1000 }, viewport)).toEqual({
      left: 100,
      top: MENU_EDGE_MARGIN,
      maxHeight: viewport.height - MENU_EDGE_MARGIN * 2,
    });
  });
});
