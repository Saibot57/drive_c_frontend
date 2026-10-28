import { describe, expect, it } from 'vitest';
import {
  BULK_TOOLBAR_MARGIN,
  Box,
  isGatheredSelection,
  placeBulkToolbar,
  unionBox,
} from './bulkToolbarPlacement';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

const viewport = box(0, 100, 1000, 800);
const bar = { width: 80, height: 40 };

// Tre samtidiga poster på måndagen (som i en kolumn med fyra spår) och en
// fjärde som inte är markerad.
const lanes = [box(50, 300, 90, 400), box(94, 300, 134, 400), box(138, 300, 178, 400)];
const fourthLane = box(182, 300, 222, 400);
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

describe('isGatheredSelection', () => {
  it('är samlad när bara grannspåret står bredvid', () => {
    expect(isGatheredSelection(lanes, [fourthLane])).toBe(true);
  });

  it('är spridd när ett omarkerat kort står mellan de markerade', () => {
    const monday = box(50, 200, 150, 260);
    const friday = box(850, 600, 950, 660);
    const tuesday = box(220, 300, 320, 360);
    expect(isGatheredSelection([monday, friday], [tuesday])).toBe(false);
  });

  it('räknar inte kanter som bara nuddar', () => {
    expect(isGatheredSelection([box(0, 0, 100, 100)], [box(100, 0, 200, 100), box(0, 100, 100, 200)])).toBe(true);
  });

  it('är alltid samlad med ett enda kort', () => {
    expect(isGatheredSelection([lanes[0]], [fourthLane])).toBe(true);
  });

  it('är inte samlad utan markerade kort', () => {
    expect(isGatheredSelection([], [fourthLane])).toBe(false);
  });
});

describe('placeBulkToolbar', () => {
  it('lägger raden mitt över en samlad markering', () => {
    expect(placeBulkToolbar(lanes, [fourthLane], viewport, bar)).toEqual({
      left: (50 + 178 - 80) / 2,
      top: (300 + 400 - 40) / 2,
      anchored: true,
    });
  });

  it('lägger raden mitt i nederkanten när markeringen är spridd', () => {
    const selected = [box(50, 200, 150, 260), box(850, 600, 950, 660)];
    expect(placeBulkToolbar(selected, [box(220, 300, 320, 360)], viewport, bar)).toEqual(bottomCenter);
  });

  it('centrerar på den del som syns när markeringen är delvis utrullad', () => {
    const tall = [box(400, 0, 500, 300)];
    expect(placeBulkToolbar(tall, [], viewport, bar).top).toBe((100 + 300 - 40) / 2);
  });

  it('lägger raden i nederkanten när markeringen är utrullad ur bild', () => {
    expect(placeBulkToolbar([box(400, 900, 500, 1000)], [], viewport, bar)).toEqual(bottomCenter);
    expect(placeBulkToolbar([box(400, 0, 500, 100)], [], viewport, bar)).toEqual(bottomCenter);
  });

  it('lägger raden i nederkanten när inget markerat kort står i schemat', () => {
    expect(placeBulkToolbar([], [fourthLane], viewport, bar)).toEqual(bottomCenter);
  });

  it('håller raden innanför schemats kanter', () => {
    const atEdge = placeBulkToolbar([box(0, 120, 20, 130)], [], viewport, bar);
    expect(atEdge.left).toBe(BULK_TOOLBAR_MARGIN);
    expect(atEdge.top).toBe(100 + BULK_TOOLBAR_MARGIN);
    const atRight = placeBulkToolbar([box(980, 780, 1000, 800)], [], viewport, bar);
    expect(atRight.left).toBe(1000 - BULK_TOOLBAR_MARGIN - 80);
    expect(atRight.top).toBe(800 - BULK_TOOLBAR_MARGIN - 40);
  });
});
