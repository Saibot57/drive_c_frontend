/*
 * Vyn på Mindmap-sidan: var kartan ligger i ytan och hur stor den ritas.
 * Rena funktioner; hooken useMindmapViewport håller läget och kartans lager
 * får `transform: translate(x, y) scale(zoom)`.
 *
 * Två koordinatsystem. Kartans ("världen") har rotnodens mitt i origo, så
 * att en sparad vy gäller också när kartan vuxit. Ytans är skärmpixlar från
 * ytans övre vänstra hörn. En punkt i kartan hamnar på
 * `yta = karta * zoom + (x, y)`.
 *
 * Planen: docs/plans/mindmap-sida.md, steg 3.
 */

export interface MindmapView {
  x: number;
  y: number;
  zoom: number;
}

export interface MindmapPoint {
  x: number;
  y: number;
}

export interface MindmapSize {
  width: number;
  height: number;
}

export interface MindmapRect extends MindmapPoint, MindmapSize {}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

/** Luft runt kartan när den passas in, i skärmpixlar. */
export const FIT_MARGIN = 32;
/** Luft runt den markerade noden när ytan följer med. */
export const REVEAL_MARGIN = 24;
/** Så mycket av kartan måste alltid synas, så att den inte går att tappa bort. */
export const KEEP_VISIBLE = 48;

