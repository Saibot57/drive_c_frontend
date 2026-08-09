'use client';

import { useCallback, useRef } from 'react';
import { snapToGrid } from '../types/utils';

export type Point = { x: number; y: number };

interface UseElementDragParams {
  placementId: string;
  zoom: number;
  gridSize: number;
  startX: number;
  startY: number;
  onMove: (placementId: string, x: number, y: number) => void;
  /**
   * Anropas när musknappen släpps, och bara om elementet faktiskt flyttades.
   * Ångra behöver en post per gest — hade den lyssnat på onMove hade en enda
   * dragning fyllt stacken med ett steg per musrörelse.
   */
  onMoveEnd?: (placementId: string, from: Point, to: Point) => void;
}

export function useElementDrag({
  placementId,
  zoom,
  gridSize,
  startX,
  startY,
  onMove,
  onMoveEnd,
}: UseElementDragParams) {
  const dragging = useRef(false);
  const origin = useRef({ mouseX: 0, mouseY: 0, elX: startX, elY: startY });
  const latest = useRef<Point>({ x: startX, y: startY });

  const handleMouseDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging.current = true;
      origin.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        elX: startX,
        elY: startY,
      };
      latest.current = { x: startX, y: startY };

      const handleMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const dx = (ev.clientX - origin.current.mouseX) / zoom;
        const dy = (ev.clientY - origin.current.mouseY) / zoom;
        const newX = snapToGrid(origin.current.elX + dx, gridSize);
        const newY = snapToGrid(origin.current.elY + dy, gridSize);
        latest.current = { x: newX, y: newY };
        onMove(placementId, newX, newY);
      };

      const handleUp = () => {
        dragging.current = false;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);

        const from = { x: origin.current.elX, y: origin.current.elY };
        const to = latest.current;
        // Ett klick utan förflyttning ska inte kosta ett ångra-steg.
        if (to.x !== from.x || to.y !== from.y) {
          onMoveEnd?.(placementId, from, to);
        }
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [zoom, gridSize, startX, startY, onMove, onMoveEnd, placementId],
  );

  return { handleMouseDown };
}
