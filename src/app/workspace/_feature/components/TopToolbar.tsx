'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Archive, Search, ArchiveRestore, Trash2, Pencil, Undo2, Download, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Surface } from '../types/workspace.types';
import type { SaveStatus } from '../hooks/useWorkspaceSync';
import SaveIndicator from './SaveIndicator';
import { moveId } from '../utils/surfaceOrder';

/** Så långt pekaren ska röra sig innan ett klick blir en dragning. */
const TAB_DRAG_THRESHOLD_PX = 5;

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
  /** De öppna ytornas id i den nya ordningen. */
  onReorderSurfaces?: (orderedIds: string[]) => void;
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
  onReorderSurfaces,
  onExportPdf,
  onExportImage,
}: TopToolbarProps) {
  const activeSurfaces = surfaces.filter((s) => !s.is_archived);
  const archivedSurfaces = surfaces.filter((s) => s.is_archived);
  const activeIds = activeSurfaces.map((s) => s.id);

  // Flikdragning. Ordningen förhandsvisas lokalt och skickas först vid släpp.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const tabRefs = useRef(new Map<string, HTMLElement>());
  // Klicket som följer på en dragning ska inte byta yta.
  const suppressClick = useRef(false);

  const startTabDrag = (e: React.PointerEvent, surfaceId: string) => {
    // Mus och penna. På pekskärm skulle det slåss med att scrolla sidan —
    // där flyttar man i stället via menyn.
    if (!onReorderSurfaces || e.button !== 0 || e.pointerType === 'touch') return;
    const startX = e.clientX;
    const startIds = activeIds;
    // Flikarnas mittpunkter som de låg när dragningen började. Att mäta om
    // under dragningen fick flikar av olika bredd att hoppa fram och tillbaka.
    const mids = startIds
      .filter((id) => id !== surfaceId)
      .map((id) => {
        const r = tabRefs.current.get(id)?.getBoundingClientRect();
        return r ? r.left + r.width / 2 : 0;
      });
    let order: string[] | null = null;

    const move = (ev: PointerEvent) => {
      if (!order) {
        if (Math.abs(ev.clientX - startX) < TAB_DRAG_THRESHOLD_PX) return;
        order = startIds;
        setDraggingId(surfaceId);
      }
      const index = mids.filter((mid) => mid < ev.clientX).length;
      order = moveId(order, surfaceId, index);
      setDragOrder(order);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (order) {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
        onReorderSurfaces(order);
      }
      setDragOrder(null);
      setDraggingId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const shiftSurface = (surfaceId: string, delta: number) => {
    onReorderSurfaces?.(moveId(activeIds, surfaceId, activeIds.indexOf(surfaceId) + delta));
  };

  const byId = new Map(activeSurfaces.map((s) => [s.id, s]));
  const tabs = dragOrder
    ? dragOrder.map((id) => byId.get(id)).filter((s): s is Surface => !!s)
    : activeSurfaces;

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
        <div className={`ws-surface-pill ${draggingId ? 'ws-surface-pill--dragging' : ''}`}>
          {tabs.map((surface) => (
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
                ref={(el) => {
                  if (el) tabRefs.current.set(surface.id, el);
                  else tabRefs.current.delete(surface.id);
                }}
                className={`ws-surface-pill__tab ${surface.id === activeSurfaceId ? 'ws-surface-pill__tab--active' : ''} ${surface.id === draggingId ? 'ws-surface-pill__tab--dragging' : ''}`}
                onPointerDown={(e) => startTabDrag(e, surface.id)}
                onClick={() => {
                  if (suppressClick.current) return;
                  onSurfaceSelect(surface.id);
                }}
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
          {onReorderSurfaces && activeIds.length > 1 && (
            <>
              <button
                className="ws-menu-item"
                disabled={activeIds[0] === tabContextMenu.surfaceId}
                onClick={() => {
                  shiftSurface(tabContextMenu.surfaceId, -1);
                  setTabContextMenu(null);
                }}
              >
                <span className="ws-menu-item__icon"><ChevronLeft size={13} /></span>
                Flytta vänster
              </button>
              <button
                className="ws-menu-item"
                disabled={activeIds[activeIds.length - 1] === tabContextMenu.surfaceId}
                onClick={() => {
                  shiftSurface(tabContextMenu.surfaceId, 1);
                  setTabContextMenu(null);
                }}
              >
                <span className="ws-menu-item__icon"><ChevronRight size={13} /></span>
                Flytta höger
              </button>
            </>
          )}
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