/** Stegen för Ctrl++ och Ctrl+-. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

export const DEFAULT_VIEW: MindmapView = { x: 0, y: 0, zoom: 1 };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Punkten i kartan som ligger under en punkt i ytan. */
export function toWorld(view: MindmapView, point: MindmapPoint): MindmapPoint {
  return { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}

/** Den del av kartan som syns i ytan. */
export function visibleRect(view: MindmapView, size: MindmapSize): MindmapRect {
  return {
    x: -view.x / view.zoom,
    y: -view.y / view.zoom,
    width: size.width / view.zoom,
    height: size.height / view.zoom,
  };
}

export function panBy(view: MindmapView, dx: number, dy: number): MindmapView {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** Byter zoom så att punkten i ytan (pekaren) ligger kvar över samma ställe i kartan. */
export function zoomTo(view: MindmapView, point: MindmapPoint, zoom: number): MindmapView {
  const next = clampZoom(zoom);
  const world = toWorld(view, point);
  return { x: point.x - world.x * next, y: point.y - world.y * next, zoom: next };
}

/** Zoomar med en faktor kring en punkt i ytan. */
export function zoomAt(view: MindmapView, point: MindmapPoint, factor: number): MindmapView {
  return zoomTo(view, point, view.zoom * factor);
}

/** Nästa steg uppåt (1) eller nedåt (-1) från en zoomnivå. */
export function nextZoomStep(zoom: number, direction: 1 | -1): number {
  const eps = 0.001;
  if (direction > 0) return ZOOM_STEPS.find((step) => step > zoom + eps) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - eps) ?? MIN_ZOOM;
}

/**
 * Passar in hela kartan i ytan med marginal, centrerad. En liten karta
 * förstoras inte över 100 %: en ensam nod ska inte fylla skärmen.
 */
export function fitToBounds(
  view: MindmapView,
  bounds: MindmapRect,
  size: MindmapSize,
  margin: number = FIT_MARGIN,
): MindmapView {
  if (size.width <= 0 || size.height <= 0 || bounds.width <= 0 || bounds.height <= 0) return view;
  const roomX = Math.max(1, size.width - 2 * margin);
  const roomY = Math.max(1, size.height - 2 * margin);
  const zoom = clampZoom(Math.min(1, roomX / bounds.width, roomY / bounds.height));
  return centerOn({ ...view, zoom }, bounds, size);
}

/** Lägger rektangelns mitt (en nod, eller hela kartan) i ytans mitt. Zoomen behålls. */
export function centerOn(view: MindmapView, rect: MindmapRect, size: MindmapSize): MindmapView {
  return {
    zoom: view.zoom,
    x: size.width / 2 - (rect.x + rect.width / 2) * view.zoom,
    y: size.height / 2 - (rect.y + rect.height / 2) * view.zoom,
  };
}

/**
 * Flyttar vyn så lite som möjligt för att rektangeln (den markerade noden)
 * ska synas med marginal. Syns den redan kommer samma vy tillbaka. En nod som
 * är större än ytan läggs med början synlig.
 */
export function revealRect(
  view: MindmapView,
  rect: MindmapRect,
  size: MindmapSize,
  margin: number = REVEAL_MARGIN,
): MindmapView {
  const axis = (offset: number, start: number, length: number, room: number): number => {
    const pad = Math.min(margin, Math.max(0, (room - length * view.zoom) / 2));
    const lo = start * view.zoom + offset;
    const hi = lo + length * view.zoom;
    if (lo < pad || hi - lo > room - 2 * pad) return offset + (pad - lo);
    if (hi > room - pad) return offset + (room - pad - hi);
    return offset;
  };
  const x = axis(view.x, rect.x, rect.width, size.width);
  const y = axis(view.y, rect.y, rect.height, size.height);
  return x === view.x && y === view.y ? view : { ...view, x, y };
}

/** Håller en bit av kartan kvar i ytan, hur man än panorerar. */
export function clampView(
  view: MindmapView,
  bounds: MindmapRect,
  size: MindmapSize,
  keep: number = KEEP_VISIBLE,
): MindmapView {
  if (size.width <= 0 || size.height <= 0) return view;
  const axis = (offset: number, start: number, length: number, room: number): number => {
    const k = Math.min(keep, room / 2, (length * view.zoom) / 2);
    const min = k - (start + length) * view.zoom;
    const max = room - k - start * view.zoom;
    return Math.min(max, Math.max(min, offset));
  };
  const x = axis(view.x, bounds.x, bounds.width, size.width);
  const y = axis(view.y, bounds.y, bounds.height, size.height);
  return x === view.x && y === view.y ? view : { ...view, x, y };
}

export const sameView = (a: MindmapView, b: MindmapView): boolean =>
  a.x === b.x && a.y === b.y && a.zoom === b.zoom;

/* ── Hjulet ── */

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  /** 0 = pixlar, 1 = rader, 2 = sidor (WheelEvent.deltaMode). */
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const LINE_PX = 16;
/** Ett hack på ett vanligt mushjul (100 px) ger ungefär 18 %. */
const WHEEL_ZOOM_RATE = 0.002;
/** Ett enda hjulsteg får inte zooma mer än så här, hur stort deltat än är. */
const WHEEL_ZOOM_MAX = 1.5;

/** Ctrl+hjul (och nyp på styrplatta, som kommer som Ctrl+hjul) zoomar kring pekaren, annars panorerar hjulet. */
export function applyWheel(view: MindmapView, wheel: WheelInput, point: MindmapPoint, size: MindmapSize): MindmapView {
  const unit = wheel.deltaMode === 1 ? LINE_PX : wheel.deltaMode === 2 ? size.height : 1;
  const dx = wheel.deltaX * unit;
  const dy = wheel.deltaY * unit;
  if (wheel.ctrlKey || wheel.metaKey) {
    const factor = Math.exp(-dy * WHEEL_ZOOM_RATE);
    return zoomAt(view, point, Math.min(WHEEL_ZOOM_MAX, Math.max(1 / WHEEL_ZOOM_MAX, factor)));
  }
  // Shift+hjul går i sidled; en del webbläsare vänder inte på deltat själva.
  if (wheel.shiftKey && dx === 0) return panBy(view, -dy, 0);
  return panBy(view, -dx, -dy);
}

/* ── Tangenterna ── */

export type ViewportKeyAction = 'fit' | 'center' | 'zoomIn' | 'zoomOut';

export interface ViewportKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Vyns kortkommandon. Alla har Ctrl (Cmd på Mac): ett ensamt tecken skriver
 * över noden, se planens avsnitt 6. Ctrl+Shift+= är plus på tangentbord där
 * plus sitter på Shift.
 */
export function resolveViewportKey(e: ViewportKeyInput): ViewportKeyAction | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.key === '+' || e.key === '=') return 'zoomIn';
  if (e.key === '-' || e.key === '_') return 'zoomOut';
  if (e.shiftKey) return null;
  if (e.key === '0') return 'fit';
  if (e.key === '.') return 'center';
  return null;
}

/* ── Minikartan ── */

/** Skalan som får hela kartan att rymmas i minikartans ruta. Aldrig större än `max`. */
export function minimapScale(bounds: MindmapRect, box: MindmapSize, max = 0.25): number {
  if (bounds.width <= 0 || bounds.height <= 0) return max;
  return Math.min(max, box.width / bounds.width, box.height / bounds.height);
}

