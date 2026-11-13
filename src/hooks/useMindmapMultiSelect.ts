'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { isEditableElement } from '@/utils/dom';
import {
  groupEdgeAction,
  groupNodeAction,
  type MindmapGroupEdgeAction,
  type MindmapGroupNodeAction,
} from '@/utils/mindmapGroup';
import type { EdgePoint } from '@/utils/mindmapEdges';
import type { RoutedEdge } from '@/utils/mindmapRouting';
import {
  edgesInRect,
  EMPTY_GROUP,
  groupSize,
  mergeGroups,
  nodesInRect,
  rectBetween,
  toggleInGroup,
  visibleGroup,
  type MindmapGroup,
  type SelectionRect,
} from '@/utils/mindmapSelection';

/*
 * Flera markerade noder och linjer (docs/plans/mindmap-arrangera.md, del A).
 * Kartans vanliga markering (en nod, eller en linje) finns kvar bredvid:
 * den markerade noden är den som tangenterna och panelen gäller. Hooken
 * håller resten. Två eller fler markerade är en grupp; blir det bara en
 * kvar går den tillbaka till den vanliga markeringen.
 *
 * Cmd+klick (Ctrl på Windows) växlar en nod eller linje, Cmd+dra på tom yta
 * ritar en ram som tar det den nuddar, och Cmd+A tar noden och syskonen.
 */

/** Cmd på Mac, Ctrl på Windows. Ctrl+klick är högerklick på Mac och kommer aldrig hit som klick. */
export const isGroupModifier = (e: { metaKey: boolean; ctrlKey: boolean }) => e.metaKey || e.ctrlKey;

interface Options {
  mapId: string;
  layout: MindmapLayoutResult;
  routes: RoutedEdge[];
  /** Kartans vanliga markering just nu. */
  current: () => { node: string | null; edge: string | null };
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  toLayoutPoint: (clientX: number, clientY: number) => EdgePoint;
  focusMap: () => void;
  docRef: React.MutableRefObject<MindmapDoc>;
  /** Kartans `commit`, så att ändringarna hamnar i ångra-historiken. */
  commit: (next: MindmapDoc) => void;
  /** Grenens rot i grenvyn, som inte tas bort; annars `null`. */
  keep: () => string | null;
  /** Städa upp en gren (del C i mindmap-arrangera.md). */
  tidy: (doc: MindmapDoc, id: string) => MindmapDoc;
}

