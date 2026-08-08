'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  /** Vad som faktiskt händer. Ska nämna omfattningen, inte bara "är du säker". */
  body: string;
  confirmLabel: string;
  /** Röd knapp och varningsikon. Används när det inte går att ångra. */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <div className="ws-overlay-backdrop" onClick={onClose}>
      <div className="ws-dialog ws-dialog--sm" onClick={(e) => e.stopPropagation()}>
        <div className="ws-dialog__header">
          <div className="ws-dialog__title">
            {danger && <AlertTriangle size={14} className="ws-dialog__title-warn" />}
            {title}
          </div>
        </div>

        <p className="ws-dialog__text">{body}</p>

        <div className="ws-dialog__footer">
          <button className="ws-btn" onClick={onClose} autoFocus>
            Avbryt
          </button>
          <button
            className={`ws-btn ${danger ? 'ws-btn--danger' : 'ws-btn--primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
