'use client';

import { useEffect, useRef } from 'react';

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
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 200,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: '0.25rem 0',
        minWidth: '10rem',
        fontSize: '0.8125rem',
      }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={i}
              style={{ height: 1, background: '#f3f4f6', margin: '0.25rem 0' }}
            />
          );
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.375rem 0.75rem',
              border: 'none',
              background: 'transparent',
              cursor: item.disabled ? 'default' : 'pointer',
              textAlign: 'left',
              color: item.danger ? '#ef4444' : item.disabled ? '#d1d5db' : '#374151',
              fontSize: 'inherit',
              borderRadius: 0,
            }}
            onMouseEnter={(e) => {
              if (!item.disabled)
                (e.currentTarget as HTMLElement).style.background = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {item.icon && (
              <span style={{ color: item.danger ? '#ef4444' : '#9ca3af', flexShrink: 0 }}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
