import { describe, expect, it } from 'vitest';
import {
  BULK_TOOLBAR_MARGIN,
  Box,
  placeBulkToolbar,
  unionBox,
} from './bulkToolbarPlacement';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

const viewport = box(0, 100, 1000, 800);
const bar = { width: 80, height: 40 };

// Tre samtidiga poster på måndagen, som i en kolumn med flera spår.
const lanes = [box(50, 300, 90, 400), box(94, 300, 134, 400), box(138, 300, 178, 400)];
const bottomCenter = {
  left: (1000 - 80) / 2,
  top: 800 - BULK_TOOLBAR_MARGIN - 40,
  anchored: false,
};

describe('unionBox', () => {
  it('ger rutan runt alla', () => {
    expect(unionBox(lanes)).toEqual(box(50, 300, 178, 400));
  });

  it('ger null utan rutor', () => {
    expect(unionBox([])).toBeNull();
  });
});

describe('placeBulkToolbar', () => {
  it('lägger raden mitt över korten när de står intill varandra', () => {
    expect(placeBulkToolbar(lanes, viewport, bar)).toEqual({
      left: (50 + 178 - 80) / 2,
      top: (300 + 400 - 40) / 2,
      anchored: true,
    });
  });

  it('lägger raden mitt emellan de yttersta korten när markeringen är spridd', () => {
    const monday = box(50, 200, 150, 260);
    const friday = box(850, 600, 950, 660);
    expect(placeBulkToolbar([monday, friday], viewport, bar)).toEqual({
      left: (50 + 950 - 80) / 2,
      top: (200 + 660 - 40) / 2,
      anchored: true,
    });
  });

  it('räknar mitten på rutan, inte på korten', () => {
    // Fyra kort på måndagen drar inte raden från mitten mot fredagens enda.
    const mondays = [0, 1, 2, 3].map(i => box(50, 200 + i * 70, 150, 260 + i * 70));
    const friday = box(850, 200, 950, 260);
    expect(placeBulkToolbar([...mondays, friday], viewport, bar).left).toBe((50 + 950 - 80) / 2);
  });

  it('centrerar på den del som syns när markeringen är delvis utrullad', () => {
    const tall = [box(400, 0, 500, 300)];
    expect(placeBulkToolbar(tall, viewport, bar).top).toBe((100 + 300 - 40) / 2);
  });

  it('lägger raden i nederkanten när markeringen är utrullad ur bild', () => {
    expect(placeBulkToolbar([box(400, 900, 500, 1000)], viewport, bar)).toEqual(bottomCenter);
    expect(placeBulkToolbar([box(400, 0, 500, 100)], viewport, bar)).toEqual(bottomCenter);
  });

  it('centrerar i sidled på den del som syns', () => {
    const wide = [box(-400, 300, 200, 400)];
    expect(placeBulkToolbar(wide, viewport, bar).left).toBe((0 + 200 - 80) / 2);
  });

  it('lägger raden i nederkanten när markeringen står utanför i sidled', () => {
    expect(placeBulkToolbar([box(1100, 300, 1200, 400)], viewport, bar)).toEqual(bottomCenter);
  });

  it('lägger raden i nederkanten när inget markerat kort står i schemat', () => {
    expect(placeBulkToolbar([], viewport, bar)).toEqual(bottomCenter);
  });

  it('håller raden innanför schemats kanter', () => {
    const atEdge = placeBulkToolbar([box(0, 120, 20, 130)], viewport, bar);
    expect(atEdge.left).toBe(BULK_TOOLBAR_MARGIN);
    expect(atEdge.top).toBe(100 + BULK_TOOLBAR_MARGIN);
    const atRight = placeBulkToolbar([box(980, 780, 1000, 800)], viewport, bar);
    expect(atRight.left).toBe(1000 - BULK_TOOLBAR_MARGIN - 80);
    expect(atRight.top).toBe(800 - BULK_TOOLBAR_MARGIN - 40);
  });
});
