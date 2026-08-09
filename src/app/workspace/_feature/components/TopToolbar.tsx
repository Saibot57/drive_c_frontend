'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Archive, Search, ArchiveRestore, Trash2, Pencil, Undo2, Download, Image as ImageIcon } from 'lucide-react';
import type { Surface } from '../types/workspace.types';
import type { SaveStatus } from '../hooks/useWorkspaceSync';
import SaveIndicator from './SaveIndicator';

interface TopToolbarProps {
  surfaces: Surface[];
  activeSurfaceId: string | null;
  saveStatus: SaveStatus;
  canUndo: boolean;
  onUndo: () => void;
  onSurfaceSelect: (id: string) => void;
  onSurfaceCreate: () => void;
  onSearchOpen: () => void;
  onArchiveSurface?: (id: string) => void;
  onUnarchiveSurface?: (id: string) => void;
  onDeleteSurface?: (id: string) => void;
  onRenameSurface?: (id: string, name: string) => void;
  onExportPdf?: () => void;
  onExportImage?: (format: 'png' | 'jpeg') => void;
}

export default function TopToolbar({
  surfaces,
  activeSurfaceId,
  saveStatus,
  canUndo,
  onUndo,
  onSurfaceSelect,
  onSurfaceCreate,
  onSearchOpen,
  onArchiveSurface,
  onUnarchiveSurface,
  onDeleteSurface,
  onRenameSurface,
  onExportPdf,
  onExportImage,
}: TopToolbarProps) {
  const activeSurfaces = surfaces.filter((s) => !s.is_archived);
  const archivedSurfaces = surfaces.filter((s) => s.is_archived);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ surfaceId: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const archiveRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameSurface?.(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (archiveRef.current && !archiveRef.current.contains(e.target as Node)) {
        setArchiveOpen(false);
      }
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="ws-toolbar">
      {/* Centered pill selector */}
      <div className="ws-toolbar-center">
        <div className="ws-surface-pill">
          {activeSurfaces.map((surface) => (
            renamingId === surface.id ? (
              <input
                key={surface.id}
                ref={renameInputRef}
                className={`ws-surface-pill__tab ws-surface-pill__tab--editing ${surface.id === activeSurfaceId ? 'ws-surface-pill__tab--active' : ''}`}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onBlur={commitRename}
                style={{ width: `${Math.max(renameValue.length, 3)}ch` }}
              />
            ) : (
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
            )
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
          className="ws-popover ws-popover--narrow"
          style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
        >
          <button
            className="ws-menu-item"
            onClick={() => {
              const surface = surfaces.find((s) => s.id === tabContextMenu.surfaceId);
              setRenameValue(surface?.name ?? '');
              setRenamingId(tabContextMenu.surfaceId);
              setTabContextMenu(null);
            }}
          >
            <span className="ws-menu-item__icon"><Pencil size={13} /></span>
            Byt namn
          </button>
          <button
            className="ws-menu-item"
            onClick={() => {
              onArchiveSurface?.(tabContextMenu.surfaceId);
              setTabContextMenu(null);
            }}
          >
            <span className="ws-menu-item__icon"><Archive size={13} /></span>
            Arkivera
          </button>
          <button
            className="ws-menu-item ws-menu-item--danger"
            onClick={() => {
              onDeleteSurface?.(tabContextMenu.surfaceId);
              setTabContextMenu(null);
            }}
          >
            <span className="ws-menu-item__icon"><Trash2 size={13} /></span>
            Ta bort
          </button>
        </div>
      )}

      {/* Right side: status, undo, archive, search */}
      <div className="ws-toolbar-right">
        <SaveIndicator status={saveStatus} />

        <button
          className={`ws-toggle-btn ${canUndo ? '' : 'ws-toggle-btn--dim'}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="Ångra (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>

        {onExportPdf && onExportImage && (
          <div className="ws-archive-anchor" ref={exportRef}>
            <button
              className="ws-toggle-btn"
              onClick={() => setExportOpen((open) => !open)}
              title="Exportera ytan"
            >
              <Download size={14} />
            </button>
            {exportOpen && (
              <div className="ws-popover ws-popover--anchored">
                <button
                  className="ws-menu-item"
                  onClick={() => { onExportPdf(); setExportOpen(false); }}
                >
                  <span className="ws-menu-item__icon"><Download size={13} /></span>
                  Spara PDF
                </button>
                <button
                  className="ws-menu-item"
                  onClick={() => { onExportImage('png'); setExportOpen(false); }}
                >
                  <span className="ws-menu-item__icon"><ImageIcon size={13} /></span>
                  Spara PNG
                </button>
                <button
                  className="ws-menu-item"
                  onClick={() => { onExportImage('jpeg'); setExportOpen(false); }}
                >
                  <span className="ws-menu-item__icon"><ImageIcon size={13} /></span>
                  Spara JPG
                </button>
              </div>
            )}
          </div>
        )}

        <div className="ws-archive-anchor" ref={archiveRef}>
          <button
            className={`ws-toggle-btn ${archivedSurfaces.length > 0 ? '' : 'ws-toggle-btn--dim'}`}
            onClick={() => setArchiveOpen(!archiveOpen)}
            title="Arkiverade ytor"
          >
            <Archive size={14} />
          </button>
          {archiveOpen && archivedSurfaces.length > 0 && (
            <div className="ws-popover ws-popover--anchored">
              <div className="ws-menu-header">Arkiverade</div>
              {archivedSurfaces.map((s) => (
                <div key={s.id} className="ws-archive-row">
                  <span>{s.name}</span>
                  <button
                    className="ws-archive-row__restore"
                    onClick={() => {
                      onUnarchiveSurface?.(s.id);
                      setArchiveOpen(false);
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
