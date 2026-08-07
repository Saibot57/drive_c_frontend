'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ThemeArea, ThemeBlock } from '@/types/themeWheel';
import {
  WheelMetrics,
  pointToPolar,
  targetRingFromRadius,
  weekFromAngle,
} from '@/utils/themeWheelGeometry';
import { BlockPlacement } from '@/utils/themeWheelLayout';

/**
 * Peka-och-dra på hjulet.
 *
 * Schemaplaneraren använder dnd-kit, vars träffdetektering jämför rektanglar.
 * En tårtbit är ingen rektangel – en punkt hör till den bit vars vinkel- och
 * radieintervall den ligger i. Därför räknas målet här direkt ur pekarens
 * position i stället, vilket ger exakt rätt vecka och ring överallt på hjulet.
 */

/** Hur långt pekaren måste röra sig innan ett klick blir ett drag. */
const DRAG_THRESHOLD_PX = 4;

export type WheelDragKind = 'create' | 'move' | 'resize-start' | 'resize-end';

export interface WheelPreview {
  startWeek: number;
  endWeek: number;
  ring: number;
  title: string;
  color: string;
}

export interface WheelTarget {
  week: number;
  ring: number;
}

type ActiveDrag = {
  kind: WheelDragKind;
  origin: { x: number; y: number };
  activated: boolean;
  title: string;
  color: string;
  /** Sätts för 'create'. */
  area?: ThemeArea;
  /** Sätts för 'move' och 'resize-*'. */
  instanceId?: string;
  /** Antal veckor blocket täcker, för 'move'. */
  spanLength: number;
  /** Var i blocket användaren tog tag, för 'move'. */
  grabOffset: number;
  /** Veckan som står stilla vid 'resize-*'. */
  anchorWeek: number;
  ring: number;
};

type UseWheelInteractionParams = {
  svgRef: RefObject<SVGSVGElement>;
  metrics: WheelMetrics;
  weekCount: number;
  onCreate: (area: ThemeArea, target: { startWeek: number; endWeek: number; ring: number }) => void;
  onUpdate: (instanceId: string, patch: Partial<ThemeBlock>) => void;
};

