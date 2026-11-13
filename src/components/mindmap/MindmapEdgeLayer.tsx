'use client';

import { routeEnds, routeToSvg } from '@/utils/mindmapEdges';
import type { RoutedEdge } from '@/utils/mindmapRouting';
import type { EdgeEnd } from '@/hooks/useMindmapEdgeSelection';

interface MindmapEdgeLayerProps {
  width: number;
  height: number;
  routes: RoutedEdge[];
  /** Noden vars linje är markerad. Utan `onSelect` går linjerna inte att markera. */
  selectedId?: string | null;
  /** Linjerna som är markerade bland flera (docs/plans/mindmap-arrangera.md, del A). */
  groupIds?: ReadonlySet<string>;
  /** Händelsen följer med, så att Cmd+klick kan läsas. */
  onSelect?: (id: string, e: React.PointerEvent) => void;
  /** Dubbelklick på en linje: en brytpunkt där (del D). */
  onAddPoint?: (id: string, e: React.MouseEvent) => void;
}

/**
 * Grenarnas linjer, under noderna. Varje linje har en bred osynlig linje att
 * träffa, eftersom den synliga är tunn (docs/plans/mindmap-placering.md,
 * del C). Presentationen ritar samma lager utan `onSelect`.
 */
export function MindmapEdgeLayer({ width, height, routes, selectedId = null, groupIds, onSelect, onAddPoint }: MindmapEdgeLayerProps) {
  return (
    <svg className="mm__edges" width={width} height={height} aria-hidden="true">
      {routes.map((edge) => {
        const d = routeToSvg(edge.route);
        return (
          <g key={`${edge.fromId}-${edge.toId}`}>
            <path d={d} className={`mm__edge${selectedId === edge.toId || groupIds?.has(edge.toId) ? ' mm__edge--selected' : ''}`} />
            {onSelect && (
              <path
                d={d}
                className="mm__edge-hit"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  // Annars börjar ytan panorera.
                  e.stopPropagation();
                  onSelect(edge.toId, e);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onAddPoint?.(edge.toId, e);
                }}
              >
                <title>Linje. Dubbelklicka för en brytpunkt.</title>
              </path>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface MindmapEdgeHandlesProps {
  width: number;
  height: number;
  edge: RoutedEdge | null;
  onBegin: (e: React.PointerEvent, end: EdgeEnd) => void;
  /** Dubbelklick på ett handtag: fästet följer kartan igen. */
  onReset: (end: EdgeEnd) => void;
}

/** Handtagen på den markerade linjens ändar, ovanpå noderna. */
export function MindmapEdgeHandles({ width, height, edge, onBegin, onReset }: MindmapEdgeHandlesProps) {
  if (!edge) return null;
  const { start, end } = routeEnds(edge.route);
  const handle = (at: { x: number; y: number }, which: EdgeEnd) => (
    <circle
      cx={at.x}
      cy={at.y}
      r={5}
      className="mm__edge-handle"
      onPointerDown={(e) => onBegin(e, which)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset(which);
      }}
    >
      <title>Dra till en annan sida av noden. Dubbelklicka för kartans fäste.</title>
    </circle>
  );
  return (
    <svg className="mm__edge-handles" width={width} height={height}>
      {handle(start, 'from')}
      {handle(end, 'to')}
    </svg>
  );
}

interface MindmapPointHandlesProps {
  width: number;
  height: number;
  /** Brytpunkterna i layoutens koordinater. */
  points: { x: number; y: number }[];
  onBegin: (e: React.PointerEvent, index: number) => void;
  /** Dubbelklick på en punkt tar bort den. */
  onRemove: (index: number) => void;
}

/** Brytpunkterna på den markerade linjen eller tvärlänken (del D), ovanpå noderna. */
export function MindmapPointHandles({ width, height, points, onBegin, onRemove }: MindmapPointHandlesProps) {
  if (points.length === 0) return null;
  return (
    <svg className="mm__edge-handles" width={width} height={height}>
      {points.map((p, index) => (
        <rect
          key={index}
          x={p.x - 4.5}
          y={p.y - 4.5}
          width={9}
          height={9}
          rx={2}
          className="mm__edge-handle mm__edge-point"
          onPointerDown={(e) => onBegin(e, index)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
        >
          <title>Brytpunkt. Dra den dit linjen ska gå; dubbelklicka för att ta bort den.</title>
        </rect>
      ))}
    </svg>
  );
}
