'use client';

import { useCallback, useEffect, useState } from 'react';

/*
 * Presentationsläget på Mindmap-sidan: om det är öppet, och helskärmen.
 *
 * Helskärm begärs på kartans ruta, direkt i klicket eller tangenttrycket
 * (webbläsaren kräver en användarhandling). Går det inte täcker
 * presentationen kartans ruta på sidan. Lämnar webbläsaren helskärmen (Esc
 * där når aldrig sidan) avslutas presentationen.
 *
 * Planen: docs/plans/mindmap-presentation.md, del 8b.
 */

export interface MindmapPresenting {
  active: boolean;
  start: () => void;
  stop: () => void;
}

export function useMindmapPresenting(
  /** Rutan som går i helskärm; presentationen ritas inuti den. */
  frameRef: React.RefObject<HTMLElement>,
  /** Kartans id. En annan karta avslutar presentationen. */
  mapId: string,
): MindmapPresenting {
  const [active, setActive] = useState(false);

  const start = useCallback(() => {
    setActive(true);
    const frame = frameRef.current;
    if (!frame || typeof frame.requestFullscreen !== 'function' || document.fullscreenElement) return;
    // Ett nej (iframe utan tillstånd, äldre Safari) är inget fel: läget fungerar på sidan.
    frame.requestFullscreen().catch(() => undefined);
  }, [frameRef]);

  const leaveFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.fullscreenElement === frameRef.current) {
      document.exitFullscreen?.().catch(() => undefined);
    }
  }, [frameRef]);

  const stop = useCallback(() => {
    setActive(false);
    leaveFullscreen();
  }, [leaveFullscreen]);

  useEffect(() => {
    if (!active) return undefined;
    const handleChange = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [active]);

  // En annan karta, eller att kartan försvinner från sidan, avslutar läget.
  useEffect(() => () => {
    setActive(false);
    leaveFullscreen();
  }, [mapId, leaveFullscreen]);

  return { active, start, stop };
}