export const useWheelInteraction = ({
  svgRef,
  metrics,
  weekCount,
  onCreate,
  onUpdate,
}: UseWheelInteractionParams) => {
  const [preview, setPreview] = useState<WheelPreview | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const previewRef = useRef<WheelPreview | null>(null);
  // Callbacks och mått läses ur refs, annars måste pekarlyssnarna kopplas om
  // vid varje omritning och ett pågående drag skulle tappas.
  const paramsRef = useRef({ metrics, weekCount, onCreate, onUpdate });
  paramsRef.current = { metrics, weekCount, onCreate, onUpdate };

  const clampWeek = useCallback((week: number) => (
    Math.min(Math.max(week, 0), paramsRef.current.weekCount - 1)
  ), []);

  /**
   * Veckan och ringen under pekaren. Ringen får bli en högre än de befintliga
   * så att ett område kan läggas parallellt i en vecka som redan är full.
   */
  const resolveTarget = useCallback((clientX: number, clientY: number): WheelTarget | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;

    const { metrics: m, weekCount: weeks } = paramsRef.current;
    const scale = m.size / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const { degrees, radius } = pointToPolar(m, x, y);

    if (radius > m.axisOuter) return null;

    return {
      week: weekFromAngle(degrees, weeks),
      ring: targetRingFromRadius(m, radius),
    };
  }, [svgRef]);

  const updatePreview = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;

    const target = resolveTarget(clientX, clientY);
    if (!target) {
      previewRef.current = null;
      setPreview(null);
      return;
    }

    let next: WheelPreview;
    if (drag.kind === 'move' || drag.kind === 'create') {
      const maxStart = paramsRef.current.weekCount - drag.spanLength;
      const startWeek = Math.min(Math.max(target.week - drag.grabOffset, 0), Math.max(maxStart, 0));
      next = {
        startWeek,
        endWeek: Math.min(startWeek + drag.spanLength - 1, paramsRef.current.weekCount - 1),
        ring: target.ring,
        title: drag.title,
        color: drag.color,
      };
    } else {
      // Dras en ände förbi den andra byter de plats, i stället för att spannet
      // kollapsar eller vänder sig ut och in.
      const moving = clampWeek(target.week);
      next = {
        startWeek: Math.min(moving, drag.anchorWeek),
        endWeek: Math.max(moving, drag.anchorWeek),
        ring: drag.ring,
        title: drag.title,
        color: drag.color,
      };
    }

    previewRef.current = next;
    setPreview(next);
  }, [clampWeek, resolveTarget]);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    const result = previewRef.current;
    dragRef.current = null;
    previewRef.current = null;
    setPreview(null);

    if (!drag || !drag.activated || !result) return;

    const { onCreate: create, onUpdate: update } = paramsRef.current;
    if (drag.kind === 'create' && drag.area) {
      create(drag.area, {
        startWeek: result.startWeek,
        endWeek: result.endWeek,
        ring: result.ring,
      });
      return;
    }

    if (drag.instanceId) {
      update(drag.instanceId, {
        startWeek: result.startWeek,
        endWeek: result.endWeek,
        ring: result.ring,
      });
    }
  }, []);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.activated) {
        const dx = event.clientX - drag.origin.x;
        const dy = event.clientY - drag.origin.y;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.activated = true;
      }

      event.preventDefault();
      updatePreview(event.clientX, event.clientY);
    };

    const handleUp = () => endDrag();
    const handleCancel = () => {
      dragRef.current = null;
      previewRef.current = null;
      setPreview(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCancel();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [endDrag, updatePreview]);

  /** Drar ett arbetsområde från biblioteket ut i hjulet. */
  const startCreate = useCallback((area: ThemeArea, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    dragRef.current = {
      kind: 'create',
      origin: { x: event.clientX, y: event.clientY },
      activated: false,
      title: area.title,
      color: area.color,
      area,
      spanLength: 1,
      grabOffset: 0,
      anchorWeek: 0,
      ring: 0,
    };
  }, []);

  /** Flyttar ett block i sidled (vecka) och utåt/inåt (ring). */
  const startMove = useCallback((
    block: ThemeBlock,
    placement: BlockPlacement,
    event: React.PointerEvent
  ) => {
    if (event.button !== 0) return;
    const target = resolveTarget(event.clientX, event.clientY);
    const grabbedWeek = target ? target.week : placement.startWeek;
    dragRef.current = {
      kind: 'move',
      origin: { x: event.clientX, y: event.clientY },
      activated: false,
      title: block.title,
      color: block.color,
      instanceId: block.instanceId,
      spanLength: placement.endWeek - placement.startWeek + 1,
      grabOffset: Math.min(Math.max(grabbedWeek - placement.startWeek, 0), placement.endWeek - placement.startWeek),
      anchorWeek: placement.startWeek,
      ring: placement.ring,
    };
  }, [resolveTarget]);

  /** Drar i en av bågens ändar för att ändra veckospannet. */
  const startResize = useCallback((
    block: ThemeBlock,
    placement: BlockPlacement,
    edge: 'start' | 'end',
    event: React.PointerEvent
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    dragRef.current = {
      kind: edge === 'start' ? 'resize-start' : 'resize-end',
      origin: { x: event.clientX, y: event.clientY },
      activated: false,
      title: block.title,
      color: block.color,
      instanceId: block.instanceId,
      spanLength: placement.endWeek - placement.startWeek + 1,
      grabOffset: 0,
      anchorWeek: edge === 'start' ? placement.endWeek : placement.startWeek,
      ring: placement.ring,
    };
  }, []);

  return {
    preview,
    draggingInstanceId: preview && dragRef.current?.instanceId ? dragRef.current.instanceId : null,
    resolveTarget,
    startCreate,
    startMove,
    startResize,
  };
};
