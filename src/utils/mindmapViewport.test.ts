import { describe, expect, it, vi } from 'vitest';
import {
  applyWheel,
  centerOn,
  clampView,
  clampZoom,
  createFrameThrottle,
  DEFAULT_VIEW,
  fitToBounds,
  FIT_MARGIN,
  KEEP_VISIBLE,
  MAX_STORED_VIEWS,
  MAX_ZOOM,
  MIN_ZOOM,
  minimapFrame,
  minimapScale,
  nextZoomStep,
  panBy,
  rememberView,
  resolveViewportKey,
  revealRect,
  REVEAL_MARGIN,
  sanitizeMindmapViews,
  toWorld,
  viewFromMinimap,
  visibleRect,
  zoomAt,
  zoomTo,
  type MindmapView,
  type StoredMindmapViews,
} from './mindmapViewport';

const size = { width: 800, height: 600 };
/** En karta med roten i origo: 400 åt vänster, 1 600 åt höger. */
const bounds = { x: -400, y: -500, width: 2000, height: 1000 };

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

const wheel = (over: Partial<Parameters<typeof applyWheel>[1]>) => ({
  deltaX: 0,
  deltaY: 0,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...over,
});

describe('clampZoom', () => {
  it('håller zoomen mellan 25 och 300 %', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(7)).toBe(MAX_ZOOM);
    expect(clampZoom(1.3)).toBe(1.3);
    expect(MIN_ZOOM).toBe(0.25);
    expect(MAX_ZOOM).toBe(3);
  });

  it('ger 100 % för något som inte är ett tal', () => {
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('zoomAt', () => {
  it('håller punkten under pekaren stilla', () => {
    const view: MindmapView = { x: 120, y: -40, zoom: 0.8 };
    const point = { x: 333, y: 217 };
    const before = toWorld(view, point);
    const next = zoomAt(view, point, 1.7);
    const after = toWorld(next, point);
    expect(next.zoom).toBeCloseTo(1.36);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('håller punkten stilla också när zoomen slår i taket', () => {
    const view: MindmapView = { x: 10, y: 20, zoom: 2.5 };
    const point = { x: 400, y: 300 };
    const before = toWorld(view, point);
    const next = zoomAt(view, point, 4);
    expect(next.zoom).toBe(MAX_ZOOM);
    expect(toWorld(next, point).x).toBeCloseTo(before.x);
    expect(toWorld(next, point).y).toBeCloseTo(before.y);
  });

  it('stannar vid 25 % på väg ut', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 0.3 }, { x: 0, y: 0 }, 0.1).zoom).toBe(MIN_ZOOM);
  });
});

