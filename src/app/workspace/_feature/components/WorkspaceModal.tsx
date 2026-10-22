'use client';

import type React from 'react';
import { useMovableDialog } from '@/hooks/useMovableDialog';

interface WorkspaceModalProps {
  /** Namnet dialogens plats minns under, så länge sidan är öppen. */
  positionKey: string;
  /** Klick utanför dialogen. */
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Bakgrund och ruta för workspacens dialoger. Rutan dras i titelraden
 * (`data-dialog-handle` på `ws-dialog__header`) och flyttas med Ctrl+Cmd+pil,
 * som dialogerna i resten av appen.
 */
export default function WorkspaceModal({ positionKey, onClose, className, children }: WorkspaceModalProps) {
  const move = useMovableDialog({ positionKey });

  return (
    <div
      className={`ws-overlay-backdrop${move.moved ? ' ws-overlay-backdrop--light' : ''}`}
      onClick={onClose}
    >
      <div
        ref={move.ref}
        {...move.handlers}
        data-dialog-movable=""
        className={`ws-dialog ${className ?? ''}`}
        style={{ '--ws-dialog-x': `${move.offset.x}px`, '--ws-dialog-y': `${move.offset.y}px` } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
