'use client';

import { useCallback, useRef } from 'react';
import { snapToGrid, clamp } from '../types/utils';
import { MIN_ELEMENT_WIDTH, MIN_ELEMENT_HEIGHT } from '../types/constants';

type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface UseElementResizeParams {
  placementId: string;
  zoom: number;
  gridSize: number;
  currentX: number;
  currentY: number;
  currentWidth: number;
  currentHeight: number;
  onResize: (placementId: string, width: number, height: number) => void;
  onMove: (placementId: string, x: number, y: number) => void;
}

export function useElementResize({
  placementId,
  zoom,
  gridSize,
  currentX,
  currentY,
  currentWidth,
  currentHeight,
  onResize,
  onMove,
}: UseElementResizeParams) {
  const resizing = useRef(false);

  const handleResizeStart = useCallback(
    (direction: Direction) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizing.current = true;

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startW = currentWidth;
      const startH = currentHeight;
      const startElX = currentX;
      const startElY = currentY;

      const handleMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const dx = (ev.clientX - startMouseX) / zoom;
        const dy = (ev.clientY - startMouseY) / zoom;

        let newW = startW;
        let newH = startH;
        let newX = startElX;
        let newY = startElY;

        if (direction.includes('e')) newW = startW + dx;
        if (direction.includes('w')) {
          newW = startW - dx;
          newX = startElX + dx;
        }
        if (direction.includes('s')) newH = startH + dy;
        if (direction.includes('n')) {
          newH = startH - dy;
          newY = startElY + dy;
        }

        newW = clamp(snapToGrid(newW, gridSize), MIN_ELEMENT_WIDTH, Infinity);
        newH = clamp(snapToGrid(newH, gridSize), MIN_ELEMENT_HEIGHT, Infinity);
        newX = snapToGrid(newX, gridSize);
        newY = snapToGrid(newY, gridSize);

        onResize(placementId, newW, newH);
        if (direction.includes('w') || direction.includes('n')) {
          onMove(placementId, newX, newY);
        }
      };

      const handleUp = () => {
        resizing.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [placementId, zoom, gridSize, currentWidth, currentHeight, currentX, currentY, onResize, onMove],
  );

  return { handleResizeStart };
}
