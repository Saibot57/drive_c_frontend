'use client';

import { useCallback, useMemo } from 'react';
import { MINDMAP_MAX_EDGE_POINTS } from '@/types/mindmap';
import type { MindmapCrossLink, MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { setCrossLinkPoints } from '@/utils/mindmapDoc';
import { longestSegmentMiddle, routeEnds, waypointInsertIndex, type EdgePoint } from '@/utils/mindmapEdges';
import {
  absolutePoints,
  crossLinkPointsAbsolute,
  edgePointsToRelative,
  linkPointsToRelative,
  setEdgePoints,
  type RoutedEdge,
} from '@/utils/mindmapRouting';
import type { CrossLinkShape } from '@/utils/mindmapCrossLinks';
import type { WaypointPreview } from './useMindmapWaypoints';

/*
 * Brytpunkterna på den markerade linjen eller tvärlänken
 * (docs/plans/mindmap-placering.md, del D): var handtagen står, och att
 * lägga till, flytta och ta bort en punkt. Allt går genom `commit`.
 */

interface Options {
  docRef: React.MutableRefObject<MindmapDoc>;
  layout: MindmapLayoutResult;
  routes: RoutedEdge[];
  shapes: CrossLinkShape[];
  /** Noden vars linje är markerad. */
  edgeId: string | null;
  link: MindmapCrossLink | null;
  commit: (next: MindmapDoc) => void;
  begin: (e: React.PointerEvent, key: string, points: EdgePoint[], index: number, onCommit: (points: EdgePoint[]) => void) => void;
  preview: WaypointPreview | null;
  flash: (text: string, tone?: 'success' | 'error') => void;
}

const TOO_MANY = `En linje kan ha högst ${MINDMAP_MAX_EDGE_POINTS} brytpunkter.`;

export function useMindmapLinePoints({ docRef, layout, routes, shapes, edgeId, link, commit, begin, preview, flash }: Options) {
  /** Den markerade linjens punkter i layoutens koordinater, och vad som behövs för att spara dem. */
  const target = useMemo(() => {
    if (edgeId) {
      const edge = layout.edges.find((e) => e.toId === edgeId);
      const parent = edge ? layout.byId.get(edge.fromId) : undefined;
      const route = routes.find((r) => r.toId === edgeId);
      if (!edge || !parent || !route) return null;
      const saved = findNode(docRef.current.root, edgeId)?.edge?.points ?? [];
      const key = `edge:${edgeId}`;
      return {
        key,
        points: preview?.key === key ? preview.points : absolutePoints(parent, saved),
        ends: routeEnds(route.route),
        save: (points: EdgePoint[]) => setEdgePoints(docRef.current, edgeId, edgePointsToRelative(parent, points)),
      };
    }
    if (link) {
      const from = layout.byId.get(link.from);
      const to = layout.byId.get(link.to);
      const shape = shapes.find((s) => s.id === link.id);
      // En ände i en hopfälld gren: punkterna går inte att räkna om.
      if (!from || !to || !shape) return null;
      const key = `link:${link.id}`;
      return {
        key,
        points: preview?.key === key ? preview.points : crossLinkPointsAbsolute(from, to, link.points ?? []),
        ends: { start: shape.start, end: shape.end },
        save: (points: EdgePoint[]) => setCrossLinkPoints(docRef.current, link.id, linkPointsToRelative(from, to, points)),
      };
    }
    return null;
  }, [docRef, edgeId, layout, link, preview, routes, shapes]);

  const save = useCallback((points: EdgePoint[]) => {
    if (!target) return;
    const next = target.save(points);
    if (next !== docRef.current) commit(next);
  }, [commit, docRef, target]);

  const insert = useCallback((index: number, at: EdgePoint) => {
    if (!target) return;
    if (target.points.length >= MINDMAP_MAX_EDGE_POINTS) {
      flash(TOO_MANY, 'error');
      return;
    }
    save([...target.points.slice(0, index), at, ...target.points.slice(index)]);
  }, [flash, save, target]);

  /** En punkt där man dubbelklickade, i rätt ordning längs linjen. */
  const addAt = useCallback((at: EdgePoint) => {
    if (!target) return;
    insert(waypointInsertIndex(target.ends.start, target.points, target.ends.end, at), at);
  }, [insert, target]);

  /** En punkt mitt på den längsta sträckan: knappen i raden. */
  const addMiddle = useCallback(() => {
    if (!target) return;
    const { index, at } = longestSegmentMiddle(target.ends.start, target.points, target.ends.end);
    insert(index, at);
  }, [insert, target]);

  const remove = useCallback((index: number) => {
    if (!target) return;
    save(target.points.filter((_, i) => i !== index));
  }, [save, target]);

  const onBegin = useCallback((e: React.PointerEvent, index: number) => {
    if (!target) return;
    begin(e, target.key, target.points, index, (points) => {
      const next = target.save(points);
      if (next !== docRef.current) commit(next);
    });
  }, [begin, commit, docRef, target]);

  return {
    points: target?.points ?? [],
    count: target?.points.length ?? 0,
    addAt,
    addMiddle,
    remove,
    clear: () => save([]),
    onBegin,
  };
}
