'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { PanelLeft, PanelRight, Link2, Copy, ArrowRightToLine, Trash2, Pencil } from 'lucide-react';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { WorkspaceProvider } from '../hooks/WorkspaceContext';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import TopToolbar from './TopToolbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import CanvasArea from './CanvasArea';
import CanvasElement from './CanvasElement';
import SearchOverlay from './SearchOverlay';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import MirrorCopyModal from './MirrorCopyModal';
import type { ElementType, ViewportState } from '../types/workspace.types';
import '../styles/workspace.css';

interface ElementContextState {
  elementId: string;
  placementId: string;
  x: number;
  y: number;
}

function WorkspaceInner() {
  const {
    state,
    dispatch,
    loadSurfaces,
    selectSurface,
    createSurface,
    createAndPlaceElement,
    updateElementContent,
    updateElementTitle,
    movePlacement,
    resizePlacement,
    toggleLock,
    moveToStorage,
    moveToCanvas,
    deleteElement,
    mirrorElement,
    copyElement,
    archiveSurface,
    unarchiveSurface,
    renameSurface,
    deleteSurface,
  } = useWorkspaceData();

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ElementContextState | null>(null);
  const [mirrorCopy, setMirrorCopy] = useState<{ elementId: string; mode: 'mirror' | 'copy' } | null>(null);
  const [renameEl, setRenameEl] = useState<{ elementId: string; x: number; y: number; value: string } | null>(null);
  const renameElRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (renameEl && renameElRef.current) {
      renameElRef.current.focus();
      renameElRef.current.select();
    }
  }, [renameEl?.elementId]);

  const commitElementRename = useCallback(() => {
    if (renameEl && renameEl.value.trim()) {
      updateElementTitle(renameEl.elementId, renameEl.value.trim());
    }
    setRenameEl(null);
  }, [renameEl, updateElementTitle]);

  const handleSearchNavigate = useCallback(
    async (surfaceId: string, elementId: string) => {
      await selectSurface(surfaceId);
      dispatch({ type: 'SELECT_ELEMENT', elementId });
    },
    [selectSurface, dispatch],
  );

  useEffect(() => {
    loadSurfaces();
  }, [loadSurfaces]);

  const handleViewportChange = useCallback(
    (vp: Partial<ViewportState>) => dispatch({ type: 'SET_VIEWPORT', viewport: vp }),
    [dispatch],
  );

  const handleSelectElement = useCallback(
    (elementId: string | null) => {
      dispatch({ type: 'SELECT_ELEMENT', elementId });
      setContextMenu(null);
    },
    [dispatch],
  );

  const handleSurfaceCreate = useCallback(async () => {
    const count = state.surfaces.length;
    await createSurface(`Yta ${count + 1}`);
  }, [state.surfaces.length, createSurface]);

  const handleCreateElement = useCallback(
    (type: ElementType) => {
      const container = canvasContainerRef.current;
      const w = container?.clientWidth ?? 800;
      const h = container?.clientHeight ?? 600;
      createAndPlaceElement(type, state.viewport, w, h);
    },
    [createAndPlaceElement, state.viewport],
  );

  const handleContextMenu = useCallback(
    (elementId: string, placementId: string, x: number, y: number) => {
      setContextMenu({ elementId, placementId, x, y });
    },
    [],
  );

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
        {
          label: 'Byt namn',
          icon: <Pencil size={13} />,
          onClick: () => {
            const el = state.elements[contextMenu.elementId];
            setRenameEl({
              elementId: contextMenu.elementId,
              x: contextMenu.x,
              y: contextMenu.y,
              value: el?.title ?? '',
            });
          },
        },
        { label: '', onClick: () => {}, divider: true },
        {
          label: 'Spegla till...',
          icon: <Link2 size={13} />,
          onClick: () => setMirrorCopy({ elementId: contextMenu.elementId, mode: 'mirror' }),
          disabled: state.surfaces.filter((s) => !s.is_archived).length <= 1,
        },
        {
          label: 'Kopiera till...',
          icon: <Copy size={13} />,
          onClick: () => setMirrorCopy({ elementId: contextMenu.elementId, mode: 'copy' }),
          disabled: state.surfaces.filter((s) => !s.is_archived).length <= 1,
        },
        { label: '', onClick: () => {}, divider: true },
        {
          label: 'Flytta till förråd',
          icon: <ArrowRightToLine size={13} />,
          onClick: () => moveToStorage(contextMenu.placementId),
        },
        { label: '', onClick: () => {}, divider: true },
        {
          label: 'Ta bort element',
          icon: <Trash2 size={13} />,
          onClick: () => deleteElement(contextMenu.elementId),
          danger: true,
        },
      ]
    : [];

  const canvasPlacements = state.placements.filter((p) => p.is_on_canvas);

  return (
    <div className="ws-root">
      {/* Feature navigation overlay */}
      <div style={{ position: 'fixed', top: 8, left: 8, zIndex: 50 }}>
        <FeatureNavigation />
      </div>

      {/* Top toolbar */}
      <TopToolbar
        surfaces={state.surfaces}
        activeSurfaceId={state.activeSurfaceId}
        onSurfaceSelect={selectSurface}
        onSurfaceCreate={handleSurfaceCreate}
        onSearchOpen={() => setSearchOpen(true)}
        onArchiveSurface={archiveSurface}
        onUnarchiveSurface={unarchiveSurface}
        onDeleteSurface={deleteSurface}
        onRenameSurface={renameSurface}
      />

      {/* Main area */}
      <div ref={canvasContainerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Toggle left */}
        {!state.isLeftSidebarOpen && (
          <button
            className="ws-toggle-btn"
            style={{ margin: '0.5rem 0.25rem' }}
            onClick={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
            title="Öppna sidebar"
          >
            <PanelLeft size={14} />
          </button>
        )}

        <LeftSidebar
          isOpen={state.isLeftSidebarOpen}
          onToggle={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
          onCreateElement={handleCreateElement}
          onCreateSurface={handleSurfaceCreate}
        />

        <CanvasArea
          viewport={state.viewport}
          onViewportChange={handleViewportChange}
          placements={state.placements}
          elements={state.elements}
          selectedElementId={state.selectedElementId}
          onSelectElement={handleSelectElement}
        >
          {canvasPlacements.map((p) => {
            const el = state.elements[p.element_id];
            if (!el) return null;
            return (
              <CanvasElement
                key={p.id}
                placement={p}
                element={el}
                isSelected={state.selectedElementId === el.id}
                zoom={state.viewport.zoom}
                onSelect={() => handleSelectElement(el.id)}
                onMove={movePlacement}
                onResize={resizePlacement}
                onToggleLock={toggleLock}
                onContentChange={updateElementContent}
                onContextMenu={(x, y) => handleContextMenu(el.id, p.id, x, y)}
              />
            );
          })}
        </CanvasArea>

        {/* Toggle right */}
        {!state.isRightSidebarOpen && (
          <button
            className="ws-toggle-btn"
            style={{ margin: '0.5rem 0.25rem' }}
            onClick={() => dispatch({ type: 'TOGGLE_RIGHT_SIDEBAR' })}
            title="Öppna sidebar"
          >
            <PanelRight size={14} />
          </button>
        )}

        <RightSidebar
          isOpen={state.isRightSidebarOpen}
          onToggle={() => dispatch({ type: 'TOGGLE_RIGHT_SIDEBAR' })}
          placements={state.placements}
          elements={state.elements}
          selectedElementId={state.selectedElementId}
          onSelectElement={(id) => handleSelectElement(id)}
          onMoveToStorage={moveToStorage}
          onMoveToCanvas={moveToCanvas}
        />
      </div>

      {/* Search overlay */}
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />

      {/* Element context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Element rename input */}
      {renameEl && (
        <div
          style={{
            position: 'fixed',
            left: renameEl.x,
            top: renameEl.y,
            zIndex: 200,
          }}
        >
          <input
            ref={renameElRef}
            value={renameEl.value}
            onChange={(e) => setRenameEl({ ...renameEl, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitElementRename();
              if (e.key === 'Escape') setRenameEl(null);
            }}
            onBlur={commitElementRename}
            style={{
              fontSize: '0.8125rem',
              padding: '0.375rem 0.5rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              background: '#ffffff',
              color: '#111827',
              outline: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: '10rem',
            }}
          />
        </div>
      )}

      {/* Mirror / Copy modal */}
      {mirrorCopy && (
        <MirrorCopyModal
          isOpen
          mode={mirrorCopy.mode}
          surfaces={state.surfaces}
          currentSurfaceId={state.activeSurfaceId || ''}
          onConfirm={(targetSurfaceId) => {
            if (mirrorCopy.mode === 'mirror') {
              mirrorElement(mirrorCopy.elementId, targetSurfaceId);
            } else {
              copyElement(mirrorCopy.elementId, targetSurfaceId);
            }
          }}
          onClose={() => setMirrorCopy(null)}
        />
      )}
    </div>
  );
}

export default function WorkspaceShell() {
  return (
    <ProtectedRoute>
      <WorkspaceProvider>
        <WorkspaceInner />
      </WorkspaceProvider>
    </ProtectedRoute>
  );
}
