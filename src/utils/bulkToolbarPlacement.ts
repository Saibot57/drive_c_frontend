/**
 * Var massmarkeringens verktygsrad (penna och kryss) hamnar.
 *
 * Är markeringen samlad läggs raden mitt över den. Samlad betyder att rutan
 * runt de markerade korten inte täcker något omarkerat kort: tre samtidiga
 * poster, en förmiddag på samma dag eller två grannar över en dagsgräns. Då
 * hör raden tydligt till just de korten. Ligger markeringen spridd hade mitten
 * av rutan hamnat över poster som inte ingår, och raden läggs i stället mitt
 * i schemats nederkant. Dit läggs den också när de markerade korten är
 * utrullade ur bild, så att den alltid syns.
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

/** Kanter som bara nuddar räknas inte som överlapp. */
const overlaps = (a: Box, b: Box) => (
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
);

/** Täcker rutan runt de markerade korten inget av de andra? */
export function isGatheredSelection(selected: Box[], others: Box[]): boolean {
  const union = unionBox(selected);
  return union !== null && !others.some(other => overlaps(union, other));
}

const clamp = (value: number, min: number, max: number) => (
  // Är schemat smalare än raden vinner vänsterkanten.
  Math.max(min, Math.min(value, max))
);

/**
 * @param selected de markerade korten som står i schemat
 * @param others alla andra kort som står i schemat
 * @param viewport den synliga delen av schemat, under dagrubrikerna
 */
export function placeBulkToolbar(
  selected: Box[],
  others: Box[],
  viewport: Box,
  bar: BarSize,
  margin = BULK_TOOLBAR_MARGIN,
): BulkToolbarPlacement {
  const minLeft = viewport.left + margin;
  const maxLeft = viewport.right - margin - bar.width;
  const minTop = viewport.top + margin;
  const maxTop = viewport.bottom - margin - bar.height;

  const union = unionBox(selected);
  const inView = union !== null && union.bottom > viewport.top && union.top < viewport.bottom;

  if (union && inView && isGatheredSelection(selected, others)) {
    // Mitt över den del av markeringen som syns.
    const top = Math.max(union.top, viewport.top);
    const bottom = Math.min(union.bottom, viewport.bottom);
    return {
      left: clamp((union.left + union.right - bar.width) / 2, minLeft, maxLeft),
      top: clamp((top + bottom - bar.height) / 2, minTop, maxTop),
      anchored: true,
    };
  }

  return {
    left: clamp((viewport.left + viewport.right - bar.width) / 2, minLeft, maxLeft),
    top: Math.max(minTop, maxTop),
    anchored: false,
  };
}
