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
  /** Sant medan ett bibliotekskort dras. Aktiverar släppzonen. */
  isLibraryDragging?: boolean;
  /** Släpp av ett bibliotekskort, i canvasens koordinater. */
  onLibraryDrop?: (canvasX: number, canvasY: number) => void;
  children?: React.ReactNode;
}

export default function CanvasArea({
  viewport,
  onViewportChange,
  selectedElementId,
  onSelectElement,
  isLibraryDragging = false,
  onLibraryDrop,
  children,
}: CanvasAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on middle-click or left-click on canvas background
      if (e.button === 1 || (e.button === 0 && e.target === containerRef.current)) {
        e.preventDefault();
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
    [viewport.panX, viewport.panY, onSelectElement],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStart.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      onViewportChange({
        panX: panStart.current.panX + dx,
        panY: panStart.current.panY + dy,
      });
    },
    [isPanning, onViewportChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
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
    [isLibraryDragging, onLibraryDrop, viewport],
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div
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

      <ZoomControls viewport={viewport} onViewportChange={onViewportChange} />
    </div>
  );
}
