'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

/** Luft mot fönsterkanten. */
const EDGE_MARGIN = 8;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Menyn öppnas nedåt och åt höger från klicket, men vänder när den annars
   * hade hamnat utanför fönstret. Den mäts före första målningen och är
   * osynlig tills dess, så att den aldrig syns på fel ställe. Är den högre än
   * hela fönstret läggs den i överkanten och får rulla.
   */
  const [placement, setPlacement] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // scrollHeight och inte rektangeln: har menyn redan fått en maxhöjd vid
    // en tidigare placering är rektangeln den klippta höjden, inte den verkliga.
    const width = node.getBoundingClientRect().width;
    const height = node.scrollHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x;
    if (left + width > vw - EDGE_MARGIN) left = Math.max(EDGE_MARGIN, x - width);

    let top = y;
    let maxHeight: number | undefined;
    if (top + height > vh - EDGE_MARGIN) {
      top = y - height;
      if (top < EDGE_MARGIN) {
        top = EDGE_MARGIN;
        maxHeight = vh - EDGE_MARGIN * 2;
      }
    }
    setPlacement({ left, top, maxHeight });
  }, [x, y, items.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="ws-popover"
      style={{
        left: placement?.left ?? x,
        top: placement?.top ?? y,
        visibility: placement ? 'visible' : 'hidden',
        ...(placement?.maxHeight ? { maxHeight: placement.maxHeight, overflowY: 'auto' } : {}),
      }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} className="ws-menu-divider" />;
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            className={`ws-menu-item ${item.danger ? 'ws-menu-item--danger' : ''}`}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon && <span className="ws-menu-item__icon">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
