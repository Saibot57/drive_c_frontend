/**
 * Var en högerklicksmeny hamnar i förhållande till klicket.
 *
 * Menyn öppnas nedåt från ett klick i fönstrets övre halva och uppåt från ett
 * klick i den nedre, så att den hamnar där det finns mest plats. I sidled
 * öppnas den åt höger och vänder bara när den annars hade gått utanför
 * fönstret. Får menyn ändå inte plats skjuts den in från kanten, och är den
 * högre än hela fönstret läggs den i överkanten och får en maxhöjd att rulla
 * inom.
 */

export type MenuSize = { width: number; height: number };

export type Viewport = { width: number; height: number };

export type MenuPlacement = { left: number; top: number; maxHeight?: number };

/** Luft mot fönsterkanten. */
export const MENU_EDGE_MARGIN = 8;

export function placeContextMenu(
  x: number,
  y: number,
  menu: MenuSize,
  viewport: Viewport,
  margin = MENU_EDGE_MARGIN,
): MenuPlacement {
  let left = x;
  if (left + menu.width > viewport.width - margin) left = x - menu.width;
  left = Math.max(margin, Math.min(left, viewport.width - margin - menu.width));

  const available = viewport.height - margin * 2;
  if (menu.height > available) {
    return { left, top: margin, maxHeight: available };
  }

  const opensUpward = y > viewport.height / 2;
  let top = opensUpward ? y - menu.height : y;
  top = Math.max(margin, Math.min(top, viewport.height - margin - menu.height));
  return { left, top };
}