describe('zoomTo och nextZoomStep', () => {
  it('sätter en bestämd zoom kring en punkt', () => {
    const next = zoomTo({ x: 400, y: 300, zoom: 2 }, { x: 400, y: 300 }, 1);
    expect(next).toEqual({ x: 400, y: 300, zoom: 1 });
  });

  it('går ett steg i taget och stannar i ändarna', () => {
    expect(nextZoomStep(1, 1)).toBe(1.1);
    expect(nextZoomStep(1, -1)).toBe(0.9);
    expect(nextZoomStep(0.8, 1)).toBe(0.9);
    expect(nextZoomStep(0.8, -1)).toBe(0.75);
    expect(nextZoomStep(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(nextZoomStep(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
});

describe('fitToBounds', () => {
  it('visar hela kartan med marginal och centrerar den', () => {
    const view = fitToBounds(DEFAULT_VIEW, bounds, size);
    // Bredden styr: (800 - 2 * 32) / 2000.
    expect(view.zoom).toBeCloseTo((size.width - 2 * FIT_MARGIN) / bounds.width);
    const left = bounds.x * view.zoom + view.x;
    const right = (bounds.x + bounds.width) * view.zoom + view.x;
    const top = bounds.y * view.zoom + view.y;
    const bottom = (bounds.y + bounds.height) * view.zoom + view.y;
    expect(left).toBeCloseTo(FIT_MARGIN);
    expect(right).toBeCloseTo(size.width - FIT_MARGIN);
    expect(top).toBeGreaterThanOrEqual(FIT_MARGIN);
    expect(bottom).toBeLessThanOrEqual(size.height - FIT_MARGIN);
    expect(top).toBeCloseTo(size.height - bottom);
  });

  it('förstorar inte en liten karta över 100 %', () => {
    const small = { x: -50, y: -17, width: 100, height: 34 };
    const view = fitToBounds({ x: 9, y: 9, zoom: 0.5 }, small, size);
    expect(view).toEqual({ x: 400, y: 300, zoom: 1 });
  });

  it('går inte under 25 % för en jättekarta', () => {
    const huge = { x: 0, y: 0, width: 100000, height: 100000 };
    expect(fitToBounds(DEFAULT_VIEW, huge, size).zoom).toBe(MIN_ZOOM);
  });

  it('lämnar vyn när ytan saknar mått', () => {
    const view = { x: 5, y: 6, zoom: 2 };
    expect(fitToBounds(view, bounds, { width: 0, height: 0 })).toBe(view);
  });
});

describe('centerOn', () => {
  it('lägger noden i ytans mitt och behåller zoomen', () => {
    const node = { x: 300, y: -120, width: 80, height: 26 };
    const view = centerOn({ x: -999, y: 999, zoom: 1.5 }, node, size);
    expect(view.zoom).toBe(1.5);
    const center = toWorld(view, { x: size.width / 2, y: size.height / 2 });
    expect(center.x).toBeCloseTo(340);
    expect(center.y).toBeCloseTo(-107);
  });
});

describe('revealRect', () => {
  const view: MindmapView = { x: 400, y: 300, zoom: 1 };

  it('lämnar vyn orörd när noden redan syns', () => {
    expect(revealRect(view, { x: -40, y: -13, width: 80, height: 26 }, size)).toBe(view);
  });

  it('flyttar precis så mycket att noden syns med marginal', () => {
    // Nodens högerkant ligger på 400 + 500 + 80 = 980, utanför 800.
    const next = revealRect(view, { x: 500, y: 0, width: 80, height: 26 }, size);
    expect(580 * next.zoom + next.x).toBeCloseTo(size.width - REVEAL_MARGIN);
    expect(next.y).toBe(view.y);

    const up = revealRect(view, { x: 0, y: -400, width: 80, height: 26 }, size);
    expect(-400 * up.zoom + up.y).toBeCloseTo(REVEAL_MARGIN);
    expect(up.x).toBe(view.x);
  });

  it('räknar med zoomen', () => {
    const zoomed: MindmapView = { x: 400, y: 300, zoom: 2 };
    const next = revealRect(zoomed, { x: 300, y: 0, width: 80, height: 26 }, size);
    expect(380 * 2 + next.x).toBeCloseTo(size.width - REVEAL_MARGIN);
  });

  it('visar början av en nod som är bredare än ytan', () => {
    const next = revealRect(view, { x: 100, y: 0, width: 1000, height: 26 }, size);
    expect(100 + next.x).toBeCloseTo(0);
  });
});

describe('clampView', () => {
  it('lämnar en vy där kartan syns', () => {
    const view = { x: 400, y: 300, zoom: 1 };
    expect(clampView(view, bounds, size)).toBe(view);
  });

  it('håller en bit av kartan kvar åt alla håll', () => {
    const farRight = clampView({ x: 99999, y: 300, zoom: 1 }, bounds, size);
    expect(bounds.x + farRight.x).toBeCloseTo(size.width - KEEP_VISIBLE);
    const farLeft = clampView({ x: -99999, y: 300, zoom: 1 }, bounds, size);
    expect(bounds.x + bounds.width + farLeft.x).toBeCloseTo(KEEP_VISIBLE);
    const farDown = clampView({ x: 400, y: 99999, zoom: 0.5 }, bounds, size);
    expect(bounds.y * 0.5 + farDown.y).toBeCloseTo(size.height - KEEP_VISIBLE);
    const farUp = clampView({ x: 400, y: -99999, zoom: 0.5 }, bounds, size);
    expect((bounds.y + bounds.height) * 0.5 + farUp.y).toBeCloseTo(KEEP_VISIBLE);
  });

  it('låter en karta som är mindre än gränsen synas till hälften', () => {
    const tiny = { x: -10, y: -10, width: 20, height: 20 };
    const view = clampView({ x: -500, y: 300, zoom: 1 }, tiny, size);
    expect(view.x).toBeCloseTo(0);
  });
});

describe('visibleRect och panBy', () => {
  it('ger den del av kartan som syns', () => {
    expect(visibleRect({ x: 400, y: 300, zoom: 2 }, size)).toEqual({ x: -200, y: -150, width: 400, height: 300 });
  });

  it('flyttar vyn i skärmpixlar', () => {
    expect(panBy({ x: 1, y: 2, zoom: 2 }, 10, -5)).toEqual({ x: 11, y: -3, zoom: 2 });
  });
});

describe('applyWheel', () => {
  const view: MindmapView = { x: 100, y: 100, zoom: 1 };
  const point = { x: 250, y: 180 };

  it('panorerar med hjulet', () => {
    expect(applyWheel(view, wheel({ deltaY: 100 }), point, size)).toEqual({ x: 100, y: 0, zoom: 1 });
    expect(applyWheel(view, wheel({ deltaX: 30, deltaY: -20 }), point, size)).toEqual({ x: 70, y: 120, zoom: 1 });
  });

  it('går i sidled med Shift', () => {
    expect(applyWheel(view, wheel({ deltaY: 100, shiftKey: true }), point, size)).toEqual({ x: 0, y: 100, zoom: 1 });
  });

  it('räknar rader och sidor som pixlar', () => {
    expect(applyWheel(view, wheel({ deltaY: 3, deltaMode: 1 }), point, size).y).toBe(100 - 48);
    expect(applyWheel(view, wheel({ deltaY: 1, deltaMode: 2 }), point, size).y).toBe(100 - size.height);
  });

  it('zoomar kring pekaren med Ctrl', () => {
    const before = toWorld(view, point);
    const zoomedIn = applyWheel(view, wheel({ deltaY: -100, ctrlKey: true }), point, size);
    expect(zoomedIn.zoom).toBeGreaterThan(1);
    expect(toWorld(zoomedIn, point).x).toBeCloseTo(before.x);
    expect(toWorld(zoomedIn, point).y).toBeCloseTo(before.y);
    expect(applyWheel(view, wheel({ deltaY: 100, metaKey: true }), point, size).zoom).toBeLessThan(1);
  });

  it('begränsar ett enda hjulsteg', () => {
    expect(applyWheel(view, wheel({ deltaY: -100000, ctrlKey: true }), point, size).zoom).toBeCloseTo(1.5);
  });
});

describe('resolveViewportKey', () => {
  it('känner igen vyns kortkommandon med Ctrl eller Cmd', () => {
    expect(resolveViewportKey(key('0', { ctrlKey: true }))).toBe('fit');
    expect(resolveViewportKey(key('.', { metaKey: true }))).toBe('center');
    expect(resolveViewportKey(key('+', { ctrlKey: true }))).toBe('zoomIn');
    expect(resolveViewportKey(key('=', { ctrlKey: true }))).toBe('zoomIn');
    expect(resolveViewportKey(key('+', { ctrlKey: true, shiftKey: true }))).toBe('zoomIn');
    expect(resolveViewportKey(key('-', { ctrlKey: true }))).toBe('zoomOut');
  });

  it('släpper tangenter utan modifierare, så att de skriver i noden', () => {
    ['0', '.', '+', '-', '='].forEach((k) => expect(resolveViewportKey(key(k))).toBeNull());
  });

  it('släpper Alt och AltGr (Ctrl+Alt) och andra Ctrl-tangenter', () => {
    expect(resolveViewportKey(key('0', { altKey: true }))).toBeNull();
    expect(resolveViewportKey(key('0', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(resolveViewportKey(key('0', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(resolveViewportKey(key('z', { ctrlKey: true }))).toBeNull();
    expect(resolveViewportKey(key('7', { ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});

describe('minikartan', () => {
  const box = { width: 168, height: 112 };

  it('skalar kartan så att den ryms, men aldrig över taket', () => {
    expect(minimapScale(bounds, box)).toBeCloseTo(168 / 2000);
    expect(minimapScale({ x: 0, y: 0, width: 100, height: 4000 }, box)).toBeCloseTo(112 / 4000);
    expect(minimapScale({ x: 0, y: 0, width: 100, height: 34 }, box)).toBe(0.25);
  });

  it('ritar ramen runt det som syns', () => {
    const frame = minimapFrame({ x: 400, y: 300, zoom: 1 }, size, bounds, 0.1);
    // Syns: x -400..400, y -300..300. Kartan börjar på -400, -500.
    expect(frame).toEqual({ x: 0, y: 20, width: 80, height: 60 });
  });

  it('klipper ramen mot kartan och försvinner när inget syns', () => {
    const frame = minimapFrame({ x: 700, y: 300, zoom: 1 }, size, bounds, 0.1);
    expect(frame?.x).toBe(0);
    expect(frame?.width).toBeCloseTo(50);
    expect(minimapFrame({ x: 5000, y: 300, zoom: 1 }, size, bounds, 0.1)).toBeNull();
  });

  it('ett klick lägger den punkten i ytans mitt', () => {
    const view = viewFromMinimap({ x: 0, y: 0, zoom: 2 }, { x: 100, y: 50 }, bounds, 0.1, size);
    expect(view.zoom).toBe(2);
    const center = toWorld(view, { x: 400, y: 300 });
    expect(center.x).toBeCloseTo(600);
    expect(center.y).toBeCloseTo(0);
  });
});

describe('sanitizeMindmapViews', () => {
  it('behåller hela poster och kastar trasiga', () => {
    const clean = sanitizeMindmapViews({
      'a-1': { x: 10, y: -20, zoom: 1.5, at: 5 },
      b: { x: '10', y: 0, zoom: 1 },
      c: { x: 0, y: 0, zoom: Number.NaN },
      d: null,
      'e e': { x: 0, y: 0, zoom: 1, at: 1 },
      f: { x: 1, y: 2, zoom: 1 },
    });
    expect(clean).toEqual({
      'a-1': { x: 10, y: -20, zoom: 1.5, at: 5 },
      f: { x: 1, y: 2, zoom: 1, at: 0 },
    });
  });

  it('håller zoomen inom gränserna', () => {
    const clean = sanitizeMindmapViews({ a: { x: 0, y: 0, zoom: 40, at: 1 }, b: { x: 0, y: 0, zoom: 0, at: 1 } });
    expect(clean.a.zoom).toBe(MAX_ZOOM);
    expect(clean.b.zoom).toBe(MIN_ZOOM);
  });

  it('ger en tom lista för allt som inte är ett objekt', () => {
    [null, undefined, 'x', 3, [], [{ x: 0, y: 0, zoom: 1 }]].forEach((raw) => {
      expect(sanitizeMindmapViews(raw)).toEqual({});
    });
  });

  it('behåller bara de 50 senaste', () => {
    const raw: Record<string, unknown> = {};
    for (let i = 0; i < 70; i += 1) raw[`m${i}`] = { x: i, y: 0, zoom: 1, at: i };
    const clean = sanitizeMindmapViews(raw);
    expect(Object.keys(clean)).toHaveLength(MAX_STORED_VIEWS);
    expect(clean.m69).toBeDefined();
    expect(clean.m20).toBeDefined();
    expect(clean.m19).toBeUndefined();
  });
});

describe('rememberView', () => {
  it('lägger till och byter en kartas vy utan att ändra den gamla listan', () => {
    const first = rememberView({}, 'a', { x: 1, y: 2, zoom: 1 }, 100);
    const second = rememberView(first, 'a', { x: 3, y: 4, zoom: 2 }, 200);
    expect(first).toEqual({ a: { x: 1, y: 2, zoom: 1, at: 100 } });
    expect(second).toEqual({ a: { x: 3, y: 4, zoom: 2, at: 200 } });
  });

  it('kastar den äldsta när det blir fler än 50', () => {
    let views: StoredMindmapViews = {};
    for (let i = 0; i < MAX_STORED_VIEWS; i += 1) views = rememberView(views, `m${i}`, DEFAULT_VIEW, i + 1);
    // m0 är äldst, men används igen och blir då nyast.
    views = rememberView(views, 'm0', DEFAULT_VIEW, 1000);
    views = rememberView(views, 'ny', DEFAULT_VIEW, 1001);
    expect(Object.keys(views)).toHaveLength(MAX_STORED_VIEWS);
    expect(views.ny).toBeDefined();
    expect(views.m0).toBeDefined();
    expect(views.m1).toBeUndefined();
  });

  it('sparar inget under ett id som inte ser ut som ett', () => {
    const views = { a: { x: 0, y: 0, zoom: 1, at: 1 } };
    expect(rememberView(views, '', DEFAULT_VIEW, 2)).toBe(views);
    expect(rememberView(views, '__proto__ x', DEFAULT_VIEW, 2)).toBe(views);
  });
});

describe('createFrameThrottle', () => {
  /** Klocka och bildrutor som testet stegar för hand. */
  const fakeTimers = () => {
    let now = 0;
    let nextId = 1;
    const timeouts = new Map<number, { at: number; run: () => void }>();
    const frames = new Map<number, () => void>();
    return {
      timers: {
        now: () => now,
        setTimeout: (run: () => void, ms: number) => {
          timeouts.set(nextId, { at: now + ms, run });
          return nextId++;
        },
        clearTimeout: (handle: unknown) => { timeouts.delete(handle as number); },
        requestFrame: (run: () => void) => {
          frames.set(nextId, run);
          return nextId++;
        },
        cancelFrame: (handle: unknown) => { frames.delete(handle as number); },
      },
      /** Går fram i tiden; en bildruta ritas vid varje steg. */
      advance(ms: number) {
        now += ms;
        Array.from(timeouts).forEach(([id, t]) => {
          if (t.at <= now) {
            timeouts.delete(id);
            t.run();
          }
        });
        Array.from(frames).forEach(([id, run]) => {
          frames.delete(id);
          run();
        });
      },
    };
  };

  it('kör i nästa bildruta, och slår ihop flera beställningar', () => {
    const run = vi.fn();
    const clock = fakeTimers();
    const throttle = createFrameThrottle(run, 100, clock.timers);
    throttle.schedule();
    throttle.schedule();
    throttle.schedule();
    expect(run).not.toHaveBeenCalled();
    clock.advance(16);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('kör högst tio gånger i sekunden', () => {
    const run = vi.fn();
    const clock = fakeTimers();
    const throttle = createFrameThrottle(run, 100, clock.timers);
    // En beställning var femte millisekund i en sekund, som under en panorering.
    for (let t = 0; t < 1000; t += 5) {
      throttle.schedule();
      clock.advance(5);
    }
    expect(run.mock.calls.length).toBeLessThanOrEqual(10);
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('den sista beställningen körs alltid', () => {
    const run = vi.fn();
    const clock = fakeTimers();
    const throttle = createFrameThrottle(run, 100, clock.timers);
    throttle.schedule();
    clock.advance(16);
    throttle.schedule();
    clock.advance(50);
    expect(run).toHaveBeenCalledTimes(1);
    clock.advance(60);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cancel stoppar det som väntar', () => {
    const run = vi.fn();
    const clock = fakeTimers();
    const throttle = createFrameThrottle(run, 100, clock.timers);
    throttle.schedule();
    throttle.cancel();
    clock.advance(500);
    expect(run).not.toHaveBeenCalled();
    throttle.schedule();
    clock.advance(16);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