/**
 * Rutan i minikartan som visar vad som syns, i minikartans pixlar räknat från
 * kartbildens övre vänstra hörn. Klipps mot kartbilden; `null` om inget av
 * kartan syns.
 */
export function minimapFrame(
  view: MindmapView,
  size: MindmapSize,
  bounds: MindmapRect,
  scale: number,
): MindmapRect | null {
  const seen = visibleRect(view, size);
  const left = Math.max(seen.x, bounds.x);
  const top = Math.max(seen.y, bounds.y);
  const right = Math.min(seen.x + seen.width, bounds.x + bounds.width);
  const bottom = Math.min(seen.y + seen.height, bounds.y + bounds.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: (left - bounds.x) * scale,
    y: (top - bounds.y) * scale,
    width: (right - left) * scale,
    height: (bottom - top) * scale,
  };
}

/** Vyn som lägger punkten man klickade på i minikartan i ytans mitt. */
export function viewFromMinimap(
  view: MindmapView,
  point: MindmapPoint,
  bounds: MindmapRect,
  scale: number,
  size: MindmapSize,
): MindmapView {
  const world = { x: bounds.x + point.x / scale, y: bounds.y + point.y / scale };
  return centerOn(view, { ...world, width: 0, height: 0 }, size);
}

/* ── Sparade vyer (localStorage) ── */

export const MINDMAP_VIEW_KEY = 'mindmap.view.v1';
export const MAX_STORED_VIEWS = 50;

export interface StoredMindmapView extends MindmapView {
  /** När vyn senast ändrades (ms). Den äldsta kastas när listan är full. */
  at: number;
}

export type StoredMindmapViews = Record<string, StoredMindmapView>;

/** Kartans id kommer från servern (uuid); allt annat vore en trasig nyckel. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const trimToNewest = (entries: [string, StoredMindmapView][]): StoredMindmapViews =>
  Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, MAX_STORED_VIEWS));

/** Tvättar det som lästs ur localStorage. Trasiga poster faller bort, zoomen hålls inom gränserna. */
export function sanitizeMindmapViews(raw: unknown): StoredMindmapViews {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries: [string, StoredMindmapView][] = [];
  Object.entries(raw as Record<string, unknown>).forEach(([id, value]) => {
    if (!ID_PATTERN.test(id) || !value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    if (!finite(v.x) || !finite(v.y) || !finite(v.zoom)) return;
    entries.push([id, { x: v.x, y: v.y, zoom: clampZoom(v.zoom), at: finite(v.at) ? v.at : 0 }]);
  });
  return trimToNewest(entries);
}

/** Lägger in eller byter en kartas vy. Finns det fler än 50 kastas den äldsta. */
export function rememberView(views: StoredMindmapViews, id: string, view: MindmapView, now: number): StoredMindmapViews {
  if (!ID_PATTERN.test(id)) return views;
  const entries = Object.entries(views).filter(([key]) => key !== id);
  entries.push([id, { x: view.x, y: view.y, zoom: view.zoom, at: now }]);
  return trimToNewest(entries);
}

/* ── Minikartans takt ── */

export interface FrameThrottleTimers {
  now: () => number;
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  requestFrame: (run: () => void) => unknown;
  cancelFrame: (handle: unknown) => void;
}

const browserTimers = (): FrameThrottleTimers => ({
  now: () => Date.now(),
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  requestFrame: (run) => window.requestAnimationFrame(run),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle as number),
});

/**
 * Kör `run` i en bildruta, högst en gång per `intervalMs`. Flera
 * beställningar under väntan blir en körning. Minikartan ritas genom den här.
 */
export function createFrameThrottle(
  run: () => void,
  intervalMs: number,
  timers: FrameThrottleTimers = browserTimers(),
): { schedule: () => void; cancel: () => void } {
  let last = -Infinity;
  let timer: unknown = null;
  let frame: unknown = null;
  let waiting = false;

  const fire = () => {
    timer = null;
    frame = timers.requestFrame(() => {
      frame = null;
      waiting = false;
      last = timers.now();
      run();
    });
  };

  return {
    schedule() {
      if (waiting) return;
      waiting = true;
      const wait = Math.max(0, intervalMs - (timers.now() - last));
      if (wait === 0) fire();
      else timer = timers.setTimeout(fire, wait);
    },
    cancel() {
      if (timer !== null) timers.clearTimeout(timer);
      if (frame !== null) timers.cancelFrame(frame);
      timer = null;
      frame = null;
      waiting = false;
    },
  };
}
