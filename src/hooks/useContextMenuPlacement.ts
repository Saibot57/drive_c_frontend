import { type CSSProperties, type RefObject, useLayoutEffect, useState } from 'react';
import { type MenuPlacement, placeContextMenu } from '@/utils/contextMenuPlacement';

/**
 * Placerar en högerklicksmeny (position: fixed) efter `placeContextMenu`:
 * nedåt från ett klick i fönstrets övre halva, uppåt från ett i den nedre.
 *
 * Menyn mäts före första målningen och är osynlig tills dess, så att den
 * aldrig syns på fel ställe. `contentKey` mäter om menyn när innehållet byts
 * utan att klickpunkten flyttas, t.ex. när antalet rader ändras.
 */
export function useContextMenuPlacement(
  ref: RefObject<HTMLElement>,
  anchor: { x: number; y: number } | null,
  contentKey?: unknown,
): CSSProperties {
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const x = anchor?.x;
  const y = anchor?.y;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || x === undefined || y === undefined) {
      setPlacement(null);
      return;
    }
    // Mät utan förra placeringen: en meny nära högerkanten kan ha tryckts
    // ihop, och en tidigare maxhöjd döljer den verkliga höjden.
    const { left, top, maxHeight } = node.style;
    node.style.left = '0px';
    node.style.top = '0px';
    node.style.maxHeight = 'none';
    const rect = node.getBoundingClientRect();
    node.style.left = left;
    node.style.top = top;
    node.style.maxHeight = maxHeight;

    setPlacement(placeContextMenu(
      x,
      y,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, [ref, x, y, contentKey]);

  if (!anchor) return {};
  if (!placement) return { left: anchor.x, top: anchor.y, visibility: 'hidden' };
  return {
    left: placement.left,
    top: placement.top,
    ...(placement.maxHeight ? { maxHeight: placement.maxHeight, overflowY: 'auto' } : {}),
  };
}
