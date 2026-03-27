'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { ViewportState } from '../types/workspace.types';
import { clamp } from '../types/utils';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from '../types/constants';

interface ZoomControlsProps {
  viewport: ViewportState;
  onViewportChange: (viewport: Partial<ViewportState>) => void;
}

export default function ZoomControls({
  viewport,
  onViewportChange,
}: ZoomControlsProps) {
  const step = 0.1;

  const zoomIn = () =>
    onViewportChange({ zoom: clamp(viewport.zoom + step, MIN_ZOOM, MAX_ZOOM) });

  const zoomOut = () =>
    onViewportChange({ zoom: clamp(viewport.zoom - step, MIN_ZOOM, MAX_ZOOM) });

  const reset = () =>
    onViewportChange({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 });

  return (
    <div className="ws-zoom-controls">
      <button className="ws-zoom-btn" onClick={zoomOut} title="Zooma ut">
        <Minus size={14} />
      </button>
      <span className="ws-zoom-label">
        {Math.round(viewport.zoom * 100)}%
      </span>
      <button className="ws-zoom-btn" onClick={zoomIn} title="Zooma in">
        <Plus size={14} />
      </button>
      <button className="ws-zoom-btn" onClick={reset} title="Återställ vy">
        <RotateCcw size={12} />
      </button>
    </div>
  );
}
