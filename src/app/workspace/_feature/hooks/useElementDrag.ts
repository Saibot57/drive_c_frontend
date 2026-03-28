'use client';

import { useCallback, useRef } from 'react';
import { snapToGrid } from '../types/utils';

interface UseElementDragParams {
  placementId: string;
  zoom: number;
  gridSize: number;
  startX: number;
  startY: number;
  onMove: (placementId: string, x: number, y: number) => void;
}

export function useElementDrag({
  placementId,
  zoom,
  gridSize,
  startX,
  startY,
  onMove,
}: UseElementDragParams) {
  const dragging = useRef(false);
  const origin = useRef({ mouseX: 0, mouseY: 0, elX: startX, elY: startY });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging.current = true;
      origin.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        elX: startX,
        elY: startY,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const dx = (ev.clientX - origin.current.mouseX) / zoom;
        const dy = (ev.clientY - origin.current.mouseY) / zoom;
        const newX = snapToGrid(origin.current.elX + dx, gridSize);
        const newY = snapToGrid(origin.current.elY + dy, gridSize);
        onMove(placementId, newX, newY);
      };

      const handleUp = () => {
        dragging.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [zoom, gridSize, startX, startY, onMove, placementId],
  );

  return { handleMouseDown };
}
