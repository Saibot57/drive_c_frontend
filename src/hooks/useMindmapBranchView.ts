'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MindmapViewport } from '@/hooks/useMindmapViewport';
import type { MindmapView } from '@/utils/mindmapViewport';

/*
 * "Visa bara grenen": läget och vyns byte. Vilken gren som visas räknas ut
 * i MindmapCanvas (branchRootId), så att en gren vars rot försvunnit slutar
 * gälla i samma ritning. Här finns det som följer av bytet: grenen passas in
 * när den öppnas, och hela kartans vy kommer tillbaka när den stängs.
 *
 * Planen: docs/plans/mindmap-presentation.md, del 8a.
 */

interface Options {
  mapId: string;
  /** Grenen som visas nu, eller `null` för hela kartan. */
  branchId: string | null;
  /** Det användaren bad om; kan peka på en nod som inte längre finns. */
  wanted: string | null;
  setWanted: (id: string | null) => void;
  viewport: MindmapViewport;
}

export interface MindmapBranchView {
  /** Visar noden som rot. */
  enter: (id: string) => void;
  /** Visar hela kartan igen. */
  exit: () => void;
}

export function useMindmapBranchView({ mapId, branchId, wanted, setWanted, viewport }: Options): MindmapBranchView {
  /** Hela kartans vy, sparad medan en gren visas. */
  const stash = useRef<MindmapView | null>(null);
  const shown = useRef<string | null>(null);
  const mapRef = useRef(mapId);
  const branchRef = useRef(branchId);
  branchRef.current = branchId;

  useEffect(() => {
    // En annan karta: grenen och den sparade vyn hör till den förra.
    if (mapRef.current !== mapId) {
      mapRef.current = mapId;
      stash.current = null;
      shown.current = null;
      if (wanted) setWanted(null);
      return;
    }
    if (branchId === shown.current) return;
    shown.current = branchId;
    if (branchId) {
      viewport.fit();
      return;
    }
    // Grenen stängdes, eller dess rot försvann (ångra): hela kartan står där den stod.
    const saved = stash.current;
    stash.current = null;
    if (saved) viewport.change(() => saved, true);
    if (wanted) setWanted(null);
  }, [mapId, branchId, wanted, setWanted, viewport]);

  const enter = useCallback((id: string) => {
    // Läses innan något ändras: vyn är ännu hela kartans.
    if (branchRef.current === null) stash.current = viewport.getView();
    setWanted(id);
  }, [setWanted, viewport]);

  const exit = useCallback(() => setWanted(null), [setWanted]);

  return { enter, exit };
}
