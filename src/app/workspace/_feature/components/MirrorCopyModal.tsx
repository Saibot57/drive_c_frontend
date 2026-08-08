'use client';

import { useState } from 'react';
import { X, Link2, Copy } from 'lucide-react';
import type { Surface } from '../types/workspace.types';

interface MirrorCopyModalProps {
  isOpen: boolean;
  mode: 'mirror' | 'copy';
  surfaces: Surface[];
  currentSurfaceId: string;
  onConfirm: (targetSurfaceId: string) => void;
  onClose: () => void;
}

export default function MirrorCopyModal({
  isOpen,
  mode,
  surfaces,
  currentSurfaceId,
  onConfirm,
  onClose,
}: MirrorCopyModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!isOpen) return null;

  const targets = surfaces.filter((s) => s.id !== currentSurfaceId && !s.is_archived);
  const title = mode === 'mirror' ? 'Spegla till yta' : 'Kopiera till yta';
  const Icon = mode === 'mirror' ? Link2 : Copy;

  return (
    <div className="ws-overlay-backdrop" onClick={onClose}>
      <div className="ws-dialog ws-dialog--sm" onClick={(e) => e.stopPropagation()}>
        <div className="ws-dialog__header">
          <div className="ws-dialog__title">
            <Icon size={14} />
            {title}
          </div>
          <button className="ws-icon-btn" onClick={onClose} aria-label="Stäng">
            <X size={16} />
          </button>
        </div>

        <div className="ws-dialog__body">
          {targets.length === 0 ? (
            <p className="ws-dialog__empty">Inga andra ytor att välja</p>
          ) : (
            targets.map((s) => (
              <button
                key={s.id}
                className={`ws-surface-option ${selected === s.id ? 'ws-surface-option--selected' : ''}`}
                onClick={() => setSelected(s.id)}
              >
                {s.name}
              </button>
            ))
          )}
        </div>

        <div className="ws-dialog__footer">
          <button className="ws-btn" onClick={onClose}>
            Avbryt
          </button>
          <button
            className="ws-btn ws-btn--primary"
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onConfirm(selected);
                onClose();
              }
            }}
          >
            {mode === 'mirror' ? 'Spegla' : 'Kopiera'}
          </button>
        </div>
      </div>
    </div>
  );
}
