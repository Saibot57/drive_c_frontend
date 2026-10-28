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

  it('är spridd när omarkerade kort fyller rutan mellan de markerade', () => {
    const monday = box(50, 200, 150, 260);
    const friday = box(850, 600, 950, 660);
    const between = [box(220, 300, 320, 360), box(400, 200, 500, 500), box(600, 400, 700, 600)];
    expect(isGatheredSelection([monday, friday], between)).toBe(false);
  });

  it('är samlad när en enstaka omarkerad post ligger mitt i en markerad dag', () => {
    // Onsdag: tre spår 08:30, rast, tre spår 10:00, lunch (omarkerad),
    // klubben, rast och en lektion. Ett fjärde spår står utanför rutan.
    const selected = [
      box(0, 0, 160, 270), box(180, 0, 340, 270), box(360, 0, 520, 270),
      box(0, 280, 520, 330),
      box(0, 340, 160, 665), box(180, 340, 340, 665), box(360, 340, 520, 665),
      box(0, 900, 520, 1340),
      box(0, 1350, 520, 1400),
      box(0, 1410, 520, 1625),
    ];
    const lunch = box(0, 675, 520, 890);
    const fourthLane = box(540, 0, 700, 665);
    expect(isGatheredSelection(selected, [lunch, fourthLane])).toBe(true);
  });

  it('är spridd när två poster samma dag har flera omarkerade emellan', () => {
    const first = box(0, 0, 100, 100);
    const last = box(0, 500, 100, 600);
    const between = [box(0, 110, 100, 210), box(0, 220, 100, 320), box(0, 330, 100, 490)];
    expect(isGatheredSelection([first, last], between)).toBe(false);
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
    const between = [box(220, 300, 320, 360), box(400, 200, 500, 500)];
    expect(placeBulkToolbar(selected, between, viewport, bar)).toEqual(bottomCenter);
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
