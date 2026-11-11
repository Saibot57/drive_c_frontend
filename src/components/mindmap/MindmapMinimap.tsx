'use client';

import { useEffect, useRef } from 'react';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapViewport } from '@/hooks/useMindmapViewport';
import { renderMindmapCanvas, type MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import {
  createFrameThrottle,
  minimapFrame,
  minimapScale,
  viewFromMinimap,
  type MindmapRect,
} from '@/utils/mindmapViewport';

/**
 * Det största kartbilden får vara, i skärmpixlar. Högre än bred: en karta
 * som skrivs som en disposition växer nedåt. Rutan runt (.mm__minimap) följer
 * bildens mått.
 */
const BOX = { width: 168, height: 200 };
/** Högst tio uppdateringar i sekunden (planens steg 3). */
const UPDATE_MS = 100;

interface MindmapMinimapProps {
  viewport: MindmapViewport;
  doc: MindmapDoc;
  /** Kartans utbredning, med rotnodens mitt i origo. */
  bounds: MindmapRect;
  /** Färger och typsnitt i det tema som visas. `null` innan kartan är ritad. */
  readPalette: () => MindmapPalette | null;
}

/**
 * Minikartan nere till höger: hela kartan i liten skala och en ram runt det
 * som syns. Klick eller drag flyttar vyn dit. Kartbilden ritas med samma
 * mindmapDraw som exporten, och allt uppdateras genom en strypt bildruta.
 */
export function MindmapMinimap({ viewport, doc, bounds, readPalette }: MindmapMinimapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const latest = useRef({ doc, bounds, readPalette });
  latest.current = { doc, bounds, readPalette };
  /** Kartbilden behöver ritas om: kartan eller temat har ändrats. */
  const stale = useRef(true);
  const throttle = useRef<ReturnType<typeof createFrameThrottle> | null>(null);

  useEffect(() => {
    const draw = () => {
      const map = mapRef.current;
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (!map || !canvas || !frame) return;
      const { doc: d, bounds: b, readPalette: read } = latest.current;
      const scale = minimapScale(b, BOX);

      if (stale.current) {
        const palette = read();
        if (!palette) return;
        stale.current = false;
        map.style.width = `${b.width * scale}px`;
        map.style.height = `${b.height * scale}px`;
        try {
          const image = renderMindmapCanvas(d, palette, { scale: scale * (window.devicePixelRatio || 1) });
          canvas.width = image.width;
          canvas.height = image.height;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
        } catch {
          /* Utan Canvas blir minikartan tom; kartan fungerar ändå. */
        }
      }

      const rect = minimapFrame(viewport.getView(), viewport.getSize(), b, scale);
      frame.style.display = rect ? 'block' : 'none';
      if (rect) {
        frame.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
        frame.style.width = `${rect.width}px`;
        frame.style.height = `${rect.height}px`;
      }
    };

    const t = createFrameThrottle(draw, UPDATE_MS);
    throttle.current = t;
    t.schedule();
    const unsubscribe = viewport.subscribe(t.schedule);

    // Temat byts med data-theme på <html>; då har färgerna ändrats.
    const observer = new MutationObserver(() => {
      stale.current = true;
      t.schedule();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      unsubscribe();
      observer.disconnect();
      t.cancel();
      throttle.current = null;
    };
  }, [viewport]);

  useEffect(() => {
    stale.current = true;
    throttle.current?.schedule();
  }, [doc, bounds]);

  const moveTo = (e: React.PointerEvent, smooth: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const box = map.getBoundingClientRect();
    const b = latest.current.bounds;
    const scale = minimapScale(b, BOX);
    const point = { x: e.clientX - box.left, y: e.clientY - box.top };
    viewport.change((view, ctx) => viewFromMinimap(view, point, b, scale, ctx.size), smooth);
  };

  return (
    <div
      className="mm__minimap"
      aria-hidden="true"
      title="Minikarta. Klicka för att flytta vyn."
      // Fokus stannar i kartan: den som skriver ska inte avbrytas av ett klick här.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e, true);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e, false);
      }}
    >
      <div ref={mapRef} className="mm__minimap-map">
        <canvas ref={canvasRef} className="mm__minimap-image" />
        <div ref={frameRef} className="mm__minimap-frame" />
      </div>
    </div>
  );
}
