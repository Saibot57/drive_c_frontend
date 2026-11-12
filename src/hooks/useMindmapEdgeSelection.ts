'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MindmapAnchor, MindmapEdgeShape } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { nearestSideTo, type EdgePoint } from '@/utils/mindmapEdges';
import { resetEdgeStyle, setEdgeAnchor, setEdgeShape } from '@/utils/mindmapRouting';
import { isEditableElement } from '@/utils/dom';

/*
 * En markerad linje i trädet (docs/plans/mindmap-placering.md, del C).
 * Linjen heter efter noden den går till: varje nod utom roten har en linje
 * från sin förälder. Ändringarna går genom kartans `commit`, så att de
 * hamnar i ångra-historiken.
 */

export type EdgeEnd = 'from' | 'to';

export interface EdgeAnchorPreview {
  id: string;
  end: EdgeEnd;
  side: MindmapAnchor;
}

interface Options {
  mapId: string;
  docRef: React.MutableRefObject<MindmapDoc>;
  layout: MindmapLayoutResult;
  commit: (next: MindmapDoc) => void;
  focusMap: () => void;
  toLayoutPoint: (clientX: number, clientY: number) => EdgePoint;
}

export function useMindmapEdgeSelection({ mapId, docRef, layout, commit, focusMap, toLayoutPoint }: Options) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<EdgeAnchorPreview | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  // En annan karta: markeringen hör till den förra.
  useEffect(() => select(null), [mapId, select]);

  /** Linjen som är markerad, om den syns (noden kan ha tagits bort eller fällts ihop). */
  const edge = useMemo(
    () => (selectedId ? layout.edges.find((e) => e.toId === selectedId) ?? null : null),
    [layout, selectedId],
  );

  const change = useCallback((update: (d: MindmapDoc, id: string) => MindmapDoc) => {
    const id = selectedRef.current;
    if (!id) return;
    const next = update(docRef.current, id);
    if (next !== docRef.current) commit(next);
  }, [commit, docRef]);

  const setShape = useCallback((shape: MindmapEdgeShape | null) => change((d, id) => setEdgeShape(d, id, shape)), [change]);
  const setAnchor = useCallback(
    (end: EdgeEnd, side: MindmapAnchor | null) => change((d, id) => setEdgeAnchor(d, id, end, side)),
    [change],
  );
  const reset = useCallback(() => change((d, id) => resetEdgeStyle(d, id)), [change]);

  /** Dra i handtaget på en ände: fästet blir den sida av noden som pekaren är närmast. */
  const beginHandle = useCallback((e: React.PointerEvent, end: EdgeEnd) => {
    const id = selectedRef.current;
    const found = id ? layoutRef.current.edges.find((x) => x.toId === id) : null;
    if (!id || !found || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const nodeId = end === 'from' ? found.fromId : found.toId;
    const pointerId = e.pointerId;
    let side: MindmapAnchor | null = null;

    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const box = layoutRef.current.byId.get(nodeId);
      if (!box) return;
      side = nearestSideTo(box, toLayoutPoint(ev.clientX, ev.clientY));
      setPreview({ id, end, side });
    };
    const handleUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setPreview(null);
      if (ev.type !== 'pointercancel' && side) {
        const next = setEdgeAnchor(docRef.current, id, end, side);
        if (next !== docRef.current) commit(next);
      }
      focusMap();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [commit, docRef, focusMap, toLayoutPoint]);

  /**
   * Tangenter medan en linje är markerad. Esc avmarkerar. Delete gör
   * ingenting: linjen finns så länge noden finns, och noden ska inte tas
   * bort av misstag. Andra tangenter avmarkerar linjen och går vidare till
   * kartan.
   */
  const handleKey = useCallback((e: React.KeyboardEvent): boolean => {
    if (!selectedRef.current || isEditableElement(e.target)) return false;
    if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') select(null);
      return true;
    }
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) select(null);
    return false;
  }, [select]);

  const style = edge ? findNode(docRef.current.root, edge.toId)?.edge ?? {} : null;

  return { selectedId: edge ? edge.toId : null, edge, style, preview, select, setShape, setAnchor, reset, beginHandle, handleKey };
}
