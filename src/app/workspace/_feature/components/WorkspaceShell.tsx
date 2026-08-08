'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { PanelLeft, PanelRight, Link2, Copy, ArrowRightToLine, Trash2, Pencil, EyeOff } from 'lucide-react';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { WorkspaceProvider } from '../hooks/WorkspaceContext';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { useUndoHotkey } from '../hooks/useWorkspaceHistory';
import TopToolbar from './TopToolbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import CanvasArea from './CanvasArea';
import CanvasElement from './CanvasElement';
import SearchOverlay from './SearchOverlay';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import MirrorCopyModal from './MirrorCopyModal';
import ConfirmDialog from './ConfirmDialog';
import type { ElementType, ViewportState, WorkspaceElement } from '../types/workspace.types';
// sp-root bär de delade neobrutalistiska tokens som schemat och temakalendern
// använder. Workspace läser dem i sina egna --ws-*-variabler, så att en ändring
// i det gemensamma temat slår igenom här utan att den här filen rörs.
import '@/styles/schedule-theme.css';
import '../styles/workspace.css';

interface ElementContextState {
  elementId: string;
  placementId: string;
  x: number;
  y: number;
}

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

function WorkspaceInner() {
  const {
    state,
    dispatch,
    plannerNotice,
    dismissNotice,
    saveStatus,
    canUndo,
    handleUndo,
    loadSurfaces,
    loadLibrary,
    placeFromLibrary,
    selectSurface,
    createSurface,
    createAndPlaceElement,
    updateElementContent,
    updateElementTitle,
    movePlacement,
    resizePlacement,
    commitMove,
    commitResize,
    toggleLock,
    moveToStorage,
    moveToCanvas,
    removePlacement,
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
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [renameEl, setRenameEl] = useState<{ elementId: string; x: number; y: number; value: string } | null>(null);
  const [libraryDrag, setLibraryDrag] = useState<
    { element: WorkspaceElement; x: number; y: number } | null
  >(null);
  const renameElRef = useRef<HTMLInputElement>(null);

  useUndoHotkey(handleUndo);

  /**
   * Dragning av ett bibliotekskort. Ett eget pekarlager i stället för dnd-kit,
   * eftersom släpppunkten måste räknas om genom canvasens pan och zoom — och
   * för att kortet på canvasen redan dras med samma sorts lager.
   */
  const handleLibraryPointerDown = useCallback(
    (element: WorkspaceElement, event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      setLibraryDrag({ element, x: event.clientX, y: event.clientY });

      const move = (e: PointerEvent) =>
        setLibraryDrag((current) => (current ? { ...current, x: e.clientX, y: e.clientY } : null));
      // Släpp utanför canvasen avbryter tyst. CanvasArea hinner köra sitt
      // onPointerUp först, eftersom React lyssnar på rotelementet.
      const up = () => {
        setLibraryDrag(null);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

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
    loadLibrary();
  }, [loadSurfaces, loadLibrary]);

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

  /** Ytradering är hård och går inte att ångra, så den bekräftas alltid. */
  const requestDeleteSurface = useCallback((surfaceId: string) => {
    const surface = state.surfaces.find((s) => s.id === surfaceId);
    const count = surface?.element_count ?? 0;
    setConfirm({
      title: 'Ta bort yta',
      body: count > 0
        ? `"${surface?.name ?? 'Ytan'}" och dess ${count} placerade element tas bort. Det går inte att ångra. Vill du behålla innehållet kan du arkivera ytan i stället.`
        : `"${surface?.name ?? 'Ytan'}" tas bort. Det går inte att ångra.`,
      confirmLabel: 'Ta bort ytan',
      danger: true,
      onConfirm: () => deleteSurface(surfaceId),
    });
  }, [state.surfaces, deleteSurface]);

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

  const requestDeleteElement = useCallback((elementId: string) => {
    // Elementet kan komma från biblioteket och ligga på en annan yta än den
    // som visas, så det räcker inte att titta i state.elements.
    const el =
      state.elements[elementId] ?? state.library.find((e) => e.id === elementId);
    const count = el?.surface_count ?? 1;
    // En radering som bara rör den yta man ser räcker det med en ångra-notis
    // för. Speglas elementet försvinner det däremot från ytor man inte har
    // framför sig, och då ska det sägas innan.
    if (count > 1) {
      setConfirm({
        title: 'Ta bort speglat element',
        body: `"${el?.title ?? 'Elementet'}" ligger på ${count} ytor och försvinner från alla. Du kan ångra direkt efteråt.`,
        confirmLabel: 'Ta bort överallt',
        danger: true,
        onConfirm: () => deleteElement(elementId),
      });
      return;
    }
    void deleteElement(elementId);
  }, [state.elements, state.library, deleteElement]);

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? (() => {
        const el = state.elements[contextMenu.elementId];
        const surfaceCount = el?.surface_count ?? 1;
        const otherSurfaces = state.surfaces.filter((s) => !s.is_archived).length <= 1;
        return [
          {
            label: 'Byt namn',
            icon: <Pencil size={13} />,
            onClick: () => {
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
            disabled: otherSurfaces,
          },
          {
            label: 'Kopiera till...',
            icon: <Copy size={13} />,
            onClick: () => setMirrorCopy({ elementId: contextMenu.elementId, mode: 'copy' }),
            disabled: otherSurfaces,
          },
          { label: '', onClick: () => {}, divider: true },
          {
            label: 'Flytta till förråd',
            icon: <ArrowRightToLine size={13} />,
            onClick: () => moveToStorage(contextMenu.placementId),
          },
          {
            label: 'Ta bort från den här ytan',
            icon: <EyeOff size={13} />,
            // Ligger elementet bara här skulle det bli oåtkomligt: det finns
            // kvar men syns ingenstans förrän biblioteket finns. Förrådet är
            // rätt väg i det läget.
            disabled: surfaceCount <= 1,
            onClick: () => removePlacement(contextMenu.placementId),
          },
          { label: '', onClick: () => {}, divider: true },
          {
            label: surfaceCount > 1 ? `Ta bort från alla ${surfaceCount} ytor` : 'Ta bort element',
            icon: <Trash2 size={13} />,
            onClick: () => requestDeleteElement(contextMenu.elementId),
            danger: true,
          },
        ];
      })()
    : [];

  const canvasPlacements = state.placements.filter((p) => p.is_on_canvas);

  return (
    <div className="ws-root sp-root">
      {/* Feature navigation overlay */}
      <div className="ws-nav-slot">
        <FeatureNavigation />
      </div>

      {/* Top toolbar */}
      <TopToolbar
        surfaces={state.surfaces}
        activeSurfaceId={state.activeSurfaceId}
        saveStatus={saveStatus}
        canUndo={canUndo}
        onUndo={handleUndo}
        onSurfaceSelect={selectSurface}
        onSurfaceCreate={handleSurfaceCreate}
        onSearchOpen={() => setSearchOpen(true)}
        onArchiveSurface={archiveSurface}
        onUnarchiveSurface={unarchiveSurface}
        onDeleteSurface={requestDeleteSurface}
        onRenameSurface={renameSurface}
      />

      {/* Main area */}
      <div ref={canvasContainerRef} className="ws-main">
        {/* Toggle left */}
        {!state.isLeftSidebarOpen && (
          <button
            className="ws-toggle-btn ws-toggle-btn--edge"
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
          library={state.library}
          onLibraryPointerDown={handleLibraryPointerDown}
          onDeleteElement={requestDeleteElement}
        />

        <CanvasArea
          viewport={state.viewport}
          onViewportChange={handleViewportChange}
          placements={state.placements}
          elements={state.elements}
          selectedElementId={state.selectedElementId}
          onSelectElement={handleSelectElement}
          isLibraryDragging={libraryDrag !== null}
          onLibraryDrop={(x, y) => {
            if (libraryDrag) void placeFromLibrary(libraryDrag.element.id, x, y);
          }}
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
                onMoveEnd={commitMove}
                onResizeEnd={commitResize}
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
            className="ws-toggle-btn ws-toggle-btn--edge"
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
        <div className="ws-inline-input-wrap" style={{ left: renameEl.x, top: renameEl.y }}>
          <input
            ref={renameElRef}
            className="ws-inline-input"
            value={renameEl.value}
            onChange={(e) => setRenameEl({ ...renameEl, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitElementRename();
              if (e.key === 'Escape') setRenameEl(null);
            }}
            onBlur={commitElementRename}
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

      {/* Bekräftelse före något oåterkalleligt */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {/* Spöke som följer pekaren medan ett bibliotekskort dras */}
      {libraryDrag && (
        <div
          className="ws-drag-ghost"
          style={{ left: libraryDrag.x, top: libraryDrag.y }}
        >
          {libraryDrag.element.title}
        </div>
      )}

      {/* Notis, med Ångra-knapp när åtgärden går att ta tillbaka */}
      {plannerNotice && (
        <div className={`ws-toast ws-toast--${plannerNotice.tone}`}>
          <span>{plannerNotice.message}</span>
          {plannerNotice.action && (
            <button className="ws-toast__action" onClick={plannerNotice.action.onClick}>
              {plannerNotice.action.label}
            </button>
          )}
        </div>
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
