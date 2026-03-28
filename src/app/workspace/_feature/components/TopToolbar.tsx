'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Archive, Search, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Surface } from '../types/workspace.types';

interface TopToolbarProps {
  surfaces: Surface[];
  activeSurfaceId: string | null;
  onSurfaceSelect: (id: string) => void;
  onSurfaceCreate: () => void;
  onSearchOpen: () => void;
  onArchiveSurface?: (id: string) => void;
  onUnarchiveSurface?: (id: string) => void;
  onDeleteSurface?: (id: string) => void;
}

export default function TopToolbar({
  surfaces,
  activeSurfaceId,
  onSurfaceSelect,
  onSurfaceCreate,
  onSearchOpen,
  onArchiveSurface,
  onUnarchiveSurface,
  onDeleteSurface,
}: TopToolbarProps) {
  const activeSurfaces = surfaces.filter((s) => !s.is_archived);
  const archivedSurfaces = surfaces.filter((s) => s.is_archived);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ surfaceId: string; x: number; y: number } | null>(null);
  const archiveRef = useRef<HTMLDivElement>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (archiveRef.current && !archiveRef.current.contains(e.target as Node)) {
        setArchiveOpen(false);
      }
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="ws-toolbar">
      {/* Centered pill selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <div className="ws-surface-pill">
          {activeSurfaces.map((surface) => (
            <button
              key={surface.id}
              className={`ws-surface-pill__tab ${surface.id === activeSurfaceId ? 'ws-surface-pill__tab--active' : ''}`}
              onClick={() => onSurfaceSelect(surface.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setTabContextMenu({ surfaceId: surface.id, x: e.clientX, y: e.clientY });
              }}
            >
              {surface.name}
            </button>
          ))}
        </div>
        <button
          className="ws-surface-pill__add"
          onClick={onSurfaceCreate}
          title="Ny yta"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tab context menu */}
      {tabContextMenu && (
        <div
          ref={tabMenuRef}
          style={{
            position: 'fixed',
            left: tabContextMenu.x,
            top: tabContextMenu.y,
            zIndex: 200,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: '0.25rem 0',
            minWidth: '9rem',
            fontSize: '0.8125rem',
          }}
        >
          <button
            onClick={() => {
              onArchiveSurface?.(tabContextMenu.surfaceId);
              setTabContextMenu(null);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              width: '100%', padding: '0.375rem 0.75rem', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 'inherit', color: '#374151',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Archive size={13} style={{ color: '#9ca3af' }} />
            Arkivera
          </button>
          <button
            onClick={() => {
              onDeleteSurface?.(tabContextMenu.surfaceId);
              setTabContextMenu(null);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              width: '100%', padding: '0.375rem 0.75rem', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 'inherit', color: '#ef4444',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Trash2 size={13} style={{ color: '#ef4444' }} />
            Ta bort
          </button>
        </div>
      )}

      {/* Right side: archive + search */}
      <div className="ws-toolbar-right">
        <div style={{ position: 'relative' }} ref={archiveRef}>
          <button
            className="ws-toggle-btn"
            onClick={() => setArchiveOpen(!archiveOpen)}
            title="Arkiverade ytor"
            style={{ opacity: archivedSurfaces.length > 0 ? 1 : 0.4 }}
          >
            <Archive size={14} />
          </button>
          {archiveOpen && archivedSurfaces.length > 0 && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '0.25rem',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '0.25rem 0',
                minWidth: '12rem',
                fontSize: '0.8125rem',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '0.375rem 0.75rem', fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Arkiverade
              </div>
              {archivedSurfaces.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.375rem 0.75rem',
                  }}
                >
                  <span style={{ color: '#374151' }}>{s.name}</span>
                  <button
                    onClick={() => {
                      onUnarchiveSurface?.(s.id);
                      setArchiveOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#6b7280', fontSize: '0.6875rem',
                    }}
                    title="Återställ"
                  >
                    <ArchiveRestore size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="ws-toggle-btn" onClick={onSearchOpen} title="Sök">
          <Search size={14} />
        </button>
      </div>
    </div>
  );
}
