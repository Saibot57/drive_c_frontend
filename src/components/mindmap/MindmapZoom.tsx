'use client';

import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type MindmapViewport, useMindmapZoom } from '@/hooks/useMindmapViewport';
import { MAX_ZOOM, MIN_ZOOM } from '@/utils/mindmapViewport';

/** Knapparna tar inte fokus: den som skriver i en nod ska kunna zooma utan att skrivandet avslutas. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

/**
 * Zoomnivån i verktygsraden, med knappar för samma sak som Ctrl++, Ctrl+-
 * och Ctrl+0. Prenumererar själv på vyn, så att kartan inte ritas om när
 * man zoomar.
 */
export function MindmapZoom({ viewport }: { viewport: MindmapViewport }) {
  const zoom = useMindmapZoom(viewport);
  const tool = 'sp-btn h-8 w-8 p-0';

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="neutral"
        className={tool}
        onMouseDown={keepFocus}
        onClick={() => viewport.zoomStep(-1)}
        disabled={zoom <= MIN_ZOOM}
        title="Zooma ut (Ctrl+-)"
        aria-label="Zooma ut"
      >
        <ZoomOut size={15} />
      </Button>
      <button
        type="button"
        className="mm__zoom-level"
        onMouseDown={keepFocus}
        onClick={() => viewport.zoomStep(0)}
        title="Zoomnivå. Klicka för 100 %."
        aria-label={`Zoomnivå ${Math.round(zoom * 100)} procent. Klicka för 100 procent.`}
      >
        {Math.round(zoom * 100)} %
      </button>
      <Button
        size="sm"
        variant="neutral"
        className={tool}
        onMouseDown={keepFocus}
        onClick={() => viewport.zoomStep(1)}
        disabled={zoom >= MAX_ZOOM}
        title="Zooma in (Ctrl++)"
        aria-label="Zooma in"
      >
        <ZoomIn size={15} />
      </Button>
      <Button
        size="sm"
        variant="neutral"
        className={tool}
        onMouseDown={keepFocus}
        onClick={viewport.fit}
        title="Passa in hela kartan (Ctrl+0)"
        aria-label="Passa in hela kartan"
      >
        <Maximize size={15} />
      </Button>
    </div>
  );
}
