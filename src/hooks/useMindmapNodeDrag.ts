import { useCallback, useRef, useState } from 'react';
import type { MindmapContent } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { canMoveNode, moveNode, setOffset } from '@/utils/mindmap/mindmapTree';
import { offsetBy, viewRootOf } from '@/utils/mindmapBranch';
import { placeNode, placeNodeAlone, placeNodes, placeRoot, snapDelta } from '@/utils/mindmapPlacement';

/** Så långt måste pekaren röra sig innan ett klick blir ett drag. */
export const DRAG_THRESHOLD_PX = 5;

/** Hur långt noden som dras har flyttats, i kartans px (vid zoom 1). */
export interface MindmapDragMove {
  id: string;
  dx: number;
  dy: number;
  /** Alt: bara noden flyttas, barnen står kvar. */
  alone: boolean;
  /** Flera markerade som dras tillsammans (docs/plans/mindmap-arrangera.md, del A). */
  group?: string[];
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
  /** Snäpper noden till rutnätet (kartans `grid`). */
  grid: boolean;
  /** Nodens ruta från rotens automatiska mitt, som rutnätet utgår från. */
  nodeRect: (id: string) => { x: number; y: number } | null;
  /** De markerade noderna om flera är markerade, annars `null`. */
  group: () => string[] | null;
  /** Vid varje nedtryckning: stäng menyer. */
  onDown: () => void;
  /** Shift+dra drar en tvärlänk i stället. */
  onLinkDrag: (e: React.PointerEvent<HTMLDivElement>, id: string) => void;
  /** Släppet: det nya dokumentet och den dragna noden. */
  onDrop: (next: MindmapDoc, id: string) => void;
}

/**
 * Att dra en nod på Mindmap-sidan (docs/plans/mindmap-sida.md, steg 5, och
 * docs/plans/mindmap-placering.md, del B). Släpp på en annan nod gör grenen
 * till dess barn; släpp på tom yta ger noden en förskjutning, och grenen
 * följer med. Är noden en av flera markerade flyttas alla, var och en med
 * sin gren (docs/plans/mindmap-arrangera.md, del A). Med Alt flyttas bara noden. Roten går att dra i hela kartan
 * och flyttas då ensam. Med rutnätet på snäpper nodens hörn till det, utom
 * med Ctrl. Medan noden dras ritas kartan som om den släppts, genom
 * `dragMove`; dokumentet ändras först vid släppet.
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
    if (d.editingId === id) return;
    // Grenens rot står still i grenvyn; kartans rot går att dra i hela kartan.
    const isRoot = id === d.doc.root.id;
    if (d.branchId && id === viewRootOf(d.doc, d.branchId).id) return;

    // En markerad nod bland flera: alla markerade följer med. Grenens rot står still.
    const marked = d.group();
    const viewRoot = d.branchId ? viewRootOf(d.doc, d.branchId).id : null;
    const group = marked?.includes(id) ? marked.filter((x) => x !== viewRoot) : undefined;
    const start = { x: e.clientX, y: e.clientY };
    const from = d.nodeRect(id);
    let active = false;
    let moved = { dx: 0, dy: 0 };
    let alone = false;

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
      const valid = !isRoot && !group && target && canMoveNode(now.doc, id, target) ? target : null;
      dropRef.current = valid;
      setDropId(valid);
      // Skärmens pixlar till kartans: zoomen kan ha ändrats under draget.
      const zoom = now.zoom();
      moved = { dx: (ev.clientX - start.x) / zoom, dy: (ev.clientY - start.y) / zoom };
      if (now.grid && from && !ev.ctrlKey && !ev.metaKey) moved = snapDelta(from, moved);
      alone = ev.altKey && !isRoot && !group;
      setDragMove({ id, ...moved, alone, ...(group ? { group } : {}) });
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
      let next: MindmapContent | null;
      if (group) next = placeNodes(now.doc, group, moved);
      else if (isRoot) next = placeRoot(now.doc, moved);
      else if (target) next = moveNode(setOffset(now.doc, id, null), id, target);
      else if (alone) next = placeNodeAlone(now.doc, id, moved);
      else next = placeNode(now.doc, id, moved, now.layoutOf) ?? (now.branchId ? offsetBy(now.doc, id, moved) : null);
      if (next && next !== now.doc) now.onDrop(next as MindmapDoc, id);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, []);

  return { dragId, dropId, dragMove, suppressClick, selectedOnDown, onPointerDown };
}
