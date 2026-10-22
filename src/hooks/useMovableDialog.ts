import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  CENTERED,
  DialogOffset,
  clampDialogOffset,
  dialogMoveStep,
  isDialogDragStart,
  isMoved,
  recallDialogOffset,
  rememberDialogOffset,
} from '@/utils/dialogPosition';

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  from: DialogOffset;
};

type Options = {
  /** Under vilket namn platsen minns. Utan namn används dialogens rubrik. */
  positionKey?: string;
  enabled?: boolean;
};

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/** Dialogens ruta som den hade sett ut utan förskjutning. */
function homeBox(el: HTMLElement, offset: DialogOffset) {
  const rect = el.getBoundingClientRect();
  return { left: rect.left - offset.x, top: rect.top - offset.y, width: rect.width, height: rect.height };
}

/** Rubriken som Radix kopplat till dialogen via aria-labelledby. */
function titleKey(el: HTMLElement): string | undefined {
  const labelledBy = el.getAttribute('aria-labelledby');
  const title = labelledBy ? document.getElementById(labelledBy) : null;
  return title?.textContent?.trim() || undefined;
}

/**
 * Gör en dialog flyttbar med musen (dra i titelraden) och med Ctrl+Cmd+pil.
 * Dubbelklick på titelraden lägger tillbaka den i mitten. Platsen minns per
 * dialog så länge sidan är öppen.
 *
 * `ref` sätts på dialogens yttersta ruta och händelserna sprids på samma
 * element. Hur förskjutningen ritas bestämmer den som använder hooken.
 */
export function useMovableDialog({ positionKey, enabled = true }: Options = {}) {
  const [offset, setOffset] = useState<DialogOffset>(() =>
    enabled && positionKey ? recallDialogOffset(positionKey) : CENTERED,
  );
  const elRef = useRef<HTMLElement | null>(null);
  const keyRef = useRef<string | undefined>(positionKey);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const place = useCallback((next: DialogOffset, remember: boolean) => {
    const el = elRef.current;
    const clamped = el ? clampDialogOffset(next, homeBox(el, offsetRef.current), viewport()) : next;
    if (remember && keyRef.current) rememberDialogOffset(keyRef.current, clamped);
    if (clamped.x === offsetRef.current.x && clamped.y === offsetRef.current.y) return;
    offsetRef.current = clamped;
    setOffset(clamped);
  }, []);

  // Dialogen öppnas: hämta platsen den hade senast. Ref-callbacken körs innan
  // webbläsaren ritar, så dialogen hoppar inte från mitten. Radix byter
  // ref-callback vid varje rendering och anropar den då med samma element
  // igen; bara ett nytt element är en ny öppning.
  const openedRef = useRef<HTMLElement | null>(null);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      elRef.current = el;
      if (!el || !enabled || el === openedRef.current) return;
      openedRef.current = el;
      keyRef.current = positionKey ?? titleKey(el);
      place(keyRef.current ? recallDialogOffset(keyRef.current) : CENTERED, false);
    },
    [enabled, positionKey, place],
  );

  // Blir fönstret mindre ska dialogen fortfarande gå att nå.
  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      if (elRef.current && isMoved(offsetRef.current)) place(offsetRef.current, false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, place]);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const el = elRef.current;
    if (!enabled || !el || event.button !== 0) return;
    if (!isDialogDragStart(event.target, el, event)) return;
    // Fokus stannar i fältet och ingen text markeras medan man drar.
    event.preventDefault();
    el.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: offsetRef.current,
    };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    place({ x: drag.from.x + event.clientX - drag.startX, y: drag.from.y + event.clientY - drag.startY }, false);
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (keyRef.current) rememberDialogOffset(keyRef.current, offsetRef.current);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    const el = elRef.current;
    if (!enabled || !el || !isDialogDragStart(event.target, el, event)) return;
    place(CENTERED, true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!enabled) return;
    const step = dialogMoveStep(event);
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const current = offsetRef.current;
    place({ x: current.x + step.x, y: current.y + step.y }, true);
  };

  return {
    ref,
    offset,
    moved: enabled && isMoved(offset),
    /** Medan man drar ska dialogen följa pekaren utan övergång. */
    dragging,
    handlers: enabled
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onLostPointerCapture: endDrag,
          onDoubleClick,
          onKeyDown,
        }
      : {},
  };
}
