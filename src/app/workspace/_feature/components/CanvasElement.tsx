'use client';

import { Lock, Unlock } from 'lucide-react';
import type { SurfaceElement, WorkspaceElement } from '../types/workspace.types';
import { GRID_SIZE } from '../types/constants';
import { useElementDrag } from '../hooks/useElementDrag';
import { useElementResize } from '../hooks/useElementResize';
import ElementRenderer from './ElementRenderer';

interface CanvasElementProps {
  placement: SurfaceElement;
  element: WorkspaceElement;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onMove: (placementId: string, x: number, y: number) => void;
  onResize: (placementId: string, w: number, h: number) => void;
  onToggleLock: (placementId: string) => void;
  onContentChange: (elementId: string, content: unknown) => void;
  onContextMenu?: (x: number, y: number) => void;
}

const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

export default function CanvasElement({
  placement,
  element,
  isSelected,
  zoom,
  onSelect,
  onMove,
  onResize,
  onToggleLock,
  onContentChange,
  onContextMenu,
}: CanvasElementProps) {
  const { handleMouseDown: handleDragDown } = useElementDrag({
    placementId: placement.id,
    zoom,
    gridSize: GRID_SIZE,
    startX: placement.position_x,
    startY: placement.position_y,
    onMove,
  });

  const { handleResizeStart } = useElementResize({
    placementId: placement.id,
    zoom,
    gridSize: GRID_SIZE,
    currentX: placement.position_x,
    currentY: placement.position_y,
    currentWidth: placement.width,
    currentHeight: placement.height,
    onResize,
    onMove,
  });

  const classNames = [
    'ws-element',
    isSelected && 'ws-element--selected',
    !placement.is_locked && 'ws-element--unlocked',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      style={{
        left: placement.position_x,
        top: placement.position_y,
        width: placement.width,
        height: placement.height,
        zIndex: placement.z_index,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={handleDragDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e.clientX, e.clientY);
      }}
    >
      {/* Lock button */}
      <button
        className="ws-lock-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(placement.id);
        }}
        title={placement.is_locked ? 'Lås upp' : 'Lås'}
      >
        {placement.is_locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>

      {/* Content */}
      <div style={{
        width: '100%',
        height: '100%',
        overflow: element.type === 'pdf' || element.type === 'image' ? 'hidden' : 'auto',
        padding: element.type === 'sticky' || element.type === 'pdf' || element.type === 'image' ? 0 : '0.5rem',
      }}>
        <ElementRenderer
          element={element}
          isLocked={placement.is_locked}
          isSelected={isSelected}
          onChange={(content) => onContentChange(element.id, content)}
        />
      </div>

      {/* Resize handles — only when selected and unlocked */}
      {isSelected && !placement.is_locked &&
        RESIZE_DIRECTIONS.map((dir) => (
          <div
            key={dir}
            className={`ws-resize-handle ws-resize-handle--${dir}`}
            onMouseDown={handleResizeStart(dir)}
          />
        ))}
    </div>
  );
}
