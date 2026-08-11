'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import {
  EMPTY_JUMP_MARGIN_PX,
  GRID_SIZE,
  KEYBOARD_FAST_FACTOR,
  KEYBOARD_MOVE_COMMIT_MS,
  PAN_STEP_PX,
} from '../types/constants';
import type { SurfaceElement, ViewportState } from '../types/workspace.types';
import type { Point } from './useElementDrag';

type Direction = 'up' | 'down' | 'left' | 'right';

/** Enhetssteg i skärmens riktning: y växer nedåt. */
const STEP: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const ARROW_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

interface UseCanvasKeyboardParams {
  viewport: ViewportState;
  onViewportChange: (viewport: Partial<ViewportState>) => void;
  /** Den synliga canvasytan i skärmpixlar, med sidopanelerna borträknade. */
  canvasSize: () => { width: number; height: number };
  placements: SurfaceElement[];
  selectedElementId: string | null;
  movePlacement: (placementId: string, x: number, y: number) => void;
  commitMove: (placementId: string, from: Point) => void;
}

/**
 * Piltangenterna kör runt på canvasen. Alt+pil hoppar ut ur innehållet, och är
 * ett kort markerat flyttas kortet i stället för vyn — Esc släpper markeringen
 * och då kör man vidare med samma tangenter.
 *
 * useHotkeys hoppar över inmatningsfält, så pilarna stjäls aldrig medan man
 * skriver i ett kort. Alt kontrolleras här i handlaren och inte i bindningen,
 * eftersom useHotkeys delas med schemat och temakalendern och inte känner till
 * Alt — en bindning utan `alt` matchar därför både med och utan tangenten.
 */
export function useCanvasKeyboard({
  viewport,
  onViewportChange,
  canvasSize,
  placements,
  selectedElementId,
  movePlacement,
  commitMove,
}: UseCanvasKeyboardParams) {
  /*
   * Ångra ska få en post per förflyttning, inte en per tangenttryck. Startpunkten
   * sparas vid det första trycket, och posten läggs först när trycken upphört.
   */
  const pendingMove = useRef<{ placementId: string; from: Point } | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushMove = useCallback(() => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    const pending = pendingMove.current;
    pendingMove.current = null;
    if (pending) commitMove(pending.placementId, pending.from);
  }, [commitMove]);

  // Byter man markering, byter yta eller lämnar sidan ska posten läggas nu.
  // Att den läggs tidigare än efter tystnaden gör ingen skada — den blir bara
  // avslutad, aldrig glömd.
  useEffect(() => () => flushMove(), [flushMove, selectedElementId]);

  const panBy = useCallback((direction: Direction, factor: number) => {
    const step = PAN_STEP_PX * factor;
    const delta = STEP[direction];
    // Att åka nedåt betyder att innehållet flyttar uppåt, därför minus.
    onViewportChange({
      panX: viewport.panX - delta.x * step,
      panY: viewport.panY - delta.y * step,
    });
  }, [onViewportChange, viewport.panX, viewport.panY]);

  /**
   * Lägger vyn så att inget på ytan syns längre: innehållets kant hamnar precis
   * utanför skärmkanten på den sida man kom från. Åker man nedåt ska det
   * nedersta kortet just ha försvunnit ovanför överkanten.
   */
  const jumpPastContent = useCallback((direction: Direction) => {
    const { width, height } = canvasSize();
    const onCanvas = placements.filter((p) => p.is_on_canvas);
    const { zoom, panX, panY } = viewport;
    const delta = STEP[direction];

    // Tom yta: det finns inget att hoppa förbi, så steget blir en hel skärm.
    if (onCanvas.length === 0) {
      onViewportChange({
        panX: panX - delta.x * width,
        panY: panY - delta.y * height,
      });
      return;
    }

    const minX = Math.min(...onCanvas.map((p) => p.position_x));
    const minY = Math.min(...onCanvas.map((p) => p.position_y));
    const maxX = Math.max(...onCanvas.map((p) => p.position_x + p.width));
    const maxY = Math.max(...onCanvas.map((p) => p.position_y + p.height));

    switch (direction) {
      case 'down':
        onViewportChange({ panY: -EMPTY_JUMP_MARGIN_PX - maxY * zoom });
        break;
      case 'up':
        onViewportChange({ panY: height + EMPTY_JUMP_MARGIN_PX - minY * zoom });
        break;
      case 'right':
        onViewportChange({ panX: -EMPTY_JUMP_MARGIN_PX - maxX * zoom });
        break;
      case 'left':
        onViewportChange({ panX: width + EMPTY_JUMP_MARGIN_PX - minX * zoom });
        break;
    }
  }, [canvasSize, placements, viewport, onViewportChange]);

  /** Sant om kortet flyttades. Falskt betyder att vyn får ta trycket i stället. */
  const nudgeSelected = useCallback((direction: Direction, factor: number): boolean => {
    const placement = placements.find(
      (p) => p.element_id === selectedElementId && p.is_on_canvas,
    );
    // Ett låst kort går inte att flytta, och då är det bättre att vyn rör sig
    // än att tangenten inte gör någonting alls.
    if (!placement || placement.is_locked) return false;

    const from = { x: placement.position_x, y: placement.position_y };
    if (pendingMove.current?.placementId !== placement.id) {
      flushMove();
      pendingMove.current = { placementId: placement.id, from };
    }

    const step = GRID_SIZE * factor;
    const delta = STEP[direction];
    movePlacement(placement.id, from.x + delta.x * step, from.y + delta.y * step);

    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(flushMove, KEYBOARD_MOVE_COMMIT_MS);
    return true;
  }, [placements, selectedElementId, movePlacement, flushMove]);

  const handleArrow = useCallback((direction: Direction, event: KeyboardEvent) => {
    const factor = event.shiftKey ? KEYBOARD_FAST_FACTOR : 1;
    // Alt hör till vyn och hoppar även när ett kort är markerat.
    if (event.altKey) {
      jumpPastContent(direction);
      return;
    }
    if (selectedElementId && nudgeSelected(direction, factor)) return;
    panBy(direction, factor);
  }, [jumpPastContent, nudgeSelected, panBy, selectedElementId]);

  useHotkeys(
    // Shift matchas strikt av useHotkeys, så snabbsteget behöver en egen
    // bindning per riktning.
    Object.entries(ARROW_KEYS).flatMap(([key, direction]) => [
      { key, handler: (e: KeyboardEvent) => handleArrow(direction, e) },
      { key, shift: true, handler: (e: KeyboardEvent) => handleArrow(direction, e) },
    ]),
    [handleArrow],
  );
}
