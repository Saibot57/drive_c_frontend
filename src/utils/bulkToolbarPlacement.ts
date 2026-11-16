/**
 * Var massmarkeringens verktygsrad (penna och kryss) hamnar.
 *
 * Raden läggs mitt i rutan runt de markerade korten, alltså mitt emellan de
 * yttersta: med poster på måndag och fredag hamnar den på onsdag. Den kan då
 * stå över ett kort som inte ingår. Det är avsiktligt: raden är liten, och den
 * ska stå där markeringen är i stället för i schemats kant.
 *
 * Är en del av rutan utrullad räknas mitten på den del som syns. Syns ingen
 * del av den läggs raden mitt i schemats nederkant, så att den alltid går att
 * nå.
 *
 * Allt räknas i fönstrets koordinater, som `getBoundingClientRect` ger dem.
 */

export type Box = { left: number; top: number; right: number; bottom: number };

export type BarSize = { width: number; height: number };

export type BulkToolbarPlacement = { left: number; top: number; anchored: boolean };

/** Luft mot schemats kanter. */
export const BULK_TOOLBAR_MARGIN = 12;

export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((acc, box) => ({
    left: Math.min(acc.left, box.left),
    top: Math.min(acc.top, box.top),
    right: Math.max(acc.right, box.right),
    bottom: Math.max(acc.bottom, box.bottom),
  }));
}

const clamp = (value: number, min: number, max: number) => (
  // Är schemat smalare än raden vinner vänsterkanten.
  Math.max(min, Math.min(value, max))
);

/**
 * @param selected de markerade korten som står i schemat
 * @param viewport den synliga delen av schemat, under dagrubrikerna
 */
export function placeBulkToolbar(
  selected: Box[],
  viewport: Box,
  bar: BarSize,
  margin = BULK_TOOLBAR_MARGIN,
): BulkToolbarPlacement {
  const minLeft = viewport.left + margin;
  const maxLeft = viewport.right - margin - bar.width;
  const minTop = viewport.top + margin;
  const maxTop = viewport.bottom - margin - bar.height;

  const union = unionBox(selected);
  if (union) {
    // Den del av rutan som syns.
    const left = Math.max(union.left, viewport.left);
    const right = Math.min(union.right, viewport.right);
    const top = Math.max(union.top, viewport.top);
    const bottom = Math.min(union.bottom, viewport.bottom);
    if (left < right && top < bottom) {
      return {
        left: clamp((left + right - bar.width) / 2, minLeft, maxLeft),
        top: clamp((top + bottom - bar.height) / 2, minTop, maxTop),
        anchored: true,
      };
    }
  }

  return {
    left: clamp((viewport.left + viewport.right - bar.width) / 2, minLeft, maxLeft),
    top: Math.max(minTop, maxTop),
    anchored: false,
  };
}
