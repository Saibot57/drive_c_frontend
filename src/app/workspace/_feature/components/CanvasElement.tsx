'use client';

import { Lock, Unlock } from 'lucide-react';
import type { ElementType, SurfaceElement, WorkspaceElement } from '../types/workspace.types';
import {
  GRID_SIZE,
  CTRL_RESIZE_THRESHOLD_PX,
  CTRL_RESIZE_CENTER_FRACTION,
  TYPE_COLORS,
  MIN_WHEEL_REF_SIZE,
} from '../types/constants';
import { useElementDrag, type Point } from '../hooks/useElementDrag';
import { useElementResize, type Box } from '../hooks/useElementResize';
import ElementRenderer from './ElementRenderer';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function detectResizeZone(
  localX: number,
  localY: number,
  width: number,
  height: number,
  threshold: number,
): ResizeDir | null {
  const deadHalf = (Math.min(width, height) * CTRL_RESIZE_CENTER_FRACTION) / 2;
  if (
    Math.abs(localX - width / 2) < deadHalf &&
    Math.abs(localY - height / 2) < deadHalf
  ) {
    return null;
  }

  const nearN = localY < threshold;
  const nearS = localY > height - threshold;
  const nearW = localX < threshold;
  const nearE = localX > width - threshold;

  if (nearN && nearE) return 'ne';
  if (nearN && nearW) return 'nw';
  if (nearS && nearE) return 'se';
  if (nearS && nearW) return 'sw';
  if (nearN) return 'n';
  if (nearS) return 's';
  if (nearE) return 'e';
  if (nearW) return 'w';
  return null;
}

/** Ritar sin egen ram ända ut i kanten och vill inte ha någon padding. */
const FLUSH_TYPES: ElementType[] = ['sticky', 'pdf', 'image', 'link', 'wheel_ref'];
/** Har sin egen rullning inuti och ska inte kunna rullas av wrappern. */
const CLIPPED_TYPES: ElementType[] = ['pdf', 'image', 'link', 'wheel_ref'];

function contentClassName(type: ElementType): string {
  return [
    'ws-element__content',
    FLUSH_TYPES.includes(type) && 'ws-element__content--flush',
    CLIPPED_TYPES.includes(type) && 'ws-element__content--clip',
  ]
    .filter(Boolean)
    .join(' ');
}

interface CanvasElementProps {
  placement: SurfaceElement;
  element: WorkspaceElement;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onMove: (placementId: string, x: number, y: number) => void;
  onResize: (placementId: string, w: number, h: number) => void;
  /** Vid släpp: ger ångra en post per gest i stället för per musrörelse. */
  onMoveEnd?: (placementId: string, from: Point, to: Point) => void;
  onResizeEnd?: (placementId: string, from: Box, to: Box) => void;
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
  onMoveEnd,
  onResizeEnd,
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
    onMoveEnd,
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
    onResizeEnd,
    // Hjulet tappar sina etiketter långt före de andra typerna.
    minWidth: element.type === 'wheel_ref' ? MIN_WHEEL_REF_SIZE : undefined,
    minHeight: element.type === 'wheel_ref' ? MIN_WHEEL_REF_SIZE : undefined,
  });

  const classNames = [
    'ws-element',
    isSelected && 'ws-element--selected',
    !placement.is_locked && 'ws-element--unlocked',
  ]
    .filter(Boolean)
    .join(' ');

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 && e.ctrlKey && !placement.is_locked) {
      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const dir = detectResizeZone(
        localX,
        localY,
        rect.width,
        rect.height,
        CTRL_RESIZE_THRESHOLD_PX,
      );
      if (dir) {
        onSelect();
        handleResizeStart(dir)(e);
        return;
      }
    }
    handleDragDown(e);
  };

  return (
    <div
      className={classNames}
      style={{
        left: placement.position_x,
        top: placement.position_y,
        width: placement.width,
        height: placement.height,
        zIndex: placement.z_index,
        // Listen överst på kortet. Färgen är data om elementtypen, som
        // notislappens färg — därför inline och inte i CSS-filen.
        '--ws-type-color': TYPE_COLORS[element.type],
      } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={handleMouseDown}
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
      <div className={contentClassName(element.type)}>
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
