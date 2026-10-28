'use client';

import { useEffect, useRef } from 'react';
import { useContextMenuPlacement } from '@/hooks/useContextMenuPlacement';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  const placementStyle = useContextMenuPlacement(ref, { x, y }, items.length);

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
      style={placementStyle}
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
