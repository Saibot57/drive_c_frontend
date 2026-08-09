export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function screenToCanvas(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

/**
 * Ytan en sats element upptar tillsammans, för att kunna centrera den i vyn.
 *
 * Satserna har olika nollpunkt — en sprängning utgår från hjulets mitt, en
 * utrullning och en schemavecka från sitt vänstra hörn — så det går inte att
 * räkna på en ankarpunkt. Det som fungerar för alla är att mäta det de faktiskt
 * fyller.
 */
export function batchBounds(
  items: { offset: { x: number; y: number }; size: { width: number; height: number } }[],
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(...items.map((i) => i.offset.x));
  const y = Math.min(...items.map((i) => i.offset.y));
  return {
    x,
    y,
    width: Math.max(...items.map((i) => i.offset.x + i.size.width)) - x,
    height: Math.max(...items.map((i) => i.offset.y + i.size.height)) - y,
  };
}
