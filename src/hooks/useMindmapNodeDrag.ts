import { useCallback, useRef, useState } from 'react';
import type { MindmapContent } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { canMoveNode, moveNode, setOffset } from '@/utils/mindmap/mindmapTree';
import { offsetBy, viewRootOf } from '@/utils/mindmapBranch';
import { placeNode } from '@/utils/mindmapPlacement';

/** Så långt måste pekaren röra sig innan ett klick blir ett drag. */
export const DRAG_THRESHOLD_PX = 5;

/** Hur långt noden som dras har flyttats, i kartans px (vid zoom 1). */
export interface MindmapDragMove {
  id: string;
  dx: number;
  dy: number;
}

export interface MindmapNodeDragDeps {
  doc: MindmapDoc;
  /** Noden som visas som rot i grenvyn, annars `null`. */
  branchId: string | null;
  editingId: string | null;
  selectedId: string | null;
  /** Kartans ruta, som har fokus när kartan är aktiv. */
  scroll: HTMLElement | null;
  zoom: () => number;
  layoutOf: (content: MindmapContent) => MindmapLayoutResult;
  /** Vid varje nedtryckning: stäng menyer. */
  onDown: () => void;
  /** Shift+dra drar en tvärlänk i stället. */
  onLinkDrag: (e: React.PointerEvent<HTMLDivElement>, id: string) => void;
  /** Släppet: det nya dokumentet och den dragna noden. */
  onDrop: (next: MindmapDoc, id: string) => void;
}

/**
 * Att dra en nod på Mindmap-sidan (docs/plans/mindmap-sida.md, steg 5).
 * Släpp på en annan nod gör grenen till dess barn; släpp på tom yta ger
 * noden en förskjutning. Medan noden dras ritas kartan som om den släppts,
 * genom `dragMove`; dokumentet ändras först vid släppet.
 *
 * `deps` läses vid varje händelse, så att anroparen kan ge funktioner som
 * definieras längre ned i komponenten.
 */
export function useMindmapNodeDrag(deps: () => MindmapNodeDragDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const dropRef = useRef<string | null>(null);
  const [dragMove, setDragMove] = useState<MindmapDragMove | null>(null);
  /** Sant efter ett drag: klicket som följer ska inte räknas. */
  const suppressClick = useRef(false);
  /** Var noden redan markerad när knappen trycktes ned? Då börjar ett klick skriva. */
  const selectedOnDown = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const d = depsRef.current();
    // Efter ett drag som släpptes på en annan nod kommer inget klick på den
    // dragna; utan det här hade nästa klick på en nod svalts.
    suppressClick.current = false;
    // Läses före klicket: när knappen trycks ned får kartan fokus och
    // markerar roten, och då hade första klicket på roten börjat redigera.
    selectedOnDown.current = d.selectedId === id && document.activeElement === d.scroll;
    d.onDown();
    // Shift+dra drar en tvärlänk i stället för att flytta noden.
    if (e.shiftKey && d.editingId !== id) {
      suppressClick.current = true;
      d.onLinkDrag(e, id);
      return;
    }
    // Roten i det som visas står still.
    if (d.editingId === id || id === viewRootOf(d.doc, d.branchId).id) return;

    const start = { x: e.clientX, y: e.clientY };
    let active = false;
    let moved = { dx: 0, dy: 0 };

    const handleMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        active = true;
        setDragId(id);
      }
      const now = depsRef.current();
      // Den dragna noden släpper igenom pekaren (CSS), så träffen är noden under.
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-mm-id]');
      const target = hit && now.scroll?.contains(hit) ? hit.dataset.mmId ?? null : null;
      const valid = target && canMoveNode(now.doc, id, target) ? target : null;
      dropRef.current = valid;
      setDropId(valid);
      // Skärmens pixlar till kartans: zoomen kan ha ändrats under draget.
      const zoom = now.zoom();
      moved = { dx: (ev.clientX - start.x) / zoom, dy: (ev.clientY - start.y) / zoom };
      setDragMove({ id, ...moved });
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (!active) return;
      suppressClick.current = true;
      const target = dropRef.current;
      dropRef.current = null;
      setDragId(null);
      setDropId(null);
      setDragMove(null);
      // Ett avbrutet drag (pekaren togs över av webbläsaren) ändrar ingenting.
      if (ev.type === 'pointercancel') return;
      const now = depsRef.current();
      // På en annan nod: grenen blir dess barn och står på sin automatiska
      // plats där. På tom yta: noden stannar där den släpptes.
      // I en gren kan noden vara gömd i hela kartan (en förfader är hopfälld);
      // då kan placeNode inte räkna, och förskjutningen läggs på direkt.
      const next = target
        ? moveNode(setOffset(now.doc, id, null), id, target)
        : placeNode(now.doc, id, moved, now.layoutOf)
          ?? (now.branchId ? offsetBy(now.doc, id, moved) : null);
      if (next) now.onDrop(next as MindmapDoc, id);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, []);

  return { dragId, dropId, dragMove, suppressClick, selectedOnDown, onPointerDown };
}
