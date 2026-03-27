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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '20rem',
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500, fontSize: '0.875rem' }}>
            <Icon size={14} style={{ color: '#6b7280' }} />
            {title}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Surface list */}
        <div style={{ padding: '0.5rem', maxHeight: '16rem', overflowY: 'auto' }}>
          {targets.length === 0 ? (
            <p style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.8125rem', textAlign: 'center' }}>
              Inga andra ytor att välja
            </p>
          ) : (
            targets.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: selected === s.id ? '1px solid #3b82f6' : '1px solid transparent',
                  background: selected === s.id ? '#eff6ff' : 'transparent',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  color: '#374151',
                  textAlign: 'left',
                }}
              >
                {s.name}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderTop: '1px solid #f3f4f6',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.8125rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              background: '#ffffff',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            Avbryt
          </button>
          <button
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onConfirm(selected);
                onClose();
              }
            }}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.8125rem',
              border: 'none',
              borderRadius: '0.375rem',
              background: selected ? '#3b82f6' : '#e5e7eb',
              color: selected ? '#ffffff' : '#9ca3af',
              cursor: selected ? 'pointer' : 'default',
            }}
          >
            {mode === 'mirror' ? 'Spegla' : 'Kopiera'}
          </button>
        </div>
      </div>
    </div>
  );
}