export function useMindmapMultiSelect(options: Options) {
  const { mapId, layout, routes, current, selectNode, selectEdge, toLayoutPoint, focusMap, docRef, commit, keep, tidy } = options;
  const [group, setGroupState] = useState<MindmapGroup>(EMPTY_GROUP);
  const [frame, setFrame] = useState<SelectionRect | null>(null);
  const shown = useMemo(() => visibleGroup(group, layout, routes), [group, layout, routes]);
  const active = groupSize(shown) >= 2;
  const shownRef = useRef(shown);
  shownRef.current = active ? shown : EMPTY_GROUP;
  const lookup = useRef({ layout, routes });
  lookup.current = { layout, routes };

  const clear = useCallback(() => setGroupState(EMPTY_GROUP), []);
  useEffect(clear, [mapId, clear]);

  /**
   * Gör `next` till markeringen. Två eller fler blir en grupp, och `primary`
   * (eller den sista noden) blir kartans markerade nod. En ensam går
   * tillbaka till den vanliga markeringen.
   */
  const apply = useCallback((next: MindmapGroup, primary: string | null = null) => {
    if (groupSize(next) >= 2) {
      setGroupState(next);
      selectEdge(null);
      const node = primary && next.nodes.includes(primary) ? primary : next.nodes[next.nodes.length - 1];
      if (node) selectNode(node);
      return;
    }
    setGroupState(EMPTY_GROUP);
    if (next.nodes.length === 1) {
      selectEdge(null);
      selectNode(next.nodes[0]);
    } else if (next.edges.length === 1) {
      selectEdge(next.edges[0]);
    }
  }, [selectEdge, selectNode]);

  /** Det som är markerat nu, som grupp: gruppen, eller den vanliga markeringen. */
  const base = useCallback((): MindmapGroup => {
    if (groupSize(shownRef.current) >= 2) return shownRef.current;
    const { node, edge } = current();
    if (edge) return { nodes: [], edges: [edge] };
    return node ? { nodes: [node], edges: [] } : EMPTY_GROUP;
  }, [current]);

  /** Cmd+klick på en nod eller linje. */
  const toggle = useCallback((kind: 'node' | 'edge', id: string) => {
    apply(toggleInGroup(base(), kind, id), kind === 'node' ? id : null);
    focusMap();
  }, [apply, base, focusMap]);

  /** Cmd+dra på tom yta. Ramen lägger till det den nuddar till en grupp som redan finns. */
  const beginFrame = useCallback((e: React.PointerEvent) => {
    const pointerId = e.pointerId;
    const start = toLayoutPoint(e.clientX, e.clientY);
    const before = groupSize(shownRef.current) >= 2 ? shownRef.current : EMPTY_GROUP;
    let rect: SelectionRect | null = null;

    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      rect = rectBetween(start, toLayoutPoint(ev.clientX, ev.clientY));
      setFrame(rect);
    };
    const handleUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setFrame(null);
      if (ev.type === 'pointercancel' || !rect) return;
      const { layout: laid, routes: routed } = lookup.current;
      const hits = { nodes: nodesInRect(laid, rect), edges: edgesInRect(routed, rect) };
      if (groupSize(hits) > 0) apply(mergeGroups(before, hits));
      focusMap();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [apply, focusMap, toLayoutPoint]);

  /** Gruppens noder, om det finns en grupp med noder. Läses i händelser. */
  const groupNodes = useCallback((): string[] | null => {
    const nodes = shownRef.current.nodes;
    return groupSize(shownRef.current) >= 2 && nodes.length > 0 ? nodes : null;
  }, []);

  /** En handling på alla markerade noder. Falskt om inga flera noder är markerade. */
  const runNodes = useCallback((action: MindmapGroupNodeAction): boolean => {
    const ids = groupNodes();
    if (!ids) return false;
    const result = groupNodeAction(docRef.current, ids, action, keep(), tidy);
    if (result) commit(result.doc);
    if (result?.focusId) {
      clear();
      selectNode(result.focusId);
    }
    focusMap();
    return true;
  }, [clear, commit, docRef, focusMap, groupNodes, keep, selectNode, tidy]);

  /** En handling på alla markerade linjer. */
  const runEdges = useCallback((action: MindmapGroupEdgeAction) => {
    const next = groupEdgeAction(docRef.current, shownRef.current.edges, action);
    if (next) commit(next);
    focusMap();
  }, [commit, docRef, focusMap]);

  /**
   * Cmd+A markerar noden och syskonen (`siblings`); Esc släpper flera
   * markerade. Delete med bara linjer markerade gör ingenting. Inte medan man skriver. Sant om tangenten är tagen om hand.
   */
  const handleKey = useCallback((e: React.KeyboardEvent, ctx: { editing: boolean; id: string; siblings: () => string[] }): boolean => {
    if (ctx.editing || isEditableElement(e.target)) return false;
    const grouped = groupSize(shownRef.current) >= 2;
    // Bara linjer markerade: Delete gör ingenting, som för en ensam linje.
    if (grouped && shownRef.current.nodes.length === 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    const all = isGroupModifier(e) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a';
    if (!all && !(e.key === 'Escape' && grouped)) return false;
    e.preventDefault();
    e.stopPropagation();
    if (all) apply({ nodes: ctx.siblings(), edges: [] }, ctx.id);
    else clear();
    return true;
  }, [apply, clear]);

  const nodeSet = useMemo(() => new Set(active ? shown.nodes : []), [active, shown]);
  const edgeSet = useMemo(() => new Set(active ? shown.edges : []), [active, shown]);

  return {
    group: active ? shown : EMPTY_GROUP,
    active,
    nodeSet,
    edgeSet,
    frame,
    clear,
    toggle,
    beginFrame,
    groupNodes,
    runNodes,
    runEdges,
    handleKey,
  };
}
