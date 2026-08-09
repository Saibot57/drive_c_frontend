'use client';

import { useCallback, useRef, useState } from 'react';
import type { ViewportState, SurfaceElement, WorkspaceElement } from '../types/workspace.types';
import { clamp, screenToCanvas } from '../types/utils';
import { MIN_ZOOM, MAX_ZOOM, WHEEL_REF_TEXT_MIN_ZOOM } from '../types/constants';
import ZoomControls from './ZoomControls';

interface CanvasAreaProps {
  viewport: ViewportState;
  onViewportChange: (viewport: Partial<ViewportState>) => void;
  placements: SurfaceElement[];
  elements: Record<string, WorkspaceElement>;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  /** Ramar in allt på ytan. Ctrl+0. */
  onZoomToContent?: () => void;
  /** Sant medan ett bibliotekskort dras. Aktiverar släppzonen. */
  isLibraryDragging?: boolean;
  /** Släpp av ett bibliotekskort, i canvasens koordinater. */
  onLibraryDrop?: (canvasX: number, canvasY: number) => void;
  /** Elementet som bär transformen. Exporten ställer om det tillfälligt. */
  viewportRef?: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
}

export default function CanvasArea({
  viewport,
  onViewportChange,
  selectedElementId,
  onSelectElement,
  onZoomToContent,
  isLibraryDragging = false,
  onLibraryDrop,
  viewportRef,
  children,
}: CanvasAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Aktiva pekare. En räcker för panorering, två blir nyp-zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2) {
        // Andra fingret ner: sluta panorera och börja nypa.
        const [a, b] = Array.from(pointers.current.values());
        pinch.current = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: viewport.zoom,
        };
        setIsPanning(false);
        panStart.current = null;
        return;
      }

      // Mittenknapp, eller vänster/finger direkt på bakgrunden.
      if (e.button === 1 || (e.button === 0 && e.target === containerRef.current)) {
        setIsPanning(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: viewport.panX,
          panY: viewport.panY,
        };
        onSelectElement(null);
      }
    },
    [viewport.panX, viewport.panY, viewport.zoom, onSelectElement],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Nyp-zoom mot mittpunkten mellan fingrarna.
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = Array.from(pointers.current.values());
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance <= 0) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const midX = (a.x + b.x) / 2 - rect.left;
        const midY = (a.y + b.y) / 2 - rect.top;

        const newZoom = clamp(
          pinch.current.zoom * (distance / pinch.current.distance),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        const ratio = newZoom / viewport.zoom;
        onViewportChange({
          zoom: newZoom,
          panX: midX - ratio * (midX - viewport.panX),
          panY: midY - ratio * (midY - viewport.panY),
        });
        return;
      }

      if (!isPanning || !panStart.current) return;
      onViewportChange({
        panX: panStart.current.panX + (e.clientX - panStart.current.x),
        panY: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    },
    [isPanning, onViewportChange, viewport],
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      setIsPanning(false);
      panStart.current = null;
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Zoom toward cursor
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = -e.deltaY * 0.001;
      const newZoom = clamp(viewport.zoom + delta, MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / viewport.zoom;

      onViewportChange({
        zoom: newZoom,
        panX: mouseX - ratio * (mouseX - viewport.panX),
        panY: mouseY - ratio * (mouseY - viewport.panY),
      });
    },
    [viewport, onViewportChange],
  );

  // Släpp av ett bibliotekskort. Omräkningen till canvaskoordinater sker här,
  // eftersom det bara är den här komponenten som känner till canvasens rect.
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      endPointer(e);

      if (!isLibraryDragging || !onLibraryDrop) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport.panX,
        viewport.panY,
        viewport.zoom,
      );
      onLibraryDrop(point.x, point.y);
    },
    [endPointer, isLibraryDragging, onLibraryDrop, viewport],
  );

  const classNames = [
    'ws-canvas-container',
    isPanning && 'ws-canvas-container--panning',
    isLibraryDragging && 'ws-canvas-container--dropzone',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={classNames}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onWheel={handleWheel}
    >
      <div
        ref={viewportRef}
        className={`ws-canvas-viewport ${
          viewport.zoom < WHEEL_REF_TEXT_MIN_ZOOM ? 'ws-canvas-viewport--quiet' : ''
        }`}
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          // Elementens kanter och skuggor divideras med den här, så att de
          // förblir optiskt lika tjocka oavsett zoomnivå. Se .ws-element.
          '--ws-zoom': viewport.zoom,
        } as React.CSSProperties}
      >
        {children}
      </div>

      <ZoomControls
        viewport={viewport}
        onViewportChange={onViewportChange}
        onZoomToContent={onZoomToContent}
      />
    </div>
  );
}
